// Auto-crop for NTBC Cloudflare screenshots: find the section's own box on the page (the
// bordered card around a known title, or the table row of a setting) instead of guessing
// fixed pixel positions. The crop coordinates saved on the debug page (Capture Preset) are
// then small adjustments on top of that box, so they keep working when Cloudflare moves
// things around or the sidebar width changes.
//
// mode:
//   'card' — the bordered card that holds each label (union when several labels match)
//   'row'  — the full-width row inside a card that holds the label (security settings list)
// labels: tried in order; a label matches an element whose own text equals it or starts with it.
// all: true → union of every label's box (each label optional, at least one must match).
export const SMART_CROP_SPECS = {
    'domains': { mode: 'card', labels: ['Domain'], withTitle: 'Domains' },
    'dns': { mode: 'card', labels: ['DNS management for'] },
    'bot-management': { mode: 'row', labels: ['Super Bot fight mode', 'Bot fight mode', 'Bot management'] },
    'security-level': { mode: 'row', labels: ['Security level'] },
    'browser-integrity-check': { mode: 'row', labels: ['Browser integrity check'] },
    'browser-integrity': { mode: 'row', labels: ['Browser integrity check'] },
    'ssl-overview': { mode: 'card', labels: ['SSL/TLS encryption', 'Traffic Served Over TLS'], all: true },
    'ssl-edge': { mode: 'card', labels: ['Minimum TLS Version'] },
    'min-tls-version': { mode: 'card', labels: ['Minimum TLS Version'] },
    'tls-1-3': { mode: 'card', labels: ['TLS 1.3'] },
    'traffic': { mode: 'card', labels: ['Total requests', 'Total data transfer', 'Total visits', 'Cache hit rate', '5xx error rate', 'Edge TTFB (p95)', 'Requests over time', 'Data transfer'], all: true },
    'traffic-countries': { mode: 'card', labels: ['Top countries'] },
    // New HTTP Traffic page (/analytics/requests): the two chart cards used for the report's
    // requests / data transfer images.
    'traffic-requests': { mode: 'card', labels: ['Requests over time'] },
    'traffic-data-transfer': { mode: 'card', labels: ['Data transfer'] },
    'firewall': { mode: 'card', labels: ['Events summary'] },
    'top-events-source': { mode: 'card', labels: ['Source IP Addresses', 'Hosts', 'Paths', 'Source ASNs', 'User Agents', 'Referers', 'HTTP Methods', 'Countries'], all: true, withTitle: 'Top events by source' },
    'security-rules': { mode: 'card', labels: ['Custom rules'] },
    'rate-limiting': { mode: 'card', labels: ['Advanced rate limiting rules', 'Rate limiting rules'] },
    'managed-rules': { mode: 'card', labels: ['Managed rules'] },
    'ip-access-rules': { mode: 'card', labels: ['IP access rules'] },
    'ip-access': { mode: 'card', labels: ['IP access rules'] },
    'zone-lockdown': { mode: 'card', labels: ['Zone lockdown'] },
    'argo': { mode: 'card', labels: ['Argo Smart Routing'] },
};

// Runs inside the Cloudflare page (page.evaluate), so it must stay self-contained plain JS
// (no imports, no spread syntax that a bundler could turn into helper calls). Returns the section's box in document
// coordinates { x, y, width, height } with a small margin, or null when the section isn't on
// the page (the caller then falls back to the older crop logic).
export function findSmartCropBox(spec) {
    const PAD = 12;
    const sidebar = document.querySelector('aside');
    const contentLeft = sidebar ? sidebar.getBoundingClientRect().right : 0;
    const docRect = (r) => ({ left: r.left + window.scrollX, top: r.top + window.scrollY, right: r.right + window.scrollX, bottom: r.bottom + window.scrollY });

    // Full text of the element (search highlighting splits a title into <mark> pieces).
    const textOf = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const isVisible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.left >= contentLeft - 2; };
    const inFooter = (el) => !!el.closest('footer, #site-footer');
    // Every visible element whose own text is the label (exact matches first, then "starts with").
    const findLabels = (label) => {
        const want = label.toLowerCase();
        const exact = [];
        const starts = [];
        for (const el of document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"], legend, span, div, p, a, label, th, mark')) {
            const t = textOf(el);
            if (!t || t.length > 80 || !isVisible(el) || inFooter(el)) continue;
            if (t === want) exact.push(el);
            else if (t.startsWith(want)) starts.push(el);
        }
        return exact.concat(starts);
    };
    const isBoxed = (el) => {
        const cs = getComputedStyle(el);
        return parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0 || (cs.boxShadow && cs.boxShadow !== 'none');
    };
    const cardOf = (el) => {
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            if (a.getBoundingClientRect().width >= 250 && isBoxed(a)) return a;
        }
        return null;
    };
    const rowOf = (el) => {
        const card = cardOf(el);
        if (!card) return null;
        const cardW = card.getBoundingClientRect().width;
        for (let a = el.parentElement; a && a !== card; a = a.parentElement) {
            if (a.getBoundingClientRect().width >= cardW * 0.9) return a;
        }
        return null;
    };

    const area = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height; };
    const docHeight = document.documentElement.scrollHeight;
    // The page's own title (first heading right of the sidebar). A box around it is the page
    // wrapper, not a section.
    const pageTitle = Array.from(document.querySelectorAll('h1, h2')).find(isVisible);
    // The same words often appear twice (a filter chip and the section title, a page title and a
    // card title): use the match whose card is the biggest real section, or the first row found.
    const boxFor = (label) => {
        let best = null;
        for (const el of findLabels(label)) {
            if (spec.mode === 'row') {
                const row = rowOf(el);
                if (row) return row;
                continue;
            }
            const card = cardOf(el);
            if (!card || card.getBoundingClientRect().height > docHeight * 0.9) continue;
            if (pageTitle && card.contains(pageTitle)) continue;
            if (!best || area(card) > area(best)) best = card;
        }
        return best;
    };

    const boxes = [];
    for (const label of spec.labels) {
        const box = boxFor(label);
        if (box) {
            boxes.push(docRect(box.getBoundingClientRect()));
            if (!spec.all) break;
        }
    }
    if (boxes.length === 0) return null;

    let left = boxes.reduce((m, b) => Math.min(m, b.left), Infinity);
    let top = boxes.reduce((m, b) => Math.min(m, b.top), Infinity);
    const right = boxes.reduce((m, b) => Math.max(m, b.right), -Infinity);
    const bottom = boxes.reduce((m, b) => Math.max(m, b.bottom), -Infinity);
    if (spec.withTitle) {
        const title = findLabels(spec.withTitle).find(el => /^H[1-6]$/.test(el.tagName)) || findLabels(spec.withTitle)[0];
        if (title) {
            const r = docRect(title.getBoundingClientRect());
            if (r.top < top) top = r.top;
            if (r.left < left) left = r.left;
        }
    }

    const x = Math.max(0, Math.floor(left - PAD));
    const y = Math.max(0, Math.floor(top - PAD));
    return {
        x,
        y,
        width: Math.ceil(Math.min(document.documentElement.scrollWidth, right + PAD) - x),
        height: Math.ceil(bottom + PAD - y),
    };
}

// Debug-page crop values are adjustments on the auto box, same meaning as before:
// xStart/yStart move the left/top edge, xEnd/yEnd add to the width/height.
// Values above 500 are the old absolute pixel positions — those still win (null here).
export function applyCropAdjustments(box, { xStart, xEnd, yStart, yEnd } = {}) {
    const n = (v) => { const i = parseInt(v, 10); return Number.isFinite(i) ? i : 0; };
    if ([xStart, xEnd, yStart, yEnd].some(v => n(v) > 500)) return null;
    return {
        x: Math.max(0, box.x + n(xStart)),
        y: Math.max(0, box.y + n(yStart)),
        width: Math.max(50, box.width + n(xEnd)),
        height: Math.max(50, box.height + n(yEnd)),
    };
}

// Offsets on a crop editor base box. 'box' (smart crop, card clips): xStart/yStart move the box,
// xEnd/yEnd add to its width/height — applyCropAdjustments. 'edges' (older per-type crop):
// xStart/xEnd move the left/right edges, yStart moves the top, yEnd adds to the height.
// null when an offset is an old absolute position (> 500).
export function applyCropOffsets(box, offsets = {}, semantics = 'box') {
    if (semantics !== 'edges') return applyCropAdjustments(box, offsets);
    const n = (v) => { const i = parseInt(v, 10); return Number.isFinite(i) ? i : 0; };
    const { xStart, xEnd, yStart, yEnd } = offsets;
    if ([xStart, xEnd, yStart, yEnd].some(v => n(v) > 500)) return null;
    const x = Math.max(0, box.x + n(xStart));
    const right = box.x + box.width + n(xEnd);
    return {
        x,
        y: Math.max(0, box.y + n(yStart)),
        width: Math.max(50, right - x),
        height: Math.max(50, box.height + n(yEnd)),
    };
}

// The offsets that make applyCropOffsets(box, offsets, semantics) give `rect`.
export function cropOffsetsFromRect(box, rect, semantics = 'box') {
    const r = Math.round;
    return {
        xStart: String(r(rect.x - box.x)),
        yStart: String(r(rect.y - box.y)),
        xEnd: String(semantics === 'edges' ? r((rect.x + rect.width) - (box.x + box.width)) : r(rect.width - box.width)),
        yEnd: String(r(rect.height - box.height)),
    };
}
