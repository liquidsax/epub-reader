/**
 * Reader Module — Core Reading Logic
 * Renders chapter content as bilingual paragraphs
 * Manages translation state per paragraph
 */

import { translateParagraph, translateChapter } from './translator.js';
import { getBookId } from './epubParser.js';

let _container = null;
let _currentParagraphs = [];
let _currentChapterIndex = -1;
let _abortController = null;
let _onTranslationProgress = null;

/**
 * Initialize the reader
 * @param {HTMLElement} container - The chapter content container
 * @param {Function} onProgress - Progress callback (translated, total)
 */
export function initReader(container, onProgress) {
    _container = container;
    _onTranslationProgress = onProgress;
}

/**
 * Render chapter content into the reader
 * @param {Array} paragraphs - From epubParser.getChapterContent()
 * @param {number} chapterIndex
 */
export function renderChapter(paragraphs, chapterIndex) {
    _currentParagraphs = paragraphs;
    _currentChapterIndex = chapterIndex;

    if (!_container) return;

    _container.innerHTML = '';

    paragraphs.forEach((p, index) => {
        if (p.isImage) {
            // Images — render directly, no translation
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'bi-paragraph';
            imgWrapper.innerHTML = p.html;
            _container.appendChild(imgWrapper);
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'bi-paragraph';
        wrapper.dataset.index = index;

        // Original text
        const original = document.createElement('div');
        original.className = 'bi-original';
        original.innerHTML = p.html;
        wrapper.appendChild(original);

        // Check if we have a cached translation
        const bookId = getBookId();
        const cacheKey = `biread_cache_${_hashString(bookId)}_${chapterIndex}_${index}_${_hashString(_getModel())}`;
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
            const trans = document.createElement('span');
            trans.className = 'bi-translation';
            trans.textContent = cached;
            wrapper.appendChild(trans);
        }

        // Click to translate single paragraph
        wrapper.addEventListener('click', () => {
            translateSingleParagraph(wrapper, p.text, index);
        });

        _container.appendChild(wrapper);
    });

    // Scroll to top
    _container.scrollTop = 0;
}

/** Get current model from settings */
function _getModel() {
    try {
        const settings = JSON.parse(localStorage.getItem('biread_settings') || '{}');
        const engine = settings.engine || 'doubao';
        return settings[engine]?.model || '';
    } catch {
        return '';
    }
}

/** Hash string helper */
function _hashString(str) {
    if (!str) return '0';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString(36);
}

/**
 * Translate a single paragraph on click
 */
async function translateSingleParagraph(wrapper, text, index) {
    if (!text.trim() || text.trim().length < 3) return;

    // Don't re-translate if already translated
    if (wrapper.querySelector('.bi-translation')) return;

    // Show loading
    const loading = document.createElement('span');
    loading.className = 'bi-loading';
    loading.textContent = '翻译中...';
    wrapper.appendChild(loading);

    try {
        const bookId = getBookId();
        const translation = await translateParagraph(
            text, bookId, _currentChapterIndex, index, null
        );

        loading.remove();

        const trans = document.createElement('span');
        trans.className = 'bi-translation';
        trans.textContent = translation;
        wrapper.appendChild(trans);
    } catch (err) {
        loading.remove();
        const errorEl = document.createElement('span');
        errorEl.className = 'bi-error';
        errorEl.textContent = `翻译失败: ${err.message} (点击重试)`;
        errorEl.addEventListener('click', (e) => {
            e.stopPropagation();
            errorEl.remove();
            translateSingleParagraph(wrapper, text, index);
        });
        wrapper.appendChild(errorEl);
    }
}

/**
 * Translate entire chapter
 * @returns {Promise<void>}
 */
export async function translateCurrentChapter() {
    if (_currentParagraphs.length === 0) return;

    // Cancel any in-progress translation
    cancelTranslation();

    _abortController = new AbortController();

    const textsToTranslate = _currentParagraphs
        .filter(p => !p.isImage && p.text.trim().length >= 3);

    const textIndexMap = _currentParagraphs
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => !p.isImage && p.text.trim().length >= 3);

    const bookId = getBookId();
    let translatedCount = 0;
    const total = textIndexMap.length;

    try {
        for (const { p, i } of textIndexMap) {
            if (_abortController.signal.aborted) break;

            const wrapper = _container?.querySelector(`[data-index="${i}"]`);
            if (!wrapper) continue;

            // Skip already translated
            if (wrapper.querySelector('.bi-translation')) {
                translatedCount++;
                if (_onTranslationProgress) {
                    _onTranslationProgress(translatedCount, total);
                }
                continue;
            }

            // Show loading
            let loading = wrapper.querySelector('.bi-loading');
            if (!loading) {
                loading = document.createElement('span');
                loading.className = 'bi-loading';
                loading.textContent = '翻译中...';
                wrapper.appendChild(loading);
            }

            try {
                const translation = await translateParagraph(
                    p.text, bookId, _currentChapterIndex, i, _abortController.signal
                );

                loading.remove();

                // Remove any existing error
                const existingError = wrapper.querySelector('.bi-error');
                if (existingError) existingError.remove();

                const trans = document.createElement('span');
                trans.className = 'bi-translation';
                trans.textContent = translation;
                wrapper.appendChild(trans);
            } catch (err) {
                loading.remove();
                if (err.name === 'AbortError') break;

                const errorEl = document.createElement('span');
                errorEl.className = 'bi-error';
                errorEl.textContent = `翻译失败: ${err.message}`;
                wrapper.appendChild(errorEl);
            }

            translatedCount++;
            if (_onTranslationProgress) {
                _onTranslationProgress(translatedCount, total);
            }
        }
    } finally {
        _abortController = null;
    }
}

/**
 * Cancel in-progress translation
 */
export function cancelTranslation() {
    if (_abortController) {
        _abortController.abort();
        _abortController = null;
    }

    // Remove all loading indicators
    if (_container) {
        _container.querySelectorAll('.bi-loading').forEach(el => el.remove());
    }
}
