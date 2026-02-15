**🇨🇳 中文 | [🇬🇧 English](./README_EN.md)**

---

<p align="center">
  <h1 align="center">📖 BiReader</h1>
  <p align="center">
    <strong>双语 EPUB 翻译阅读器</strong><br/>
    逐句中英对照 · 多种显示模式 · 整书翻译导出 · macOS & Windows 桌面应用
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/版本-0.1.0--beta-blue" alt="version" />
    <img src="https://img.shields.io/badge/平台-macOS%20%7C%20Windows-lightgrey" alt="platform" />
    <img src="https://img.shields.io/badge/许可证-MIT-green" alt="license" />
  </p>
</p>

---

## ✨ 功能特性

- **📚 EPUB 解析** — 加载任意 `.epub` 文件，侧边栏目录导航
- **🔤 逐句双语对照** — 每个句子下方紧跟翻译，原文与译文紧密对应
- **🌍 3 种显示模式** — 双语对照、仅译文、仅原文，一键切换
- **📥 整书翻译导出** — 翻译整本书并下载双语 `.epub` 文件
- **🎨 3 种主题** — 亮色 ☀️、护眼褐色 📖、暗色 🌙
- **🔠 字体选择器** — 提供微软雅黑、苹方、宋体、楷体、思源黑体、Georgia、Arial 等 8 种字体
- **🔌 多引擎翻译** — 支持豆包和硅基流动翻译 API
- **💾 翻译缓存** — 译文自动缓存在本地，不重复调用 API
- **⚡ 智能断句** — 正确处理编号列表（1. 2.）、小数（3.14）、缩写（Mr. Dr.）

## 🚀 快速开始

### 浏览器运行（开发模式）

```bash
# 克隆仓库
git clone https://github.com/liquidsax/bireader.git
cd bireader

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开 `http://localhost:3000`，上传 EPUB 文件即可使用。

### 桌面应用运行

```bash
# 构建并启动 Electron 应用
npm run electron:dev
```

### 构建安装包

```bash
npm run dist:mac    # macOS（.dmg，支持 Intel + Apple Silicon）
npm run dist:win    # Windows（.exe 安装版 + 便携版）
npm run dist:all    # 同时构建两个平台
```

构建产物在 `release/` 目录下。

## ⚙️ 设置说明

点击右上角 ⚙️ 设置按钮进行配置：

| 设置项 | 说明 |
|--------|------|
| **翻译引擎** | 选择豆包或硅基流动 |
| **API Key** | 对应引擎的 API 密钥 |
| **模型** | DeepSeek-V3、Qwen2.5、GLM-4 等 |
| **源语言 / 目标语言** | 英语、日语、韩语、法语、德语、西语 → 简体中文、繁体中文等 |
| **翻译风格** | 信达雅（忠实原文）、自然流畅（意译优先）、学术严谨、文学优美 |
| **阅读字体** | 8 种字体任选 |

### 支持的翻译 API

| 引擎 | 接口地址 | 可用模型 |
|------|----------|----------|
| **豆包** | `https://ark.cn-beijing.volces.com/api/v3` | 自定义 Endpoint ID |
| **硅基流动** | `https://api.siliconflow.cn/v1` | DeepSeek-V3、Qwen2.5-72B、GLM-4 等 |

两个引擎均使用 OpenAI 兼容的 `/v1/chat/completions` 格式，任何兼容的 API 都可以接入。

## 🏗️ 项目结构

```
epub-reader/
├── electron/
│   └── main.cjs            # Electron 主进程
├── src/
│   ├── lib/
│   │   ├── epubParser.js    # EPUB 加载与段落提取
│   │   ├── reader.js        # 逐句双语渲染
│   │   ├── translator.js    # API 调用与翻译缓存
│   │   ├── bookTranslator.js # 整书翻译 + EPUB 导出
│   │   └── settings.js      # 设置管理（localStorage）
│   ├── main.js              # 应用入口与 UI 逻辑
│   └── style.css            # 设计系统与样式
├── index.html               # 单页应用
├── vite.config.js            # Vite 构建配置
└── package.json              # 依赖与 Electron 打包配置
```

### 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | 原生 JavaScript + CSS（无框架） |
| **EPUB 解析** | [epub.js](https://github.com/futurepress/epub.js) |
| **构建工具** | [Vite](https://vitejs.dev/) |
| **桌面应用** | [Electron](https://www.electronjs.org/) |
| **打包工具** | [electron-builder](https://www.electron.build/) |
| **EPUB 导出** | [JSZip](https://stuk.github.io/jszip/) |

## 📖 使用指南

### 阅读 EPUB

1. 点击拖放区域或拖入 `.epub` 文件
2. 通过侧边栏（☰）或 ← → 方向键切换章节
3. 点击任意句子可单独翻译该句
4. 点击 **「翻译本章」** 翻译整章内容
5. 使用显示模式切换按钮在 双语 / 仅译文 / 仅原文 之间切换

### 整书翻译

1. 点击工具栏的 📖+ 按钮
2. 点击 **「开始翻译」**，进度条实时显示翻译进度
3. 翻译完成后自动下载双语 `.epub` 文件
4. 导出的 EPUB 中每段都包含原文 + 译文

### 快捷键

| 按键 | 功能 |
|------|------|
| `←` | 上一章 |
| `→` | 下一章 |
| `Ctrl/⌘ + T` | 翻译当前章节 |
| `Esc` | 关闭侧边栏 / 设置面板 |

## 🤝 参与贡献

欢迎贡献！以下是一些可以改进的方向：

- [ ] 应用图标设计（目前使用 Electron 默认图标）
- [ ] macOS / Windows 代码签名
- [ ] 更多翻译引擎支持（Google、DeepL、OpenAI）
- [ ] 阅读进度记忆
- [ ] 书签与高亮功能
- [ ] 自动更新机制

## 📄 许可证

MIT © BiReader Team
