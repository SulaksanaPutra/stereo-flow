# StereoFlow — Audio Balance & Volume Controller

> Independent per-tab stereo panning, volume amplification up to 300% with peak clipping protection, mono audio downmixing, and automatic Dark/Light theme mode.

---

## Features

- **Per-Tab Audio Independence:** Adjust stereo balance and volume levels for each browser tab individually without affecting other tabs or system audio.
- **Automatic Dark & Light Theme:** Automatically matches your OS device appearance (`prefers-color-scheme`) with manual overrides (`Auto` | `Light` | `Dark`).
- **Smooth Stereo Panning:** Left-to-right audio panner from 100% Left to 100% Right with 1-click quick presets (`Left`, `Center`, `Right`).
- **Volume Amplification (Up to 300%):** Boost quiet video or audio tracks smoothly up to 300% volume.
- **Clipping Protection (Dynamics Compressor):** Built-in peak limiter prevents digital audio crackle or harsh distortion at high gain levels.
- **Mono Audio Mode:** 1-click mono downmix toggle for single-earbud or accessibility listening.
- **Per-Site Settings Memory:** Optionally remembers balance and volume preferences per domain across browser sessions.
- **Manifest V3 Production Engine:** Built with high-performance offscreen audio contexts and atomic lifecycle guards.

---

## Installation

### Chrome Web Store (Recommended)
Install directly from the [Chrome Web Store](https://chromewebstore.google.com).

### Manual Developer Installation (Unpacked)
1. Clone or download this repository:
   ```bash
   git clone https://github.com/SulaksanaPutra/stereo-flow.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** and select the cloned `stereo-flow` project folder.
5. Click the **StereoFlow** icon in your extension toolbar to start controlling tab audio!

---

## Architecture & Web Audio Graph

StereoFlow processes audio locally using the Web Audio API inside an offscreen document context:

```
[ Active Browser Tab ]
         │
  (tabCapture API)
         ▼
[ MediaStreamSource ]
         │
         ▼
  [ StereoPannerNode ]  ──>  (Pan: -1.0 to +1.0 or 0.0 Mono)
         │
         ▼
    [ GainNode ]        ──>  (Volume: 0.0 to 3.0)
         │
         ▼
[ DynamicsCompressor ]  ──>  (Clipping Protection: -1dB / -3dB)
         │
         ▼
 [ Audio Destination ]  ──>  (Headphones / Speakers)
```

---

## Testing

StereoFlow includes a zero-dependency unit test suite using Node.js's native test runner (`node:test`):

```bash
npm test
```

---

## Privacy Policy

StereoFlow processes all audio 100% locally on your device. We do **not** collect, store, or transmit any audio content, browsing history, or personal data. Read our full [PRIVACY.md](PRIVACY.md).

---

## Developer & Contact

- **Developer:** [Bayu Aksana](https://bayuaksana.com/)
- **Website:** [bayuaksana.com](https://bayuaksana.com/)
- **Email:** [info@bayuaksana.com](mailto:info@bayuaksana.com)
- **GitHub Profile:** [github.com/SulaksanaPutra](https://github.com/SulaksanaPutra)
- **Repository:** [https://github.com/SulaksanaPutra/stereo-flow](https://github.com/SulaksanaPutra/stereo-flow)

---

## License

[MIT License](LICENSE) © 2026 Bayu Aksana
