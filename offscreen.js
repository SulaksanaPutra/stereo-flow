// Offscreen Document Audio Processing Engine

let audioCtx = null;
const activeStreams = new Map(); // tabId -> { stream, sourceNode, pannerNode, gainNode, compressorNode, pan, volume, isMuted, isMono }
let currentLimiterMode = 'balanced';

// Initialize shared AudioContext
function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Stop capturing a tab and release Web Audio resources cleanly
function stopCapture(tabId) {
  const data = activeStreams.get(tabId);
  if (!data) return;

  const { stream, sourceNode, pannerNode, gainNode, compressorNode } = data;

  if (stream) {
    try {
      stream.getTracks().forEach(track => track.stop());
    } catch (e) {}
  }

  try {
    if (sourceNode) sourceNode.disconnect();
    if (pannerNode) pannerNode.disconnect();
    if (gainNode) gainNode.disconnect();
    if (compressorNode) compressorNode.disconnect();
  } catch (error) {
    console.error(`Error disconnecting audio nodes for tab ${tabId}:`, error);
  }

  activeStreams.delete(tabId);
  console.log(`Successfully released audio capture resources for tab ${tabId}`);
}

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'START_CAPTURE') {
        const { tabId, streamId } = message;

        if (activeStreams.has(tabId)) {
          stopCapture(tabId);
        }

        const ctx = initAudioContext();

        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId
              }
            },
            video: false
          });
        } catch (mediaError) {
          console.error(`MediaStream acquisition error for tab ${tabId}:`, mediaError);
          stopCapture(tabId);
          sendResponse({ success: false, error: mediaError.message || 'Failed to acquire tab media stream' });
          return;
        }

        const sourceNode = ctx.createMediaStreamSource(stream);
        const pannerNode = ctx.createStereoPanner();
        const gainNode = ctx.createGain();

        // Dynamics Compressor Limiter
        const compressorNode = ctx.createDynamicsCompressor();
        const threshold = currentLimiterMode === 'aggressive' ? -3.0 : -1.0;
        compressorNode.threshold.setValueAtTime(threshold, ctx.currentTime);
        compressorNode.knee.setValueAtTime(10, ctx.currentTime);
        compressorNode.ratio.setValueAtTime(12, ctx.currentTime);
        compressorNode.attack.setValueAtTime(0.003, ctx.currentTime);
        compressorNode.release.setValueAtTime(0.25, ctx.currentTime);

        sourceNode.connect(pannerNode);
        pannerNode.connect(gainNode);
        gainNode.connect(compressorNode);
        compressorNode.connect(ctx.destination);

        const { pan = 0, volume = 1.0, isMuted = false, isMono = false } = message;

        const effectivePan = isMono ? 0.0 : pan;
        pannerNode.pan.setValueAtTime(effectivePan, ctx.currentTime);

        const targetGain = isMuted ? 0.0 : volume;
        gainNode.gain.setValueAtTime(targetGain, ctx.currentTime);

        activeStreams.set(tabId, {
          stream,
          sourceNode,
          pannerNode,
          gainNode,
          compressorNode,
          pan,
          volume,
          isMuted,
          isMono
        });

        stream.getAudioTracks().forEach(track => {
          track.addEventListener('ended', () => {
            if (activeStreams.has(tabId)) {
              chrome.runtime.sendMessage({ type: 'CAPTURE_ENDED', tabId }).catch(() => {});
              stopCapture(tabId);
            }
          });
        });

        console.log(`Started audio capture for tab ${tabId}`);
        sendResponse({ success: true });
      } else if (message.type === 'STOP_CAPTURE') {
        const { tabId } = message;
        stopCapture(tabId);
        sendResponse({ success: true });
      } else if (message.type === 'SET_AUDIO_PARAMS') {
        const { tabId, pan, volume, isMuted, isMono } = message;
        const data = activeStreams.get(tabId);

        if (data) {
          const { pannerNode, gainNode } = data;
          const ctx = initAudioContext();

          if (pan !== undefined) data.pan = pan;
          if (volume !== undefined) data.volume = volume;
          if (isMuted !== undefined) data.isMuted = isMuted;
          if (isMono !== undefined) data.isMono = isMono;

          const targetPan = data.isMono ? 0.0 : data.pan;
          pannerNode.pan.setTargetAtTime(targetPan, ctx.currentTime, 0.015);

          const targetGain = data.isMuted ? 0.0 : data.volume;
          gainNode.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.015);
        }
        sendResponse({ success: true });
      } else if (message.type === 'UPDATE_SETTINGS') {
        const { limiterMode } = message;
        if (limiterMode) {
          currentLimiterMode = limiterMode;
          const targetThreshold = limiterMode === 'aggressive' ? -3.0 : -1.0;
          activeStreams.forEach(data => {
            if (data.compressorNode) {
              const ctx = initAudioContext();
              data.compressorNode.threshold.setTargetAtTime(targetThreshold, ctx.currentTime, 0.015);
            }
          });
        }
        sendResponse({ success: true });
      }
    } catch (err) {
      console.error('Error in offscreen message handler:', err);
      sendResponse({ success: false, error: err.message });
    }
  })();
  return true;
});

chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' })
  .catch(() => console.log('Offscreen ready signal sent.'));
