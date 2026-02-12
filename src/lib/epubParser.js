/**
 * EPUB Parser Module
 * Uses epub.js to load and parse EPUB files
 * Extracts chapters, TOC, and paragraph-level content
 */

import ePub from 'epubjs';

let _book = null;
let _chapters = [];

/**
 * Load an EPUB book from ArrayBuffer
 * @param {ArrayBuffer} arrayBuffer - EPUB file data
 * @returns {Promise<{title: string, author: string, cover: string}>}
 */
export async function loadBook(arrayBuffer) {
    // Clean up previous book
    if (_book) {
        _book.destroy();
    }

    _book = ePub(arrayBuffer);
    await _book.ready;

    // Load navigation (TOC)
    const navigation = await _book.loaded.navigation;
    await _book.loaded.metadata;

    // Build chapters list from spine
    const spine = _book.spine;
    _chapters = [];

    spine.each((section) => {
        const tocItem = navigation.toc.find(t => {
            const sectionHref = section.href.split('#')[0];
            const tocHref = t.href.split('#')[0];
            return sectionHref === tocHref || sectionHref.endsWith(tocHref) || tocHref.endsWith(sectionHref);
        });

        _chapters.push({
            index: _chapters.length,
            href: section.href,
            label: tocItem ? tocItem.label.trim() : `Chapter ${_chapters.length + 1}`,
            section: section
        });
    });

    const metadata = _book.packaging.metadata;

    return {
        title: metadata.title || 'Untitled',
        author: metadata.creator || 'Unknown',
        identifier: metadata.identifier || hashTitle(metadata.title || 'unknown'),
        chapterCount: _chapters.length
    };
}

/** Simple title hash for book ID */
function hashTitle(title) {
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = ((hash << 5) - hash) + title.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

/**
 * Get the table of contents
 * @returns {Array<{index: number, label: string}>}
 */
export function getChapters() {
    return _chapters.map(ch => ({
        index: ch.index,
        label: ch.label
    }));
}

/**
 * Get chapter content as array of paragraph objects
 * @param {number} chapterIndex
 * @returns {Promise<{paragraphs: Array<{text: string, html: string, tag: string}>, title: string}>}
 */
export async function getChapterContent(chapterIndex) {
    if (chapterIndex < 0 || chapterIndex >= _chapters.length) {
        throw new Error(`Invalid chapter index: ${chapterIndex}`);
    }

    const chapter = _chapters[chapterIndex];
    const doc = await chapter.section.load(_book.load.bind(_book));

    const paragraphs = [];
    const body = doc.querySelector('body') || doc.documentElement;

    // Walk through the DOM and extract text blocks
    extractParagraphs(body, paragraphs);

    return {
        title: chapter.label,
        paragraphs
    };
}

/**
 * Recursively extract paragraphs from DOM
 * Groups inline elements, splits on block-level elements
 */
function extractParagraphs(node, paragraphs) {
    const blockTags = new Set([
        'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
        'DIV', 'SECTION', 'ARTICLE', 'BLOCKQUOTE',
        'LI', 'PRE', 'FIGCAPTION', 'DT', 'DD'
    ]);

    const skipTags = new Set(['SCRIPT', 'STYLE', 'NAV', 'ASIDE']);

    for (const child of node.childNodes) {
        if (child.nodeType === 3) {
            // Text node — skip if whitespace only
            const text = child.textContent.trim();
            if (text) {
                paragraphs.push({
                    text: text,
                    html: `<p>${escapeHtml(text)}</p>`,
                    tag: 'p'
                });
            }
        } else if (child.nodeType === 1) {
            const tag = child.tagName;

            if (skipTags.has(tag)) continue;

            if (tag === 'IMG') {
                // Image — keep as-is
                paragraphs.push({
                    text: '',
                    html: child.outerHTML,
                    tag: 'img',
                    isImage: true
                });
            } else if (blockTags.has(tag)) {
                const text = child.textContent.trim();
                if (text) {
                    const tagName = tag.toLowerCase();
                    paragraphs.push({
                        text: text,
                        html: `<${tagName}>${child.innerHTML}</${tagName}>`,
                        tag: tagName
                    });
                }
            } else {
                // Recurse into non-block elements
                extractParagraphs(child, paragraphs);
            }
        }
    }
}

/** Escape HTML */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/** Get total chapter count */
export function getChapterCount() {
    return _chapters.length;
}

/** Get book identifier */
export function getBookId() {
    if (!_book) return null;
    const metadata = _book.packaging.metadata;
    return metadata.identifier || hashTitle(metadata.title || 'unknown');
}
