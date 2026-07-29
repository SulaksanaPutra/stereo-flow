// Popup UI Logic for StereoFlow

const DEFAULT_FAVICON = 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3%2018v-6a9%209%200%200%201%2018%200%20v6%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M21%2019a2%202%200%200%201-2%202h-1a2%202%200%200%201-2-2v-3a2%202%200%200%201%202-2h3zM3%2019a2%202%200%200%200%202%202h1a2%202%200%200%200%202-2v-3a2%202%200%200%200-2-2H3z%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E';

let activeTabId = null;
let appSettings = {
  maxVolume: 2.0,
  limiterMode: 'balanced',
  rememberDomains: false
};

// Initialize the popup
async function init() {
  try {
    // 1. Initialize Theme Setup & User Settings
    await initTheme();
    await initSettings();

    // 2. Query Active Tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      activeTabId = tab.id;
    }

    // 3. Fallback Favicon Listener
    document.addEventListener('error', (event) => {
      if (event.target.tagName === 'IMG' && event.target.classList.contains('tab-favicon')) {
        if (event.target.getAttribute('data-fallback') !== 'true') {
          event.target.setAttribute('data-fallback', 'true');
          event.target.src = DEFAULT_FAVICON;
        }
      }
    }, true);

    // 4. Render Initial UI State
    await renderUI();

    // 5. State Change Listener
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'STATE_CHANGED' || message.type === 'CAPTURE_ENDED') {
        renderUI();
      }
    });
  } catch (error) {
    console.error('Initialization failed:', error);
  }
}

// Theme Handling Logic
async function initTheme() {
  const { theme = 'auto' } = await chrome.storage.sync.get('theme');
  applyTheme(theme);

  const themeGroup = document.getElementById('theme-toggle-group');
  if (themeGroup) {
    themeGroup.querySelectorAll('.btn-theme-option').forEach(btn => {
      const val = btn.getAttribute('data-theme-val');
      btn.classList.toggle('active', val === theme);
      
      btn.addEventListener('click', async () => {
        const selectedTheme = btn.getAttribute('data-theme-val');
        await chrome.storage.sync.set({ theme: selectedTheme });
        applyTheme(selectedTheme);

        themeGroup.querySelectorAll('.btn-theme-option').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-theme-val') === selectedTheme);
        });
      });
    });
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    chrome.storage.sync.get('theme').then(({ theme: currentTheme = 'auto' }) => {
      if (currentTheme === 'auto') {
        applyTheme('auto');
      }
    });
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// Settings Modal & Options Handling
async function initSettings() {
  const stored = await chrome.storage.sync.get(['maxVolume', 'limiterMode', 'rememberDomains']);
  if (stored.maxVolume !== undefined) appSettings.maxVolume = parseFloat(stored.maxVolume);
  if (stored.limiterMode !== undefined) appSettings.limiterMode = stored.limiterMode;
  if (stored.rememberDomains !== undefined) appSettings.rememberDomains = stored.rememberDomains;

  const modal = document.getElementById('settings-modal');
  const btnOpen = document.getElementById('btn-open-settings');
  const btnClose = document.getElementById('btn-close-settings');

  const maxVolSelect = document.getElementById('setting-max-vol');
  const limiterSelect = document.getElementById('setting-limiter-mode');
  const domainSwitch = document.getElementById('setting-domain-memory');
  const btnResetAll = document.getElementById('btn-reset-all-tabs');

  if (maxVolSelect) maxVolSelect.value = String(appSettings.maxVolume);
  if (limiterSelect) limiterSelect.value = appSettings.limiterMode;
  if (domainSwitch) domainSwitch.checked = appSettings.rememberDomains;

  // Modal open/close handlers
  if (btnOpen && modal) {
    btnOpen.addEventListener('click', () => {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
    });
  }

  if (btnClose && modal) {
    btnClose.addEventListener('click', () => {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    });
  }

  // Setting Change Listeners
  if (maxVolSelect) {
    maxVolSelect.addEventListener('change', async (e) => {
      const val = parseFloat(e.target.value);
      appSettings.maxVolume = val;
      await chrome.storage.sync.set({ maxVolume: val });
      renderUI();
    });
  }

  if (limiterSelect) {
    limiterSelect.addEventListener('change', async (e) => {
      const val = e.target.value;
      appSettings.limiterMode = val;
      await chrome.storage.sync.set({ limiterMode: val });

      chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        limiterMode: val
      });
    });
  }

  if (domainSwitch) {
    domainSwitch.addEventListener('change', async (e) => {
      const checked = e.target.checked;
      appSettings.rememberDomains = checked;
      await chrome.storage.sync.set({ rememberDomains: checked });
    });
  }

  if (btnResetAll) {
    btnResetAll.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ type: 'RESET_ALL_TABS' });
      if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
      }
      await renderUI();
    });
  }
}

// Check if a URL is restricted
function isRestrictedUrl(url) {
  if (!url) return true;
  const restrictedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'https://chromewebstore.google.com'
  ];
  return restrictedPrefixes.some(prefix => url.startsWith(prefix));
}

// Render UI State
async function renderUI() {
  const activeTabContainer = document.getElementById('active-tab-container');
  const otherTabsSection = document.getElementById('other-tabs-section');
  const otherTabsList = document.getElementById('other-tabs-list');

  const { capturedTabs = {} } = await chrome.storage.session.get('capturedTabs');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    activeTabContainer.innerHTML = `<div class="loading-spinner">No active tab found</div>`;
    return;
  }

  const isCaptured = !!capturedTabs[tab.id];

  if (isRestrictedUrl(tab.url)) {
    activeTabContainer.innerHTML = `
      <div class="uncontrolled-card">
        <div class="uncontrolled-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
        <div class="uncontrolled-info">
          <h3>Capture Restricted</h3>
          <p>Chrome protects system pages and the Web Store from media tab capture.</p>
        </div>
      </div>
    `;
  } else if (!isCaptured) {
    const title = tab.title || 'Active Tab';
    const favIcon = tab.favIconUrl || DEFAULT_FAVICON;
    activeTabContainer.innerHTML = `
      <div class="uncontrolled-card">
        <div class="uncontrolled-icon">
          <img src="${favIcon}" class="tab-favicon" alt="favicon">
        </div>
        <div class="uncontrolled-info">
          <h3 class="tab-title" style="max-width: 280px; margin: 0 auto 4px auto;">${escapeHtml(title)}</h3>
          <p>Stereo balance and volume amplifications are disabled for this tab.</p>
        </div>
        <button id="btn-enable-capture" class="btn-primary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v1a7 7 0 0 1-14 0v-1"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
          Enable Stereo Control
        </button>
      </div>
    `;

    document.getElementById('btn-enable-capture').addEventListener('click', () => startTabCapture(tab));
  } else {
    const config = capturedTabs[tab.id];
    activeTabContainer.innerHTML = renderControlCard(config, true);
    bindCardEvents(config, true);
  }

  // Render secondary controlled tabs
  const otherTabIds = Object.keys(capturedTabs).filter(id => parseInt(id) !== tab.id);

  if (otherTabIds.length > 0) {
    otherTabsSection.style.display = 'block';
    otherTabsList.innerHTML = '';
    otherTabIds.forEach(id => {
      const config = capturedTabs[id];
      const cardDiv = document.createElement('div');
      cardDiv.className = 'other-tab-card';
      cardDiv.innerHTML = renderControlCard(config, false);
      otherTabsList.appendChild(cardDiv);
      bindCardEvents(config, false);
    });
  } else {
    otherTabsSection.style.display = 'none';
  }
}

// Generate control card template
function renderControlCard(config, isActiveTab) {
  const { tabId, title, favIconUrl, pan, volume, isMuted, isMono } = config;
  const favicon = favIconUrl || DEFAULT_FAVICON;

  let panText = 'Center';
  if (isMono) {
    panText = 'Mono Mode';
  } else if (pan < 0) {
    panText = pan === -1 ? 'Left Only' : `L ${Math.round(Math.abs(pan) * 100)}%`;
  } else if (pan > 0) {
    panText = pan === 1 ? 'Right Only' : `R ${Math.round(pan * 100)}%`;
  }

  const volPercent = Math.round(volume * 100);

  const muteClass = isMuted ? 'active' : '';
  const monoClass = isMono ? 'active' : '';

  const muteIcon = isMuted
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v6a3 3 0 0 0 3 3h1.586l4.707 4.707A1 1 0 0 0 20 22V4a1 1 0 0 0-1.707-.707L13.586 8H12a3 3 0 0 0-3 3z"></path></svg>`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;

  const presetLeftActive = pan === -1 && !isMono ? 'active' : '';
  const presetCenterActive = pan === 0 && !isMono ? 'active' : '';
  const presetRightActive = pan === 1 && !isMono ? 'active' : '';
  const maxVol = appSettings.maxVolume || 2.0;

  return `
    <div class="${isActiveTab ? 'controlled-card' : 'other-tab-card-inner'}">
      <div class="tab-header">
        <div class="tab-info-block">
          <img src="${favicon}" class="tab-favicon" alt="favicon">
          <span class="tab-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
        </div>
        <button class="btn-icon btn-release" data-tab-id="${tabId}" title="Release Control" aria-label="Release Control">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="audio-controls">
        <!-- Balance Slider -->
        <div class="slider-group balance-group">
          <div class="slider-label-row">
            <span>Stereo Panner</span>
            <span class="slider-value" id="pan-val-${tabId}">${panText}</span>
          </div>
          <div class="slider-input-container balance-slider-container">
            <input type="range" id="pan-slider-${tabId}" min="-1" max="1" step="0.05" value="${pan}" ${isMono ? 'disabled' : ''}>
          </div>
          <!-- Quick Balance Presets -->
          <div class="balance-presets">
            <button class="btn-preset ${presetLeftActive}" data-preset="-1" data-tab-id="${tabId}">Left</button>
            <button class="btn-preset ${presetCenterActive}" data-preset="0" data-tab-id="${tabId}">Center</button>
            <button class="btn-preset ${presetRightActive}" data-preset="1" data-tab-id="${tabId}">Right</button>
          </div>
        </div>

        <!-- Volume Slider -->
        <div class="slider-group volume-group">
          <div class="slider-label-row">
            <span>Volume Amplification</span>
            <span class="slider-value" id="vol-val-${tabId}">${volPercent}%</span>
          </div>
          <div class="slider-input-container">
            <input type="range" id="vol-slider-${tabId}" min="0" max="${maxVol}" step="0.05" value="${volume}">
          </div>
        </div>
      </div>

      <div class="card-actions">
        <button class="btn-secondary btn-mute ${muteClass}" id="btn-mute-${tabId}" data-tab-id="${tabId}">
          ${muteIcon}
          <span>${isMuted ? 'Unmute' : 'Mute'}</span>
        </button>
        <button class="btn-secondary btn-mono ${monoClass}" id="btn-mono-${tabId}" data-tab-id="${tabId}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 3v18"></path></svg>
          <span>Mono</span>
        </button>
        <button class="btn-secondary btn-reset" id="btn-reset-${tabId}" data-tab-id="${tabId}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
          Reset
        </button>
      </div>
    </div>
  `;
}

// Event binding logic
function bindCardEvents(config, isActiveTab) {
  const { tabId } = config;

  const panSlider = document.getElementById(`pan-slider-${tabId}`);
  const volSlider = document.getElementById(`vol-slider-${tabId}`);
  const muteBtn = document.getElementById(`btn-mute-${tabId}`);
  const monoBtn = document.getElementById(`btn-mono-${tabId}`);
  const resetBtn = document.getElementById(`btn-reset-${tabId}`);
  const releaseBtns = document.querySelectorAll(`.btn-release[data-tab-id="${tabId}"]`);
  const presetBtns = document.querySelectorAll(`.btn-preset[data-tab-id="${tabId}"]`);

  if (panSlider) {
    panSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      updatePanLabel(tabId, val, false);
      updatePresetActiveState(tabId, val);

      chrome.runtime.sendMessage({
        type: 'SET_AUDIO_PARAMS',
        tabId,
        pan: val
      });
    });
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const presetVal = parseFloat(btn.getAttribute('data-preset'));
      if (panSlider) panSlider.value = presetVal;
      updatePanLabel(tabId, presetVal, false);
      updatePresetActiveState(tabId, presetVal);

      chrome.runtime.sendMessage({
        type: 'SET_AUDIO_PARAMS',
        tabId,
        pan: presetVal,
        isMono: false
      });

      if (monoBtn) {
        monoBtn.classList.remove('active');
      }
      if (panSlider) panSlider.disabled = false;
    });
  });

  if (volSlider) {
    volSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      const label = document.getElementById(`vol-val-${tabId}`);
      if (label) label.innerText = `${Math.round(val * 100)}%`;

      chrome.runtime.sendMessage({
        type: 'SET_AUDIO_PARAMS',
        tabId,
        volume: val
      });
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', async () => {
      const { capturedTabs = {} } = await chrome.storage.session.get('capturedTabs');
      const tabConfig = capturedTabs[tabId];
      if (tabConfig) {
        const nextMuted = !tabConfig.isMuted;
        muteBtn.classList.toggle('active', nextMuted);
        
        if (nextMuted) {
          muteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v6a3 3 0 0 0 3 3h1.586l4.707 4.707A1 1 0 0 0 20 22V4a1 1 0 0 0-1.707-.707L13.586 8H12a3 3 0 0 0-3 3z"></path></svg> <span>Unmute</span>`;
        } else {
          muteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg> <span>Mute</span>`;
        }

        await chrome.runtime.sendMessage({
          type: 'SET_AUDIO_PARAMS',
          tabId,
          isMuted: nextMuted
        });
      }
    });
  }

  if (monoBtn) {
    monoBtn.addEventListener('click', async () => {
      const { capturedTabs = {} } = await chrome.storage.session.get('capturedTabs');
      const tabConfig = capturedTabs[tabId];
      if (tabConfig) {
        const nextMono = !tabConfig.isMono;
        monoBtn.classList.toggle('active', nextMono);

        if (panSlider) panSlider.disabled = nextMono;
        updatePanLabel(tabId, tabConfig.pan, nextMono);

        await chrome.runtime.sendMessage({
          type: 'SET_AUDIO_PARAMS',
          tabId,
          isMono: nextMono
        });
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (panSlider) {
        panSlider.value = 0;
        panSlider.disabled = false;
      }
      if (volSlider) volSlider.value = 1.0;

      updatePanLabel(tabId, 0, false);
      updatePresetActiveState(tabId, 0);

      const volLabel = document.getElementById(`vol-val-${tabId}`);
      if (volLabel) volLabel.innerText = '100%';

      if (muteBtn) {
        muteBtn.classList.remove('active');
        muteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg> <span>Mute</span>`;
      }

      if (monoBtn) {
        monoBtn.classList.remove('active');
      }

      chrome.runtime.sendMessage({
        type: 'SET_AUDIO_PARAMS',
        tabId,
        pan: 0.0,
        volume: 1.0,
        isMuted: false,
        isMono: false
      });
    });
  }

  releaseBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({
        type: 'STOP_CAPTURE',
        tabId
      });
      await renderUI();
    });
  });
}

function updatePanLabel(tabId, val, isMono) {
  const label = document.getElementById(`pan-val-${tabId}`);
  if (!label) return;

  if (isMono) {
    label.innerText = 'Mono Mode';
  } else if (val === 0) {
    label.innerText = 'Center';
  } else if (val < 0) {
    label.innerText = val === -1 ? 'Left Only' : `L ${Math.round(Math.abs(val) * 100)}%`;
  } else {
    label.innerText = val === 1 ? 'Right Only' : `R ${Math.round(val * 100)}%`;
  }
}

function updatePresetActiveState(tabId, currentPan) {
  const presetBtns = document.querySelectorAll(`.btn-preset[data-tab-id="${tabId}"]`);
  presetBtns.forEach(btn => {
    const val = parseFloat(btn.getAttribute('data-preset'));
    btn.classList.toggle('active', val === currentPan);
  });
}

// Start tab capture
async function startTabCapture(tab) {
  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    if (!streamId) {
      console.error('Failed to get media stream ID');
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'START_CAPTURE',
      tabId: tab.id,
      streamId: streamId,
      title: tab.title,
      favIconUrl: tab.favIconUrl
    });

    if (response && response.success) {
      await renderUI();
    } else {
      console.error('Capture start failed:', response ? response.error : 'Unknown error');
    }
  } catch (error) {
    console.error('Error starting tab capture:', error);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', init);
