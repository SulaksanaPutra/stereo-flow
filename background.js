// Background Service Worker - Production Lifecycle & IPC Engine

let creatingOffscreenPromise = null;

// Helper to check if a URL is restricted from media capture
function isRestrictedUrl(url) {
  if (!url) return false;
  const restrictedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'https://chromewebstore.google.com'
  ];
  return restrictedPrefixes.some(prefix => url.startsWith(prefix));
}

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

// Atomic Offscreen Creation with OFFSCREEN_READY handshake
async function setupOffscreenDocument() {
  const hasDoc = await hasOffscreenDocument();
  if (hasDoc) return;

  if (creatingOffscreenPromise) {
    await creatingOffscreenPromise;
    return;
  }

  creatingOffscreenPromise = (async () => {
    try {
      let resolveReady;
      const readyPromise = new Promise(resolve => { resolveReady = resolve; });

      const onMessageReady = (message) => {
        if (message.type === 'OFFSCREEN_READY') {
          chrome.runtime.onMessage.removeListener(onMessageReady);
          resolveReady();
        }
      };
      chrome.runtime.onMessage.addListener(onMessageReady);

      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'Capturing tab audio for stereo balance, volume amplification, and limiter processing'
      });

      await Promise.race([
        readyPromise,
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);
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

// Reliable Message Dispatcher to Offscreen with Exponential Backoff
async function sendToOffscreenWithRetry(message, maxRetries = 5, initialDelayMs = 60) {
  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      if (response && response.success) {
        return response;
      }
      if (response && response.success === false) {
        throw new Error(response.error || 'Offscreen processing failed');
      }
    } catch (err) {
      if (attempt === maxRetries || (err.message && err.message.includes('processing failed'))) {
        throw err;
      }
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    delay *= 1.5;
  }
  throw new Error(`IPC timeout for message [${message.type}]`);
}

// Clean up tab state from session storage & offscreen context
async function cleanUpTab(tabId) {
  const { capturedTabs = {} } = await chrome.storage.session.get('capturedTabs');
  if (capturedTabs[tabId]) {
    delete capturedTabs[tabId];
    await chrome.storage.session.set({ capturedTabs });

    try {
      await sendToOffscreenWithRetry({ type: 'OFFSCREEN_STOP_CAPTURE', tabId });
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
    if (!error.message || !error.message.includes('No current offscreen document')) {
      console.error('Error closing offscreen document:', error);
    }
  }
}

// Service worker message handler (handles UI messages from popup)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'START_CAPTURE') {
        const { tabId, streamId, title: messageTitle, favIconUrl: messageFavIcon } = message;

        if (!streamId) {
          sendResponse({ success: false, error: 'Missing stream ID for tab capture.' });
          return;
        }

        let tabObj = null;
        try {
          tabObj = await chrome.tabs.get(tabId);
        } catch (e) {}

        const tabUrl = tabObj?.url;
        if (isRestrictedUrl(tabUrl)) {
          sendResponse({ success: false, error: 'Cannot capture media from restricted browser system pages or Web Store.' });
          return;
        }

        const title = messageTitle || tabObj?.title || 'Tab';
        const favIconUrl = messageFavIcon || tabObj?.favIconUrl;

        // 1. Ensure offscreen context is created & ready
        await setupOffscreenDocument();

        // 2. Retrieve initial parameters (including domain memory if active)
        const { rememberDomains = false } = await chrome.storage.sync.get('rememberDomains');
        let initialPan = 0;
        let initialVol = 1.0;

        if (rememberDomains && tabUrl) {
          try {
            const domain = new URL(tabUrl).hostname;
            const { domainSettings = {} } = await chrome.storage.sync.get('domainSettings');
            if (domainSettings[domain]) {
              initialPan = domainSettings[domain].pan ?? 0;
              initialVol = domainSettings[domain].volume ?? 1.0;
            }
          } catch (e) {}
        }

        // 3. Dispatch namespaced OFFSCREEN_START_CAPTURE to offscreen document
        await sendToOffscreenWithRetry({
          type: 'OFFSCREEN_START_CAPTURE',
          tabId,
          streamId,
          pan: initialPan,
          volume: initialVol,
          isMuted: false,
          isMono: false
        });

        // 4. Update session storage state ONLY after offscreen acknowledges setup!
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
            type: 'OFFSCREEN_SET_AUDIO_PARAMS',
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
          await sendToOffscreenWithRetry({
            type: 'OFFSCREEN_UPDATE_SETTINGS',
            limiterMode: message.limiterMode
          }, 3, 50);
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
              type: 'OFFSCREEN_SET_AUDIO_PARAMS',
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
      console.error('Error in service worker message listener:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true;
});

// Clean up if a tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await cleanUpTab(tabId);
});

// Clean up if a tab reloads or navigates
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
