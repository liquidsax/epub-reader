/**
 * Book Translator Module — Full Book Translation + EPUB Export
 * Translates all chapters and exports bilingual EPUB
 */

import JSZip from 'jszip';
import { getChapters, getChapterContent, getChapterCount, getBookId } from './epubParser.js';
import { translateParagraph } from './translator.js';
import { isConfigured } from './settings.js';

let _abortController = null;

/**
 * Translate the full book and download as bilingual EPUB
 * @param {string} bookTitle - The book title
 * @param {Function} onProgress - Callback (chapterIndex, totalChapters, status)
 * @returns {Promise<void>}
 */
export async function translateFullBook(bookTitle, onProgress) {
    if (!isConfigured()) {
        throw new Error('请先在设置中配置 API Key 和模型');
    }

    _abortController = new AbortController();
    const signal = _abortController.signal;

    const totalChapters = getChapterCount();
    const chapters = getChapters();
    const bookId = getBookId();

    // Collect all chapter content: original + translated
    const translatedChapters = [];

    for (let i = 0; i < totalChapters; i++) {
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');

        onProgress(i, totalChapters, `正在翻译第 ${i + 1}/${totalChapters} 章：${chapters[i]?.label || ''}`);

        const chapter = await getChapterContent(i);
        const bilingualParagraphs = [];

        for (let pi = 0; pi < chapter.paragraphs.length; pi++) {
            if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');

            const p = chapter.paragraphs[pi];

            if (p.isImage) {
                bilingualParagraphs.push({ original: p.html, translation: null, isImage: true });
                continue;
            }

            if (!p.text.trim() || p.text.trim().length < 3) {
                bilingualParagraphs.push({ original: p.html, translation: null });
                continue;
            }

            try {
                const translation = await translateParagraph(
                    p.text, bookId, i, pi, signal
                );
                bilingualParagraphs.push({ original: p.html, translation, tag: p.tag });
            } catch (err) {
                if (err.name === 'AbortError') throw err;
                bilingualParagraphs.push({ original: p.html, translation: `[翻译失败: ${err.message}]`, tag: p.tag });
            }
        }

        translatedChapters.push({
            title: chapter.title,
            paragraphs: bilingualParagraphs
        });
    }

    onProgress(totalChapters, totalChapters, '正在生成 EPUB 文件...');

    // Build bilingual EPUB
    const epubBlob = await buildBilingualEPUB(bookTitle, translatedChapters);

    // Download
    const url = URL.createObjectURL(epubBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bookTitle}_双语版.epub`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Cancel full-book translation
 */
export function cancelFullBookTranslation() {
    if (_abortController) {
        _abortController.abort();
        _abortController = null;
    }
}

/**
 * Build a bilingual EPUB file
 */
async function buildBilingualEPUB(title, chapters) {
    const zip = new JSZip();

    // EPUB mimetype (must be first, uncompressed)
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    // META-INF/container.xml
    zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`);

    // CSS for bilingual display
    const css = `
body {
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Noto Serif SC', serif;
  line-height: 1.8;
  margin: 1rem;
  color: #333;
}
.bi-block { margin-bottom: 1.5em; }
.bi-original { margin-bottom: 0.3em; }
.bi-trans {
  padding-left: 1em;
  border-left: 3px solid #6366f1;
  color: #1e293b;
  font-weight: 500;
  margin-bottom: 0.5em;
}
h1, h2, h3, h4 { margin: 1.2em 0 0.5em; }
`;
    zip.file('OEBPS/style.css', css);

    // Generate chapter HTML files
    const chapterFiles = [];
    chapters.forEach((ch, idx) => {
        const filename = `chapter_${idx.toString().padStart(3, '0')}.xhtml`;
        chapterFiles.push({ id: `ch${idx}`, filename, title: ch.title });

        let body = '';
        ch.paragraphs.forEach(p => {
            if (p.isImage) {
                body += p.original + '\n';
            } else if (p.translation) {
                body += `<div class="bi-block">\n`;
                body += `  <div class="bi-original">${p.original}</div>\n`;
                body += `  <div class="bi-trans">${escapeXml(p.translation)}</div>\n`;
                body += `</div>\n`;
            } else {
                body += p.original + '\n';
            }
        });

        const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh">
<head>
  <meta charset="UTF-8" />
  <title>${escapeXml(ch.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
${body}
</body>
</html>`;

        zip.file(`OEBPS/${filename}`, xhtml);
    });

    // content.opf
    const manifest = chapterFiles
        .map(f => `    <item id="${f.id}" href="${f.filename}" media-type="application/xhtml+xml" />`)
        .join('\n');

    const spine = chapterFiles
        .map(f => `    <itemref idref="${f.id}" />`)
        .join('\n');

    const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">biread-${Date.now()}</dc:identifier>
    <dc:title>${escapeXml(title)} (双语版)</dc:title>
    <dc:language>zh</dc:language>
    <dc:creator>BiRead Translation</dc:creator>
    <meta property="dcterms:modified">${new Date().toISOString().split('.')[0]}Z</meta>
  </metadata>
  <manifest>
    <item id="css" href="style.css" media-type="text/css" />
    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav" />
${manifest}
  </manifest>
  <spine>
${spine}
  </spine>
</package>`;
    zip.file('OEBPS/content.opf', opf);

    // toc.xhtml (navigation document)
    const tocItems = chapterFiles
        .map(f => `      <li><a href="${f.filename}">${escapeXml(f.title)}</a></li>`)
        .join('\n');

    const tocXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh">
<head>
  <meta charset="UTF-8" />
  <title>目录</title>
</head>
<body>
  <nav epub:type="toc">
    <h1>目录</h1>
    <ol>
${tocItems}
    </ol>
  </nav>
</body>
</html>`;
    zip.file('OEBPS/toc.xhtml', tocXhtml);

    return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}

function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
