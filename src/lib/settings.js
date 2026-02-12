/**
 * Settings Module — API 配置管理
 * Manages API keys, endpoints, and translation preferences
 * Persists to localStorage
 */

const STORAGE_KEY = 'biread_settings';

const DEFAULT_SETTINGS = {
    engine: 'doubao', // 'doubao' | 'siliconflow'
    doubao: {
        apiKey: '',
        endpoint: 'https://ark.cn-beijing.volces.com/api/v3',
        model: ''
    },
    siliconflow: {
        apiKey: '',
        endpoint: 'https://api.siliconflow.cn/v1',
        model: 'deepseek-ai/DeepSeek-V3'
    },
    sourceLang: 'English',
    targetLang: '简体中文',
    translationStyle: 'faithful'
};

let _settings = null;

/** Load settings from localStorage */
export function loadSettings() {
    if (_settings) return _settings;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            _settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
            // Merge nested objects
            _settings.doubao = { ...DEFAULT_SETTINGS.doubao, ..._settings.doubao };
            _settings.siliconflow = { ...DEFAULT_SETTINGS.siliconflow, ..._settings.siliconflow };
        } else {
            _settings = { ...DEFAULT_SETTINGS };
        }
    } catch {
        _settings = { ...DEFAULT_SETTINGS };
    }
    return _settings;
}

/** Save settings to localStorage */
export function saveSettings(settings) {
    _settings = { ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
}

/** Get the active engine config for translation */
export function getActiveConfig() {
    const s = loadSettings();
    const engineConfig = s[s.engine];
    return {
        engine: s.engine,
        baseUrl: engineConfig.endpoint,
        apiKey: engineConfig.apiKey,
        model: engineConfig.model,
        sourceLang: s.sourceLang,
        targetLang: s.targetLang,
        translationStyle: s.translationStyle
    };
}

/** Check if the active engine is properly configured */
export function isConfigured() {
    const config = getActiveConfig();
    return !!(config.apiKey && config.model);
}

/** Get translation cache stats */
export function getCacheStats() {
    let count = 0;
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('biread_cache_')) {
            count++;
            bytes += (localStorage.getItem(key) || '').length * 2; // UTF-16
        }
    }
    return { count, bytes };
}

/** Clear all translation cache */
export function clearCache() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('biread_cache_')) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    return keysToRemove.length;
}
