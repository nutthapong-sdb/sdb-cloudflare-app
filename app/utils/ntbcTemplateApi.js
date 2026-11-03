
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

export const createTemplate = async (name, sourceId, format, capturePresetId) => {
    try {
        const res = await fetch('/api/ntbc-templates', {
            method: 'POST',
            body: JSON.stringify({ action: 'create', name, sourceId, format, capturePresetId }),
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

export const listCapturePresets = async () => {
    try {
        const res = await fetch('/api/ntbc-capture-presets');
        const data = await res.json();
        return Array.isArray(data?.presets) ? data.presets : [];
    } catch (e) { return []; }
};

// Report image mode set in tab 2: 'captured' | 'inapp' | 'uploaded' (server-wide).
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

// What a report from `templateId` needs: { mode, preset? } or { mode, error }.
// Only screenshot mode crops with the template's preset; inapp / uploaded need none.
export const resolveReportCaptureSetup = async (templateId) => {
    const mode = await getCaptureMode();
    if (mode !== 'captured') return { mode, preset: null };
    const lookup = await resolveTemplateCapturePreset(templateId);
    return { mode, ...lookup };
};

// The preset a report built from `templateId` must crop its screenshots with.
// Returns { template, preset } or { error } (Thai, shown to the user / job) when the
// template has no preset or its preset no longer exists.
export const resolveTemplateCapturePreset = async (templateId) => {
    const [templates, presets] = await Promise.all([listTemplates(), listCapturePresets()]);
    const template = templates.find(t => String(t.id) === String(templateId));
    const name = template?.name || templateId;
    if (!template?.capturePresetId) {
        return { error: `Template "${name}" ยังไม่ได้เลือก Capture Preset — เลือกได้ที่ Manage Templates` };
    }
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
