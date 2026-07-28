// Background Service Worker - Production Lifecycle & IPC Engine

let creatingOffscreenPromise = null;

// Helper to check if offscreen document is open
async function hasOffscreenDocument() {
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    return contexts.length > 0;
  }
  return false;
}

// Atomic Offscreen Creation Mutex to prevent double-creation race conditions
async function setupOffscreenDocument() {
  const hasDoc = await hasOffscreenDocument();
  if (hasDoc) return;

  if (creatingOffscreenPromise) {
    await creatingOffscreenPromise;
    return;
  }

  creatingOffscreenPromise = (async () => {
    try {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'Capturing tab audio for stereo balance, volume amplification, and limiter processing'
      });
    } catch (error) {
      if (!error.message || !error.message.includes('Only a single offscreen document')) {
        console.error('Fatal offscreen document creation error:', error);
        throw error;
      }
    } finally {
      creatingOffscreenPromise = null;
    }
  })();

  await creatingOffscreenPromise;
}

// Reliable Message Dispatcher with Exponential Backoff & Response Acknowledgment
async function sendToOffscreenWithRetry(message, maxRetries = 6, initialDelayMs = 80) {
  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      if (response && response.success) {
        return response;
      }
      if (response && response.success === false) {
        throw new Error(response.error || 'Offscreen document returned processing failure');
      }
    } catch (err) {
      if (attempt === maxRetries || (err.message && err.message.includes('processing failure'))) {
        throw err;
      }
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    delay *= 1.5; // Exponential backoff
  }
  throw new Error(`IPC timeout: offscreen document unresponsive for message [${message.type}]`);
}

// Clean up tab state from session storage & offscreen context
async function cleanUpTab(tabId) {
  const { capturedTabs = {} } = await chrome.storage.session.get('capturedTabs');
  if (capturedTabs[tabId]) {
    delete capturedTabs[tabId];
    await chrome.storage.session.set({ capturedTabs });

    try {
      await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE', tabId });
    } catch (err) {}

    if (Object.keys(capturedTabs).length === 0) {
      await closeOffscreenDocument();
    }

    try {
      await chrome.runtime.sendMessage({ type: 'STATE_CHANGED' });
    } catch (err) {}
  }
}

// Close offscreen document safely
async function closeOffscreenDocument() {
  const hasDoc = await hasOffscreenDocument();
  if (!hasDoc) return;

  try {
    await chrome.offscreen.closeDocument();
  } catch (error) {
    console.error('Error closing offscreen document:', error);
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'START_CAPTURE') {
        const { tabId, streamId, title, favIconUrl } = message;

        // 1. Atomic setup of offscreen context
        await setupOffscreenDocument();

        // 2. Retrieve initial parameters (including domain memory if active)
        const { rememberDomains = false } = await chrome.storage.sync.get('rememberDomains');
        let initialPan = 0;
        let initialVol = 1.0;

        if (rememberDomains && sender.tab?.url) {
          try {
            const domain = new URL(sender.tab.url).hostname;
            const { domainSettings = {} } = await chrome.storage.sync.get('domainSettings');
            if (domainSettings[domain]) {
              initialPan = domainSettings[domain].pan ?? 0;
              initialVol = domainSettings[domain].volume ?? 1.0;
            }
          } catch (e) {}
        }

        // 3. Dispatch START_CAPTURE to offscreen FIRST and wait for explicit acknowledgment
        await sendToOffscreenWithRetry({
          type: 'START_CAPTURE',
          tabId,
          streamId,
          pan: initialPan,
          volume: initialVol,
          isMuted: false,
          isMono: false
        });

        // 4. Save state ONLY AFTER offscreen confirms active audio stream setup!
        const { capturedTabs = {} } = await chrome.storage.session.get('capturedTabs');
        capturedTabs[tabId] = {
          tabId,
          title,
          favIconUrl,
          pan: initialPan,
          volume: initialVol,
          isMuted: false,
          isMono: false
        };
        await chrome.storage.session.set({ capturedTabs });

        try {
          await chrome.runtime.sendMessage({ type: 'STATE_CHANGED' });
        } catch (e) {}

        sendResponse({ success: true });
      } else if (message.type === 'STOP_CAPTURE') {
        const { tabId } = message;
        await cleanUpTab(tabId);
        sendResponse({ success: true });
      } else if (message.type === 'SET_AUDIO_PARAMS') {
        const { tabId, pan, volume, isMuted, isMono } = message;

        const { capturedTabs = {} } = await chrome.storage.session.get('capturedTabs');
        if (capturedTabs[tabId]) {
          if (pan !== undefined) capturedTabs[tabId].pan = pan;
          if (volume !== undefined) capturedTabs[tabId].volume = volume;
          if (isMuted !== undefined) capturedTabs[tabId].isMuted = isMuted;
          if (isMono !== undefined) capturedTabs[tabId].isMono = isMono;
          await chrome.storage.session.set({ capturedTabs });

          const { rememberDomains = false } = await chrome.storage.sync.get('rememberDomains');
          if (rememberDomains) {
            try {
              const tab = await chrome.tabs.get(tabId);
              if (tab && tab.url) {
                const domain = new URL(tab.url).hostname;
                const { domainSettings = {} } = await chrome.storage.sync.get('domainSettings');
                domainSettings[domain] = {
                  pan: capturedTabs[tabId].pan,
                  volume: capturedTabs[tabId].volume
                };
                await chrome.storage.sync.set({ domainSettings });
              }
            } catch (e) {}
          }
        }

        try {
          await sendToOffscreenWithRetry({
            type: 'SET_AUDIO_PARAMS',
            tabId,
            pan,
            volume,
            isMuted,
            isMono
          }, 3, 50);
        } catch (err) {}

        sendResponse({ success: true });
      } else if (message.type === 'UPDATE_SETTINGS') {
        try {
          await sendToOffscreenWithRetry(message, 3, 50);
        } catch (err) {}
        sendResponse({ success: true });
      } else if (message.type === 'RESET_ALL_TABS') {
        const { capturedTabs = {} } = await chrome.storage.session.get('capturedTabs');
        for (const id in capturedTabs) {
          capturedTabs[id].pan = 0;
          capturedTabs[id].volume = 1.0;
          capturedTabs[id].isMuted = false;
          capturedTabs[id].isMono = false;

          try {
            await sendToOffscreenWithRetry({
              type: 'SET_AUDIO_PARAMS',
              tabId: parseInt(id),
              pan: 0,
              volume: 1.0,
              isMuted: false,
              isMono: false
            }, 2, 50);
          } catch (e) {}
        }
        await chrome.storage.session.set({ capturedTabs });
        try {
          await chrome.runtime.sendMessage({ type: 'STATE_CHANGED' });
        } catch (e) {}
        sendResponse({ success: true });
      } else if (message.type === 'CAPTURE_ENDED') {
        const { tabId } = message;
        await cleanUpTab(tabId);
        sendResponse({ success: true });
      }
    } catch (error) {
      console.error('Error in background service worker:', error);
      if (message.type === 'START_CAPTURE' && message.tabId) {
        await cleanUpTab(message.tabId);
      }
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true;
});

// Clean up tab removal
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await cleanUpTab(tabId);
});

// Clean up tab reloads/navigations
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    const { capturedTabs = {} } = await chrome.storage.session.get('capturedTabs');
    if (capturedTabs[tabId]) {
      await cleanUpTab(tabId);
    }
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.session.clear();
});
