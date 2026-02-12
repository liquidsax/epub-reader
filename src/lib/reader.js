/**
 * Reader Module — Core Reading Logic
 * Renders chapter content as sentence-level bilingual pairs
 * Manages translation state per sentence
 */

import { translateParagraph } from './translator.js';
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
 * Split text into sentences
 * Handles English (.!?) and Chinese (。！？) punctuation
 * Avoids false splits on: numbered lists (1. 2.), decimals (3.14),
 * abbreviations (Mr. Dr. etc.)
 */
function splitSentences(text) {
    if (!text || !text.trim()) return [];

    const trimmed = text.trim();

    // If text is short (< 80 chars), don't split — keep as one unit
    if (trimmed.length < 80) return [trimmed];

    // Protect non-sentence periods with placeholders
    let processed = trimmed;

    // Protect numbered lists: "1." "2." "10." etc.
    processed = processed.replace(/(\d+)\./g, '$1\x00');

    // Protect common abbreviations
    const abbrevs = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'vs', 'etc', 'i\\.e', 'e\\.g', 'Vol', 'No', 'Fig'];
    abbrevs.forEach(abbr => {
        const re = new RegExp(`(${abbr})\\.`, 'gi');
        processed = processed.replace(re, '$1\x00');
    });

    // Protect decimal numbers: "3.14" "0.5"
    processed = processed.replace(/(\d)\.([\d])/g, '$1\x00$2');

    // Now split on real sentence-ending punctuation
    // Match: content + punctuation + optional space
    const parts = processed.match(/[^.!?。！？]+[.!?。！？]+[\s]*/g);

    if (!parts) {
        return [trimmed];
    }

    // Restore placeholders and clean up
    const sentences = parts
        .map(s => s.replace(/\x00/g, '.').trim())
        .filter(s => s.length > 0);

    // Handle trailing text after last punctuation
    const joinedLength = parts.join('').length;
    const remainder = processed.slice(joinedLength).replace(/\x00/g, '.').trim();
    if (remainder) {
        sentences.push(remainder);
    }

    return sentences;
}

/**
 * Render chapter content into the reader
 * Each paragraph is split into sentences for line-by-line bilingual display
 * @param {Array} paragraphs - From epubParser.getChapterContent()
 * @param {number} chapterIndex
 */
export function renderChapter(paragraphs, chapterIndex) {
    _currentParagraphs = paragraphs;
    _currentChapterIndex = chapterIndex;

    if (!_container) return;

    _container.innerHTML = '';

    paragraphs.forEach((p, pIndex) => {
        if (p.isImage) {
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'bi-paragraph';
            imgWrapper.innerHTML = p.html;
            _container.appendChild(imgWrapper);
            return;
        }

        // Create a paragraph group
        const paraGroup = document.createElement('div');
        paraGroup.className = 'bi-paragraph';
        paraGroup.dataset.paraIndex = pIndex;

        // Headings — keep as single block (don't split sentences)
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(p.tag)) {
            const sentenceWrapper = document.createElement('div');
            sentenceWrapper.className = 'bi-sentence';
            sentenceWrapper.dataset.pindex = pIndex;
            sentenceWrapper.dataset.sindex = 0;

            const original = document.createElement('div');
            original.className = 'bi-original';
            original.innerHTML = p.html;
            sentenceWrapper.appendChild(original);

            // Check cached translation
            const cached = _getCachedTranslation(chapterIndex, pIndex, 0);
            if (cached) {
                const trans = document.createElement('div');
                trans.className = 'bi-translation';
                trans.textContent = cached;
                sentenceWrapper.appendChild(trans);
            }

            sentenceWrapper.addEventListener('click', () => {
                translateSingleSentence(sentenceWrapper, p.text, pIndex, 0);
            });

            paraGroup.appendChild(sentenceWrapper);
        } else {
            // Regular paragraph — split into sentences
            const sentences = splitSentences(p.text);

            sentences.forEach((sentence, sIndex) => {
                const sentenceWrapper = document.createElement('div');
                sentenceWrapper.className = 'bi-sentence';
                sentenceWrapper.dataset.pindex = pIndex;
                sentenceWrapper.dataset.sindex = sIndex;

                const original = document.createElement('div');
                original.className = 'bi-original';
                original.textContent = sentence;
                sentenceWrapper.appendChild(original);

                // Check cached translation
                const cached = _getCachedTranslation(chapterIndex, pIndex, sIndex);
                if (cached) {
                    const trans = document.createElement('div');
                    trans.className = 'bi-translation';
                    trans.textContent = cached;
                    sentenceWrapper.appendChild(trans);
                }

                sentenceWrapper.addEventListener('click', () => {
                    translateSingleSentence(sentenceWrapper, sentence, pIndex, sIndex);
                });

                paraGroup.appendChild(sentenceWrapper);
            });
        }

        _container.appendChild(paraGroup);
    });

    _container.scrollTop = 0;
}

/** Check cached translation using sentence-level key */
function _getCachedTranslation(chapterIndex, pIndex, sIndex) {
    const bookId = getBookId();
    const model = _getModel();
    const cacheKey = `biread_cache_${_hashString(bookId)}_${chapterIndex}_${pIndex}_${sIndex}_${_hashString(model)}`;
    return localStorage.getItem(cacheKey);
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
 * Translate a single sentence on click
 */
async function translateSingleSentence(wrapper, text, pIndex, sIndex) {
    if (!text.trim() || text.trim().length < 3) return;
    if (wrapper.querySelector('.bi-translation')) return;

    const loading = document.createElement('span');
    loading.className = 'bi-loading';
    loading.textContent = '翻译中...';
    wrapper.appendChild(loading);

    try {
        const bookId = getBookId();
        // Use sentence-level cache key: pIndex_sIndex
        const cacheId = `${pIndex}_${sIndex}`;
        const translation = await translateParagraph(
            text, bookId, _currentChapterIndex, cacheId, null
        );

        loading.remove();

        const trans = document.createElement('div');
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
            translateSingleSentence(wrapper, text, pIndex, sIndex);
        });
        wrapper.appendChild(errorEl);
    }
}

/**
 * Translate entire chapter — sentence by sentence
 */
export async function translateCurrentChapter() {
    if (_currentParagraphs.length === 0) return;

    cancelTranslation();
    _abortController = new AbortController();

    const allSentences = _container.querySelectorAll('.bi-sentence[data-pindex]');
    const total = allSentences.length;
    let translatedCount = 0;

    try {
        for (const sentenceEl of allSentences) {
            if (_abortController.signal.aborted) break;

            const pIndex = parseInt(sentenceEl.dataset.pindex);
            const sIndex = parseInt(sentenceEl.dataset.sindex);

            // Skip already translated
            if (sentenceEl.querySelector('.bi-translation')) {
                translatedCount++;
                if (_onTranslationProgress) {
                    _onTranslationProgress(translatedCount, total);
                }
                continue;
            }

            // Get sentence text from the original element
            const originalEl = sentenceEl.querySelector('.bi-original');
            const text = originalEl?.textContent?.trim();
            if (!text || text.length < 3) {
                translatedCount++;
                continue;
            }

            // Show loading
            let loading = sentenceEl.querySelector('.bi-loading');
            if (!loading) {
                loading = document.createElement('span');
                loading.className = 'bi-loading';
                loading.textContent = '翻译中...';
                sentenceEl.appendChild(loading);
            }

            try {
                const bookId = getBookId();
                const cacheId = `${pIndex}_${sIndex}`;
                const translation = await translateParagraph(
                    text, bookId, _currentChapterIndex, cacheId, _abortController.signal
                );

                loading.remove();

                const existingError = sentenceEl.querySelector('.bi-error');
                if (existingError) existingError.remove();

                const trans = document.createElement('div');
                trans.className = 'bi-translation';
                trans.textContent = translation;
                sentenceEl.appendChild(trans);
            } catch (err) {
                loading.remove();
                if (err.name === 'AbortError') break;

                const errorEl = document.createElement('span');
                errorEl.className = 'bi-error';
                errorEl.textContent = `翻译失败: ${err.message}`;
                sentenceEl.appendChild(errorEl);
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

    if (_container) {
        _container.querySelectorAll('.bi-loading').forEach(el => el.remove());
    }
}
