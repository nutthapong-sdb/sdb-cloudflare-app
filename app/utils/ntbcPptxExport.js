'use client';

// Builds a PowerPoint (.pptx) from the same processed report HTML the Word export uses.
// The HTML is walked in document order and turned into blocks (page break, heading, text,
// image, table), which are laid out onto 16:9 slides:
//   - a page break or a level 1–2 heading starts a new slide (the heading becomes its title)
//   - text and images flow down the slide; anything that doesn't fit continues on a new
//     slide with the same title + "(ต่อ)"
//   - tables become native, editable PowerPoint tables and page across slides on their own
import PptxGenJS from 'pptxgenjs';

const SLIDE_W = 13.333; // inches, LAYOUT_WIDE (16:9)
const SLIDE_H = 7.5;
const MARGIN_X = 0.5;
const CONTENT_W = SLIDE_W - MARGIN_X * 2;
const TITLE_Y = 0.3;
const TITLE_H = 0.8;
const BODY_TOP = 1.2;
const BODY_BOTTOM = SLIDE_H - 0.4;
// Same font as the Word report (TH Sarabun New). Sarabun draws small, so sizes are larger
// than usual slide sizes to read about like the Word report's 16pt body text.
const FONT = 'TH Sarabun New';
const TEXT_PT = 20;
const TABLE_PT = 14;
const TITLE_PT = 32;
const SUBHEAD_PT = 22;
const COVER_PT = 26;

const collapse = (s) => String(s || '').replace(/ /g, ' ').replace(/[ \t\r\f\v]+/g, ' ').replace(/ *\n */g, '\n').trim();
const isPageBreak = (el) => /page-break-before\s*:\s*always/i.test(el.getAttribute?.('style') || '');
const BLOCK_TAGS = new Set(['P', 'DIV', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'IMG', 'SECTION', 'BLOCKQUOTE', 'CENTER']);

// Text of an element, keeping <br> as line breaks.
const textOf = (el) => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    clone.querySelectorAll('img, style, script').forEach(n => n.remove());
    return collapse(clone.textContent);
};

const alignOf = (el) => {
    const style = (el.getAttribute?.('style') || '').toLowerCase();
    const align = (el.getAttribute?.('align') || '').toLowerCase();
    if (align === 'center' || /text-align\s*:\s*center/.test(style)) return 'center';
    if (align === 'right' || /text-align\s*:\s*right/.test(style)) return 'right';
    return 'left';
};

const isBoldOnly = (el) => {
    const text = textOf(el);
    if (!text) return false;
    const boldText = Array.from(el.querySelectorAll('b, strong')).map(b => textOf(b)).join('');
    return boldText.replace(/\s/g, '').length >= text.replace(/\s/g, '').length * 0.9;
};

// ---- HTML -> blocks -------------------------------------------------------------------

function toBlocks(root) {
    const blocks = [];
    const push = (b) => blocks.push(b);

    const walk = (node) => {
        if (node.nodeType === 3) { // loose text directly inside a container
            const t = collapse(node.textContent);
            if (t) push({ type: 'text', text: t });
            return;
        }
        if (node.nodeType !== 1) return;
        const tag = node.tagName;
        if (tag === 'STYLE' || tag === 'SCRIPT') return;
        if (tag === 'BR') {
            if (isPageBreak(node)) push({ type: 'break' });
            return;
        }
        if (isPageBreak(node)) push({ type: 'break' });

        // Word table of contents: page numbers mean nothing in slides — keep the entries only.
        if (node.classList?.contains('toc-container')) {
            push({ type: 'break' });
            push({ type: 'heading', level: 1, text: 'สารบัญ' });
            Array.from(node.children).slice(1).forEach(entry => {
                const t = textOf(entry).replace(/[\s.·…_-]*[0-9๐-๙]+\s*$/, '').trim();
                if (t) push({ type: 'text', text: t, bullet: true });
            });
            push({ type: 'break' });
            return;
        }

        if (/^H[1-6]$/.test(tag)) {
            const t = textOf(node);
            if (t) push({ type: 'heading', level: Number(tag[1]), text: t });
            node.querySelectorAll('img').forEach(img => push({ type: 'image', src: img.getAttribute('src') }));
            return;
        }
        if (tag === 'IMG') {
            push({ type: 'image', src: node.getAttribute('src') });
            return;
        }
        if (tag === 'TABLE') {
            // Word layout tables that only frame images/paragraphs read better flattened.
            if (node.querySelector('img') || node.querySelector('table')) {
                Array.from(node.querySelectorAll(':scope > tbody > tr > td, :scope > tbody > tr > th, :scope > tr > td, :scope > tr > th, :scope > thead > tr > th, :scope > thead > tr > td'))
                    .forEach(cell => Array.from(cell.childNodes).forEach(walk));
                return;
            }
            const rows = Array.from(node.rows || []).map(tr => Array.from(tr.cells).map(td => ({
                text: textOf(td),
                bold: td.tagName === 'TH' || isBoldOnly(td),
                colspan: Number(td.getAttribute('colspan')) || 1,
                rowspan: Number(td.getAttribute('rowspan')) || 1,
                fill: (td.getAttribute('bgcolor') || ((td.getAttribute('style') || '').match(/background(?:-color)?\s*:\s*(#[0-9a-f]{3,6})/i) || [])[1] || '').replace('#', ''),
                align: alignOf(td),
            })));
            if (rows.some(r => r.some(c => c.text))) push({ type: 'table', rows });
            return;
        }
        if (tag === 'UL' || tag === 'OL') {
            Array.from(node.children).filter(li => li.tagName === 'LI').forEach(li => {
                const t = textOf(li);
                if (t) push({ type: 'text', text: t, bullet: true });
                li.querySelectorAll('img').forEach(img => push({ type: 'image', src: img.getAttribute('src') }));
            });
            return;
        }
        // Containers: recurse when they hold blocks, otherwise they are one paragraph.
        const hasBlockChild = Array.from(node.children).some(c => BLOCK_TAGS.has(c.tagName) || isPageBreak(c) || (c.tagName === 'BR' && isPageBreak(c)));
        if (hasBlockChild) {
            Array.from(node.childNodes).forEach(walk);
            return;
        }
        const t = textOf(node);
        if (t) push({ type: 'text', text: t, bold: isBoldOnly(node), align: alignOf(node) });
        node.querySelectorAll('img').forEach(img => push({ type: 'image', src: img.getAttribute('src') }));
    };

    Array.from(root.childNodes).forEach(walk);
    return blocks;
}

// ---- helpers ----------------------------------------------------------------------------

// Rough height (inches) of wrapped text; Thai/Latin average glyph width ≈ 0.5em.
const textHeight = (text, pt, width) => {
    const charsPerLine = Math.max(10, Math.floor((width * 72) / (pt * 0.45)));
    const lines = text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
    return (lines * pt * 1.35) / 72 + 0.1;
};

const loadImage = (src) => new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
});

// pptxgenjs wants "image/png;base64,..." (no "data:" prefix).
const toPptxData = (src) => (src && src.startsWith('data:') ? src.slice(5) : null);

// ---- blocks -> slides -------------------------------------------------------------------

export async function buildPptxFromHtml(html, { title = 'Cloudflare Report' } = {}) {
    const doc = new DOMParser().parseFromString(`<div id="ntbc-pptx-root">${html}</div>`, 'text/html');
    const blocks = toBlocks(doc.getElementById('ntbc-pptx-root'));

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.title = title;
    pptx.company = 'Cloudflare Report';
    pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };

    // Slides are created lazily, when content actually arrives, so page breaks and headings
    // never leave empty slides behind.
    let slide = null;        // slide being filled, or null => next content opens a new one
    let slideTitle = '';     // title for the next/current slide
    let sectionLabel = '';   // parent heading shown above the title (heading with no own content)
    let continued = false;   // next slide continues the previous one ("(ต่อ)")
    let titlePending = false; // a heading is waiting for its first content
    let y = BODY_TOP;
    let hasContent = false;
    let slideCount = 0;

    const openSlide = () => {
        slide = pptx.addSlide();
        slideCount++;
        slide.background = { color: 'FFFFFF' };
        hasContent = false;
        y = slideTitle ? BODY_TOP : (slideCount === 1 ? 0.8 : TITLE_Y); // cover content sits lower
        if (sectionLabel) {
            slide.addText(sectionLabel, {
                x: MARGIN_X, y: 0.05, w: CONTENT_W, h: 0.3,
                fontFace: FONT, fontSize: 16, color: 'F38020', bold: true, valign: 'middle', fit: 'shrink',
            });
        }
        if (slideTitle) {
            slide.addText(continued ? `${slideTitle} (ต่อ)` : slideTitle, {
                x: MARGIN_X, y: TITLE_Y, w: CONTENT_W, h: TITLE_H,
                fontFace: FONT, fontSize: TITLE_PT, bold: true, color: '1F3864', valign: 'middle', fit: 'shrink',
            });
            slide.addShape(pptx.ShapeType.line, { x: MARGIN_X, y: TITLE_Y + TITLE_H, w: CONTENT_W, h: 0, line: { color: 'F38020', width: 2 } });
        }
        continued = false;
        titlePending = false;
    };
    const continueOnNewSlide = () => { slide = null; continued = !!slideTitle; };
    // The first page of the report (before any heading) is its cover: bigger, centred text.
    const onCover = () => slideCount === 1 && !slideTitle;
    // Make room for `h` inches on the current slide, opening a new one if needed.
    const ensure = (h) => {
        if (slide && hasContent && y + h > BODY_BOTTOM) continueOnNewSlide();
        if (!slide) openSlide();
    };

    for (const block of blocks) {
        if (block.type === 'break') {
            if (slide && hasContent) { slide = null; slideTitle = ''; sectionLabel = ''; continued = false; }
            continue;
        }
        if (block.type === 'heading' && block.level <= 2) {
            // Opened lazily with its first content; a heading followed straight by another
            // heading becomes the section label of the next slide instead of an empty slide.
            sectionLabel = titlePending ? slideTitle : '';
            slideTitle = block.text;
            titlePending = true;
            slide = null;
            continued = false;
            continue;
        }
        if (block.type === 'heading' || block.type === 'text') {
            const cover = !slide ? (slideCount === 0 && !slideTitle) : onCover();
            const pt = cover ? COVER_PT : block.type === 'heading' ? SUBHEAD_PT : TEXT_PT;
            const h = Math.min(textHeight(block.text, pt, CONTENT_W), BODY_BOTTOM - BODY_TOP);
            ensure(h);
            slide.addText(block.text, {
                x: MARGIN_X, y, w: CONTENT_W, h,
                fontFace: FONT, fontSize: pt, color: '222222', valign: 'top',
                bold: block.type === 'heading' || !!block.bold || cover,
                align: cover ? 'center' : (block.align || 'left'),
                bullet: block.bullet ? { indent: 15 } : false,
                fit: 'shrink',
            });
            y += h;
            hasContent = true;
            continue;
        }
        if (block.type === 'image') {
            const data = toPptxData(block.src);
            const size = data ? await loadImage(block.src) : null;
            if (!data || !size || !size.w || !size.h) continue;
            const maxH = BODY_BOTTOM - BODY_TOP;
            let w = Math.min(CONTENT_W, size.w / 96);
            let h = w * (size.h / size.w);
            if (h > maxH) { h = maxH; w = h * (size.w / size.h); }
            if (slide && hasContent && y + h > BODY_BOTTOM) {
                // Shrink into the space left when that keeps it readable, else continue.
                const room = BODY_BOTTOM - y;
                if (room >= Math.max(2, h * 0.6)) { h = room; w = h * (size.w / size.h); }
                else continueOnNewSlide();
            }
            if (!slide) openSlide();
            slide.addImage({ data, x: MARGIN_X + (CONTENT_W - w) / 2, y, w, h });
            y += h + 0.15;
            hasContent = true;
            continue;
        }
        if (block.type === 'table') {
            const cols = Math.max(...block.rows.map(r => r.reduce((n, c) => n + c.colspan, 0)));
            if (slide && hasContent && BODY_BOTTOM - y < 1.5) continueOnNewSlide();
            if (!slide) openSlide();
            const rows = block.rows.map(r => r.map(c => ({
                text: c.text,
                options: {
                    bold: c.bold,
                    colspan: c.colspan > 1 ? c.colspan : undefined,
                    rowspan: c.rowspan > 1 ? c.rowspan : undefined,
                    fill: c.fill ? { color: c.fill.length === 3 ? c.fill.split('').map(x => x + x).join('') : c.fill } : undefined,
                    align: c.align,
                },
            })));
            slide.addTable(rows, {
                x: MARGIN_X, y, w: CONTENT_W, colW: Array(cols).fill(CONTENT_W / cols),
                fontFace: FONT, fontSize: TABLE_PT, color: '222222', valign: 'middle',
                border: { type: 'solid', pt: 0.75, color: '999999' },
                autoPage: true, autoPageRepeatHeader: true, autoPageHeaderRows: 1,
                autoPageSlideStartY: BODY_TOP, newSlideStartY: BODY_TOP,
            });
            // autoPage may have added slides after this one; continue on a fresh slide.
            continueOnNewSlide();
            continue;
        }
    }

    if (titlePending || slideCount === 0) {
        slideTitle = slideTitle || title;
        openSlide();
    }
    return pptx.write({ outputType: 'base64' });
}
