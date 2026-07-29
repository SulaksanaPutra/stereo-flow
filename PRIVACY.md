# Privacy Policy for StereoFlow

> Last Updated: July 28, 2026

**StereoFlow** ("we", "our", or "the extension") is committed to protecting your privacy. This Privacy Policy explains our data handling practices for the StereoFlow Chrome extension.

## 1. Zero Data Collection

StereoFlow does **NOT** collect, store, transmit, track, or share any personal information, browsing history, audio content, URLs, or telemetry data. 

All audio processing (stereo panning, volume amplification, and limiter clipping protection) is performed **100% locally** on your machine using standard Web Audio APIs inside your browser sandbox.

## 2. Local Storage Usage

StereoFlow uses standard Chrome storage APIs (`chrome.storage.local`, `chrome.storage.sync`, and `chrome.storage.session`) strictly for local extension functionality:
- `chrome.storage.sync`: Saves your local appearance theme preference (Auto, Light, or Dark), maximum volume amplification limit setting, clipping limiter preference, and optional domain-specific audio presets.
- `chrome.storage.session`: Temporarily holds tab capture IDs during your active browser session so controls reflect your active tabs. This session data is automatically destroyed when the browser closes.

None of this storage data ever leaves your device.

## 3. Chrome Permissions

StereoFlow requests only essential permissions required to deliver tab audio control:
- `tabCapture`: Enables capturing the tab's audio stream for local Web Audio processing.
- `offscreen`: Enables hosting the local Web Audio processing context in the background.
- `storage`: Saves user settings and active session state locally.
- `tabs` & `activeTab`: Retrieves tab titles and favicons for display in the extension control popup.

## 4. Third-Party Services

StereoFlow does **NOT** contain third-party tracking scripts, analytics, advertising frameworks, or remote code execution.

## 5. Contact Information

If you have questions about this Privacy Policy, please contact us:
- **Developer:** Bayu Aksana
- **Website:** [https://bayuaksana.com/](https://bayuaksana.com/)
- **Support Email:** [info@bayuaksana.com](mailto:info@bayuaksana.com)
- **GitHub Repository:** [https://github.com/SulaksanaPutra/stereo-flow](https://github.com/SulaksanaPutra/stereo-flow)
