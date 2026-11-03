
const utf8ToBase64 = (str) => {
    try { return btoa(unescape(encodeURIComponent(str))); }
    catch(e) { return btoa(str); }
};
// NTBC Template Management API
export const listTemplates = async () => {
    try {
        const res = await fetch('/api/ntbc-templates');
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};

export const createTemplate = async (name, sourceId, format, capturePresetId, captureMode) => {
    try {
        const res = await fetch('/api/ntbc-templates', {
            method: 'POST',
            body: JSON.stringify({ action: 'create', name, sourceId, format, capturePresetId, captureMode }),
            headers: { 'Content-Type': 'application/json' }
        });
        return await res.json();
    } catch (e) { return { success: false, error: e.message }; }
};

// format: 'docx' (Word) or 'pptx' (PowerPoint) — the file type reports from this template export to.
export const setTemplateFormat = async (id, format) => {
    try {
        const res = await fetch('/api/ntbc-templates', {
            method: 'POST',
            body: JSON.stringify({ action: 'set-format', id, format }),
            headers: { 'Content-Type': 'application/json' }
        });
        return await res.json();
    } catch (e) { return { success: false, error: e.message }; }
};

// The capture preset (crop coordinates saved on the debug/Control page) this template's reports use.
export const setTemplatePreset = async (id, capturePresetId) => {
    try {
        const res = await fetch('/api/ntbc-templates', {
            method: 'POST',
            body: JSON.stringify({ action: 'set-preset', id, capturePresetId }),
            headers: { 'Content-Type': 'application/json' }
        });
        return await res.json();
    } catch (e) { return { success: false, error: e.message }; }
};

// Built-in preset: every offset 0, i.e. each section cut exactly to its auto box. Not stored
// in the DB (can't be edited or deleted); templates without a preset of their own use it.
export const STANDARD_DEFAULT_PRESET = { id: 'default', name: 'Standard Default (Auto +0)', coords: {}, kind: 'captured', builtIn: true };

export const listCapturePresets = async () => {
    try {
        const res = await fetch('/api/ntbc-capture-presets');
        const data = await res.json();
        return [STANDARD_DEFAULT_PRESET, ...(Array.isArray(data?.presets) ? data.presets.filter(p => p.id !== 'default') : [])];
    } catch (e) { return [STANDARD_DEFAULT_PRESET]; }
};

// Where this template's report images come from: 'captured' | 'inapp' | 'uploaded'.
export const setTemplateCaptureMode = async (id, captureMode) => {
    try {
        const res = await fetch('/api/ntbc-templates', {
            method: 'POST',
            body: JSON.stringify({ action: 'set-capture-mode', id, captureMode }),
            headers: { 'Content-Type': 'application/json' }
        });
        return await res.json();
    } catch (e) { return { success: false, error: e.message }; }
};

// The mode a template's reports use; templates from before modes existed are screenshots.
export const templateCaptureMode = (template) => template?.captureMode || 'captured';

// Mode being set up on tab 2 (which settings / previews it shows): 'captured' | 'inapp' | 'uploaded'.
export const getCaptureMode = async () => {
    try {
        const res = await fetch('/api/ntbc-capture-mode', { cache: 'no-store' });
        const data = await res.json();
        return data?.mode || 'captured';
    } catch (e) { return 'captured'; }
};

export const setCaptureMode = async (mode) => {
    const res = await fetch('/api/ntbc-capture-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
    });
    return res.json();
};

// What a report from `templateId` needs: { mode, preset? } or { mode, error }. The mode is the
// template's own; only screenshot mode crops with the template's preset.
export const resolveReportCaptureSetup = async (templateId) => {
    const template = (await listTemplates()).find(t => String(t.id) === String(templateId));
    const mode = templateCaptureMode(template);
    if (mode !== 'captured') return { mode, preset: null };
    const lookup = await resolveTemplateCapturePreset(templateId);
    return { mode, ...lookup };
};

// The preset a report built from `templateId` must crop its screenshots with: its own, or
// Standard Default when it has none. { error } (Thai, shown to the user / job) when its
// preset no longer exists.
export const resolveTemplateCapturePreset = async (templateId) => {
    const [templates, presets] = await Promise.all([listTemplates(), listCapturePresets()]);
    const template = templates.find(t => String(t.id) === String(templateId));
    const name = template?.name || templateId;
    if (!template?.capturePresetId) return { template, preset: STANDARD_DEFAULT_PRESET };
    const preset = presets.find(p => String(p.id) === String(template.capturePresetId));
    if (!preset) {
        return { error: `ไม่พบ Capture Preset ของ Template "${name}" (อาจถูกลบไปแล้ว) — เลือกใหม่ที่ Manage Templates` };
    }
    return { template, preset };
};

export const renameTemplate = async (id, newName) => {
    try {
        const res = await fetch('/api/ntbc-templates', {
            method: 'POST',
            body: JSON.stringify({ action: 'rename', id, newName }),
            headers: { 'Content-Type': 'application/json' }
        });
        return await res.json();
    } catch (e) { return { success: false, error: e.message }; }
};

export const deleteTemplate = async (id) => {
    try {
        const res = await fetch('/api/ntbc-templates', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', id }),
            headers: { 'Content-Type': 'application/json' }
        });
        return await res.json();
    } catch (e) { return { success: false, error: e.message }; }
};

// Content API
export const saveTemplate = async (template, id = 'default') => {
    try {
        const response = await fetch(`/api/ntbc-template?id=${id}`, {
            method: 'POST',
            body: JSON.stringify({ encodedTemplate: utf8ToBase64(template) }),
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            const text = await response.text();
            let errJson;
            try { errJson = JSON.parse(text); } catch(e) {}
            return errJson || { success: false, error: `HTTP ${response.status}: ${text.substring(0, 100)}` };
        }
        return await response.json();
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export const loadTemplate = async (id = 'default') => {
    try {
        const response = await fetch(`/api/ntbc-template?id=${id}`);
        const data = await response.json();
        return data.template || '';
    } catch (error) {
        console.error("Failed to load template", error);
        return null;
    }
};

export const saveStaticTemplate = async (template, id = 'default') => {
    try {
        const response = await fetch(`/api/ntbc-static-template?id=${id}`, {
            method: 'POST',
            body: JSON.stringify({ encodedTemplate: utf8ToBase64(template) }),
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            const text = await response.text();
            let errJson;
            try { errJson = JSON.parse(text); } catch(e) {}
            return errJson || { success: false, error: `HTTP ${response.status}: ${text.substring(0, 100)}` };
        }
        return await response.json();
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export const loadStaticTemplate = async (id = 'default') => {
    try {
        const response = await fetch(`/api/ntbc-static-template?id=${id}`);
        const data = await response.json();
        return data.template || '';
    } catch (error) {
        console.error("Failed to load static template", error);
        return null;
    }
};

export const saveMiddleTemplate = async (template, id = 'default') => {
    try {
        const response = await fetch(`/api/ntbc-middle-template?id=${id}`, {
            method: 'POST',
            body: JSON.stringify({ encodedTemplate: utf8ToBase64(template) }),
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            const text = await response.text();
            let errJson;
            try { errJson = JSON.parse(text); } catch(e) {}
            return errJson || { success: false, error: `HTTP ${response.status}: ${text.substring(0, 100)}` };
        }
        return await response.json();
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export const loadMiddleTemplate = async (id = 'default') => {
    try {
        const response = await fetch(`/api/ntbc-middle-template?id=${id}`);
        const data = await response.json();
        return data.template || '';
    } catch (error) {
        console.error("Failed to load middle template", error);
        return null;
    }
};
