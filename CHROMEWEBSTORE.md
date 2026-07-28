# Chrome Web Store Listing — Stereo Balance & Volume Controller (StereoFlow)

> Last Updated: 2026-07-28

## Store Listing

**Extension Name** [REQUIRED]
Stereo Balance & Volume Controller (StereoFlow)

**Short Description** [REQUIRED]
Adjust audio balance (left/right panning), volume amplification up to 300%, and mono audio independently for each browser tab.

**Detailed Description** [REQUIRED]
StereoFlow lets you control the stereo balance (left/right panning) and volume level of individual browser tabs independently.

Features:
- Independent audio control for each browser tab.
- Automatic System Theme support (Dark & Light Mode) with OS prefers-color-scheme sync.
- Smooth left-to-right stereo panning from 100% Left to 100% Right with Quick Balance Presets (Left, Center, Right).
- Volume amplification boosting up to 300% with built-in DynamicsCompressor limiter to eliminate digital audio clipping.
- Mono Audio Mode toggle for single-earbud or accessibility listening.
- Per-site domain settings memory auto-saves your preferences across browser sessions.
- One-click mute/unmute buttons and settings reset.
- Modern minimalist UI design system with no neon glow artifacts.
- Auto-releases browser resources when tabs are closed or reloaded.

How to use:
1. Click the StereoFlow icon in your extension toolbar to open the control panel.
2. Click the "Enable Stereo Control" button on the active tab card.
3. Drag the "Stereo Panner" slider left or right or click quick presets (Left, Center, Right) to adjust audio balance in your headphones.
4. Drag the "Volume Amplification" slider to boost or lower volume smoothly up to 300%.
5. Toggle "Mono" mode if you need combined audio in both ears.
6. Click the Settings gear icon to customize volume ceiling, limiter protection threshold, or reset all tab settings.

Privacy and Permissions:
This extension captures tab audio to apply panning effects locally on your machine. We do not collect, store, or transmit any user data, web browsing history, or audio content. All processing is 100% local and private.

For support or feedback, please visit our GitHub repository or personal website.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Adjusts the audio balance, volume level, and mono downmixing independently for each browser tab.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon-128.png` |
| Small Icon | 16×16 PNG | ✅ Ready | `icons/icon-16.png` |
| Medium Icon | 48×48 PNG | ✅ Ready | `icons/icon-48.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `tabCapture` | permissions | Allows the extension to capture the active tab's audio stream so it can be routed through Web Audio API panning nodes and dynamic limiter. |
| `offscreen` | permissions | Enables creating an offscreen document to host the Web Audio API processing context, ensuring continuous audio playback and panning when the popup menu is closed. |
| `storage` | permissions | Required to temporarily persist active capture settings, pan/volume states, domain memory, and user theme preferences (`chrome.storage.sync` & `chrome.storage.session`). |
| `tabs` | permissions | Needed to retrieve tab titles, URLs, and favicon metadata for display in the popup dashboard interface. |
| `activeTab` | permissions | Allows the user to grant authorization for capturing the active tab's audio stream when clicking the extension button. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [RECOMMENDED]
https://github.com/SulaksanaPutra/stereo-flow/blob/main/PRIVACY.md

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

## Developer Info

**Publisher Name** [REQUIRED]
Bayu Aksana

**Website** [RECOMMENDED]
https://bayuaksana.com/

**Contact Email** [REQUIRED]
info@bayuaksana.com

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-06-04 | Initial Release | Draft |
| 1.1.0 | 2026-07-28 | Added Dark/Light Mode with System Auto sync, Modern Minimalist UI design system, Audio Limiter (Clipping protection), Quick Balance Presets, Mono Audio mode, Settings Modal, Domain Memory, unit tests, and fresh icon set | Production Ready |

## Review Notes

### Known Issues / Limitations
- Autoplay permissions apply to tab capture playback. Tab captures must be explicitly initiated via the user clicking the "Enable Stereo Control" button inside the popup.
- System pages (`chrome://*`, etc.) and the Chrome Web Store are protected by Chrome security policies and cannot be captured.
