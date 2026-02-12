/**
 * BiRead — EPUB 双语翻译阅读器
 * Main Entry Point
 * Wires together the UI, EPUB parser, reader, and settings
 */

import './style.css';
import { loadBook, getChapters, getChapterContent, getChapterCount, getBookId } from './lib/epubParser.js';
import { initReader, renderChapter, translateCurrentChapter, cancelTranslation } from './lib/reader.js';
import { loadSettings, saveSettings, isConfigured, getCacheStats, clearCache } from './lib/settings.js';

// ============================================================
// DOM Elements
// ============================================================
const $ = (id) => document.getElementById(id);

const uploadScreen = $('upload-screen');
const readerScreen = $('reader-screen');
const dropZone = $('drop-zone');
const fileInput = $('file-input');
const bookTitle = $('book-title');
const sidebar = $('sidebar');
const sidebarOverlay = $('sidebar-overlay');
const tocList = $('toc-list');
const chapterContent = $('chapter-content');
const chapterIndicator = $('chapter-indicator');
const settingsModal = $('settings-modal');
const translationToast = $('translation-toast');
const toastText = $('toast-text');
const cacheInfo = $('cache-info');

// Buttons
const btnSidebarToggle = $('btn-sidebar-toggle');
const btnSidebarClose = $('btn-sidebar-close');
const btnTranslateChapter = $('btn-translate-chapter');
const btnThemeToggle = $('btn-theme-toggle');
const btnSettings = $('btn-settings');
const btnSettingsClose = $('btn-settings-close');
const btnSettingsSave = $('btn-settings-save');
const btnBack = $('btn-back');
const btnPrevChapter = $('btn-prev-chapter');
const btnNextChapter = $('btn-next-chapter');
const btnClearCache = $('btn-clear-cache');
const btnCancelTranslate = $('btn-cancel-translate');

// Engine tabs
const engineTabs = document.querySelectorAll('.engine-tab');
const doubaoSettings = $('doubao-settings');
const siliconflowSettings = $('siliconflow-settings');

// ============================================================
// State
// ============================================================
let currentChapterIndex = 0;
let bookMeta = null;
let isTranslating = false;
let currentDisplayMode = localStorage.getItem('biread_display_mode') || 'bilingual';

// ============================================================
// Theme
// ============================================================
function initTheme() {
    const saved = localStorage.getItem('biread_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('biread_theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    // Update icons on both upload and reader screens
    document.querySelectorAll('[class*="icon-sun"]').forEach(el => {
        el.style.display = theme === 'dark' ? 'none' : 'block';
    });
    document.querySelectorAll('[class*="icon-moon"]').forEach(el => {
        el.style.display = theme === 'dark' ? 'block' : 'none';
    });
}

// ============================================================
// File Upload
// ============================================================
function setupFileUpload() {
    // Click to select
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });

    // Drag & drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.epub')) {
            handleFile(file);
        }
    });

    // Prevent default drag on body
    document.body.addEventListener('dragover', (e) => e.preventDefault());
    document.body.addEventListener('drop', (e) => e.preventDefault());
}

async function handleFile(file) {
    try {
        dropZone.style.opacity = '0.6';
        dropZone.style.pointerEvents = 'none';

        const buffer = await file.arrayBuffer();
        bookMeta = await loadBook(buffer);

        bookTitle.textContent = bookMeta.title;
        document.title = `${bookMeta.title} — BiRead`;

        // Build TOC
        buildTOC();

        // Switch to reader screen
        uploadScreen.classList.remove('active');
        readerScreen.classList.add('active');

        // Load first chapter
        await loadChapter(0);
    } catch (err) {
        alert(`加载 EPUB 失败: ${err.message}`);
        dropZone.style.opacity = '1';
        dropZone.style.pointerEvents = 'auto';
    }
}

// ============================================================
// TOC
// ============================================================
function buildTOC() {
    tocList.innerHTML = '';
    const chapters = getChapters();

    chapters.forEach((ch) => {
        const btn = document.createElement('button');
        btn.className = 'toc-item';
        btn.textContent = ch.label;
        btn.dataset.index = ch.index;

        btn.addEventListener('click', () => {
            loadChapter(ch.index);
            closeSidebar();
        });

        tocList.appendChild(btn);
    });
}

function updateTOCActive() {
    tocList.querySelectorAll('.toc-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.index) === currentChapterIndex);
    });
}

// ============================================================
// Chapter Loading
// ============================================================
async function loadChapter(index) {
    try {
        currentChapterIndex = index;

        // Show loading state
        chapterContent.innerHTML = '<div class="bi-loading" style="margin: 2rem auto;">加载中...</div>';

        const chapter = await getChapterContent(index);
        const total = getChapterCount();

        // Initialize reader if needed
        initReader(chapterContent, null);

        // Render
        renderChapter(chapter.paragraphs, index);

        // Update navigation
        chapterIndicator.textContent = `${index + 1} / ${total}`;
        btnPrevChapter.disabled = index <= 0;
        btnNextChapter.disabled = index >= total - 1;

        // Update TOC active state
        updateTOCActive();

        // Scroll to top
        window.scrollTo(0, 0);
    } catch (err) {
        chapterContent.innerHTML = `<p style="color: var(--danger); padding: 2rem;">加载章节失败: ${err.message}</p>`;
    }
}

// ============================================================
// Translation
// ============================================================
async function startTranslation() {
    if (isTranslating) return;

    if (!isConfigured()) {
        openSettings();
        return;
    }

    isTranslating = true;

    // Show toast
    translationToast.classList.add('active');
    toastText.textContent = '准备翻译...';

    try {
        // Set up progress tracking via MutationObserver on the container
        const paragraphs = chapterContent.querySelectorAll('.bi-paragraph[data-index]');
        const total = paragraphs.length;

        // Override progress tracking
        initReader(chapterContent, (translated, t) => {
            toastText.textContent = `翻译中... ${translated}/${t}`;
        });

        await translateCurrentChapter();

        toastText.textContent = '翻译完成！';
        setTimeout(() => {
            translationToast.classList.remove('active');
        }, 2000);

        // Mark chapter as translated in TOC
        const tocItem = tocList.querySelector(`[data-index="${currentChapterIndex}"]`);
        if (tocItem) tocItem.classList.add('translated');
    } catch (err) {
        if (err.name !== 'AbortError') {
            toastText.textContent = `翻译出错: ${err.message}`;
            setTimeout(() => {
                translationToast.classList.remove('active');
            }, 3000);
        }
    } finally {
        isTranslating = false;
    }
}

function stopTranslation() {
    cancelTranslation();
    isTranslating = false;
    translationToast.classList.remove('active');
}

// ============================================================
// Sidebar
// ============================================================
function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
}

// ============================================================
// Settings Modal
// ============================================================
function openSettings() {
    const settings = loadSettings();

    // Fill form
    $('doubao-key').value = settings.doubao.apiKey;
    $('doubao-endpoint').value = settings.doubao.endpoint;
    $('doubao-model').value = settings.doubao.model;
    $('sf-key').value = settings.siliconflow.apiKey;
    $('sf-endpoint').value = settings.siliconflow.endpoint;
    $('sf-model').value = settings.siliconflow.model;
    $('source-lang').value = settings.sourceLang;
    $('target-lang').value = settings.targetLang;
    $('translation-style').value = settings.translationStyle;

    // Set active engine tab
    setActiveEngine(settings.engine);

    // Update cache info
    updateCacheInfo();

    settingsModal.classList.add('active');
}

function closeSettings() {
    settingsModal.classList.remove('active');
}

function setActiveEngine(engine) {
    engineTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.engine === engine);
    });
    doubaoSettings.style.display = engine === 'doubao' ? 'block' : 'none';
    siliconflowSettings.style.display = engine === 'siliconflow' ? 'block' : 'none';
}

function saveCurrentSettings() {
    const activeEngine = document.querySelector('.engine-tab.active').dataset.engine;

    const settings = {
        engine: activeEngine,
        doubao: {
            apiKey: $('doubao-key').value.trim(),
            endpoint: $('doubao-endpoint').value.trim(),
            model: $('doubao-model').value.trim()
        },
        siliconflow: {
            apiKey: $('sf-key').value.trim(),
            endpoint: $('sf-endpoint').value.trim(),
            model: $('sf-model').value
        },
        sourceLang: $('source-lang').value,
        targetLang: $('target-lang').value,
        translationStyle: $('translation-style').value
    };

    saveSettings(settings);
    closeSettings();
}

function updateCacheInfo() {
    const stats = getCacheStats();
    const sizeKB = (stats.bytes / 1024).toFixed(1);
    cacheInfo.textContent = `已缓存 ${stats.count} 条翻译，占用 ${sizeKB} KB`;
}

// ============================================================
// Event Listeners
// ============================================================
function setupEventListeners() {
    // Sidebar
    btnSidebarToggle.addEventListener('click', openSidebar);
    btnSidebarClose.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    // Translation
    btnTranslateChapter.addEventListener('click', startTranslation);
    btnCancelTranslate.addEventListener('click', stopTranslation);

    // Display mode toggle
    const btnDisplayMode = $('btn-display-mode');
    const displayModeMenu = $('display-mode-menu');

    btnDisplayMode.addEventListener('click', (e) => {
        e.stopPropagation();
        displayModeMenu.classList.toggle('active');
    });

    document.addEventListener('click', () => {
        displayModeMenu.classList.remove('active');
    });

    displayModeMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    document.querySelectorAll('.mode-option').forEach(option => {
        option.addEventListener('click', () => {
            const mode = option.dataset.mode;
            setDisplayMode(mode);
            displayModeMenu.classList.remove('active');
        });
    });

    // Theme (both reader and upload screen)
    btnThemeToggle.addEventListener('click', toggleTheme);
    $('btn-theme-toggle-upload').addEventListener('click', toggleTheme);

    // Settings (both reader and upload screen)
    btnSettings.addEventListener('click', openSettings);
    $('btn-settings-upload').addEventListener('click', openSettings);
    btnSettingsClose.addEventListener('click', closeSettings);
    settingsModal.querySelector('.modal-backdrop').addEventListener('click', closeSettings);
    btnSettingsSave.addEventListener('click', saveCurrentSettings);

    // Engine tabs
    engineTabs.forEach(tab => {
        tab.addEventListener('click', () => setActiveEngine(tab.dataset.engine));
    });

    // Clear cache
    btnClearCache.addEventListener('click', () => {
        const removed = clearCache();
        updateCacheInfo();
        alert(`已清除 ${removed} 条翻译缓存`);
    });

    // Chapter navigation
    btnPrevChapter.addEventListener('click', () => {
        if (currentChapterIndex > 0) {
            stopTranslation();
            loadChapter(currentChapterIndex - 1);
        }
    });

    btnNextChapter.addEventListener('click', () => {
        if (currentChapterIndex < getChapterCount() - 1) {
            stopTranslation();
            loadChapter(currentChapterIndex + 1);
        }
    });

    // Back to upload screen
    btnBack.addEventListener('click', () => {
        stopTranslation();
        readerScreen.classList.remove('active');
        uploadScreen.classList.add('active');
        dropZone.style.opacity = '1';
        dropZone.style.pointerEvents = 'auto';
        document.title = 'EPUB 双语翻译阅读器';
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Only when reader is active
        if (!readerScreen.classList.contains('active')) return;

        if (e.key === 'ArrowLeft' && !btnPrevChapter.disabled) {
            stopTranslation();
            loadChapter(currentChapterIndex - 1);
        } else if (e.key === 'ArrowRight' && !btnNextChapter.disabled) {
            stopTranslation();
            loadChapter(currentChapterIndex + 1);
        } else if (e.key === 't' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            startTranslation();
        } else if (e.key === 'Escape') {
            closeSidebar();
            closeSettings();
        }
    });
}

// ============================================================
// Display Mode
// ============================================================
function setDisplayMode(mode) {
    currentDisplayMode = mode;
    localStorage.setItem('biread_display_mode', mode);

    // Apply to chapter content
    chapterContent.setAttribute('data-display-mode', mode);

    // Update menu active state
    document.querySelectorAll('.mode-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.mode === mode);
    });
}

function initDisplayMode() {
    setDisplayMode(currentDisplayMode);
}

// ============================================================
// Init
// ============================================================
function init() {
    initTheme();
    initDisplayMode();
    setupFileUpload();
    setupEventListeners();
    loadSettings(); // Pre-load settings
}

init();
