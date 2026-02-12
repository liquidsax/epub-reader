/**
 * Translator Module — Translation Service
 * Unified interface for Doubao and SiliconFlow APIs
 * Both use OpenAI-compatible /v1/chat/completions endpoint
 */

import { getActiveConfig } from './settings.js';

const CACHE_PREFIX = 'biread_cache_';

/** Simple hash for cache keys */
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return hash.toString(36);
}

/** Build cache key */
function getCacheKey(bookId, chapterIndex, paragraphIndex) {
    const config = getActiveConfig();
    return `${CACHE_PREFIX}${hashString(bookId)}_${chapterIndex}_${paragraphIndex}_${hashString(config.model)}`;
}

/** Get cached translation */
function getFromCache(bookId, chapterIndex, paragraphIndex) {
    const key = getCacheKey(bookId, chapterIndex, paragraphIndex);
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

/** Save translation to cache */
function saveToCache(bookId, chapterIndex, paragraphIndex, translation) {
    const key = getCacheKey(bookId, chapterIndex, paragraphIndex);
    try {
        localStorage.setItem(key, translation);
    } catch {
        // localStorage full — silently ignore
    }
}

/** Build system prompt based on translation style */
function buildSystemPrompt(config) {
    const styleGuides = {
        faithful: '请忠实原文含义，准确传达信息，同时保持译文的通顺和专业性。',
        natural: '请以自然流畅的方式翻译，以意译为主，让译文读起来像原生中文。',
        academic: '请保持学术严谨，专业术语保留英文或使用通用翻译，确保准确性。',
        literary: '请注重文采和修辞，保持原文的文学美感，译文应当优美流畅。'
    };

    const sourceHint = config.sourceLang === 'auto'
        ? '请自动检测源语言'
        : `源语言为${config.sourceLang}`;

    return `你是一位专业的翻译专家。${sourceHint}，请将以下文本翻译为${config.targetLang}。
${styleGuides[config.translationStyle] || styleGuides.faithful}
规则：
1. 只输出翻译结果，不要输出任何解释、注释或原文
2. 保持段落结构和换行
3. 如果文本中包含代码、公式或专业术语，请合理处理
4. 如果原文已经是目标语言，直接输出原文`;
}

/** Call the translation API */
async function callAPI(text, config, signal) {
    const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages: [
                { role: 'system', content: buildSystemPrompt(config) },
                { role: 'user', content: text }
            ],
            temperature: 0.3,
            max_tokens: 4096
        }),
        signal
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`API 请求失败 (${response.status}): ${errorBody || response.statusText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0]?.message?.content) {
        throw new Error('API 返回数据格式异常');
    }

    return data.choices[0].message.content.trim();
}

/**
 * Translate a single paragraph
 * @param {string} text - Text to translate
 * @param {string} bookId - Book identifier for caching
 * @param {number} chapterIndex - Chapter index
 * @param {number} paragraphIndex - Paragraph index
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<string>} Translated text
 */
export async function translateParagraph(text, bookId, chapterIndex, paragraphIndex, signal) {
    // Skip very short or empty text
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 3) return trimmed;

    // Check cache first
    const cached = getFromCache(bookId, chapterIndex, paragraphIndex);
    if (cached) return cached;

    const config = getActiveConfig();
    if (!config.apiKey || !config.model) {
        throw new Error('请先在设置中配置 API Key 和模型');
    }

    const translation = await callAPI(trimmed, config, signal);

    // Cache the result
    saveToCache(bookId, chapterIndex, paragraphIndex, translation);

    return translation;
}

/**
 * Translate multiple paragraphs with progress callback
 * @param {string[]} paragraphs - Array of paragraph texts
 * @param {string} bookId - Book identifier
 * @param {number} chapterIndex - Chapter index
 * @param {Function} onProgress - Callback (index, total, translation)
 * @param {AbortSignal} signal - Abort signal
 * @returns {Promise<string[]>} Array of translated texts
 */
export async function translateChapter(paragraphs, bookId, chapterIndex, onProgress, signal) {
    const results = [];

    for (let i = 0; i < paragraphs.length; i++) {
        if (signal?.aborted) {
            throw new DOMException('Translation cancelled', 'AbortError');
        }

        const translation = await translateParagraph(
            paragraphs[i], bookId, chapterIndex, i, signal
        );
        results.push(translation);

        if (onProgress) {
            onProgress(i, paragraphs.length, translation);
        }
    }

    return results;
}
