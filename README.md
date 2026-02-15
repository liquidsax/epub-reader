<p align="center">
  <h1 align="center">📖 BiReader</h1>
  <p align="center">
    <strong>A bilingual EPUB translation reader</strong><br/>
    逐句中英对照 · 多种显示模式 · 整书翻译导出 · macOS & Windows 桌面应用
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/version-0.1.0--beta-blue" alt="version" />
    <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey" alt="platform" />
    <img src="https://img.shields.io/badge/license-MIT-green" alt="license" />
  </p>
</p>

---

## ✨ Features

- **📚 EPUB Parsing** — Load any `.epub` file, navigate chapters with sidebar TOC
- **🔤 Sentence-by-Sentence Bilingual Display** — Each sentence shows original + translation side by side
- **🌍 3 Display Modes** — Bilingual (对照), Translation Only (仅译文), Original Only (仅原文)
- **📥 Full-Book Translation & Export** — Translate the entire book and download a bilingual `.epub`
- **🎨 3 Themes** — Light ☀️, Sepia 📖 (eye-care), Dark 🌙
- **🔠 Font Selector** — Choose from 8 fonts including 微软雅黑, 苹方, 宋体, 楷体, Georgia, Arial
- **🔌 Multi-Engine API** — Supports Doubao (豆包) and SiliconFlow (硅基流动) translation APIs
- **💾 Translation Cache** — Cached in localStorage, no repeated API calls
- **⚡ Smart Sentence Splitting** — Handles numbered lists (1. 2.), decimals (3.14), abbreviations (Mr. Dr.)

## 🖥️ Screenshots

> *Coming soon — feel free to contribute screenshots!*

## 🚀 Quick Start

### Run in Browser (Development)

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/bireader.git
cd bireader

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open `http://localhost:3000` and upload an EPUB file.

### Run as Desktop App

```bash
# Build and launch with Electron
npm run electron:dev
```

### Build Installers

```bash
# macOS (.dmg for Intel + Apple Silicon)
npm run dist:mac

# Windows (.exe installer + portable)
npm run dist:win

# Both platforms
npm run dist:all
```

Output files will be in the `release/` directory.

## ⚙️ Configuration

Click the ⚙️ Settings button (top-right) to configure:

| Setting | Description |
|---------|-------------|
| **Translation Engine** | Choose between 豆包 (Doubao) or 硅基流动 (SiliconFlow) |
| **API Key** | Your API key for the selected engine |
| **Model** | DeepSeek-V3, Qwen2.5, GLM-4 etc. |
| **Source / Target Language** | English, Japanese, Korean, French, German, Spanish → 简体中文, 繁體中文, etc. |
| **Translation Style** | 信达雅 (Faithful), 自然流畅 (Natural), 学术严谨 (Academic), 文学优美 (Literary) |
| **Reading Font** | 8 font options for the reading area |

### Supported Translation APIs

| Engine | Endpoint | Models |
|--------|----------|--------|
| **豆包 (Doubao)** | `https://ark.cn-beijing.volces.com/api/v3` | Custom endpoint ID |
| **硅基流动 (SiliconFlow)** | `https://api.siliconflow.cn/v1` | DeepSeek-V3, Qwen2.5-72B, GLM-4, etc. |

Both use the OpenAI-compatible `/v1/chat/completions` format — any compatible API can work.

## 🏗️ Architecture

```
epub-reader/
├── electron/
│   └── main.cjs            # Electron main process
├── src/
│   ├── lib/
│   │   ├── epubParser.js    # EPUB loading & paragraph extraction
│   │   ├── reader.js        # Sentence-level bilingual rendering
│   │   ├── translator.js    # API calls & translation caching
│   │   ├── bookTranslator.js # Full-book translation + EPUB export
│   │   └── settings.js      # Settings management (localStorage)
│   ├── main.js              # App entry point & UI wiring
│   └── style.css            # Design system & all styles
├── index.html               # Single-page application
├── vite.config.js            # Vite build config
└── package.json              # Dependencies & Electron build config
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JavaScript + CSS (no framework) |
| **EPUB Parsing** | [epub.js](https://github.com/futurepress/epub.js) |
| **Build Tool** | [Vite](https://vitejs.dev/) |
| **Desktop App** | [Electron](https://www.electronjs.org/) |
| **Packaging** | [electron-builder](https://www.electron.build/) |
| **EPUB Export** | [JSZip](https://stuk.github.io/jszip/) |

## 📖 Usage Guide

### Reading an EPUB

1. Click the drop zone or drag & drop an `.epub` file
2. Navigate chapters using the sidebar (☰) or arrow keys ← →
3. Click any sentence to translate it individually
4. Click **"翻译本章"** to translate the entire chapter
5. Use the display mode toggle to switch between bilingual / translation-only / original-only

### Full-Book Translation

1. Click the 📖+ button in the toolbar
2. Click **"开始翻译"** — progress bar shows chapter-by-chapter status
3. When complete, a bilingual `.epub` file auto-downloads
4. The exported EPUB contains original + translated text for every paragraph

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` | Previous chapter |
| `→` | Next chapter |
| `Ctrl/⌘ + T` | Translate current chapter |
| `Esc` | Close sidebar / settings |

## 🤝 Contributing

Contributions are welcome! Here are some areas that could use help:

- [ ] App icon design (currently using Electron default)
- [ ] macOS / Windows code signing
- [ ] More translation engine support (Google, DeepL, OpenAI)
- [ ] Reading progress persistence
- [ ] Bookmarks & highlights
- [ ] Auto-update mechanism

## 📄 License

MIT © BiReader Team
