// Template Management API
export const listTemplates = async () => {
    try {
        const res = await fetch('/api/templates');
        return await res.json();
    } catch (e) { return []; }
};

export const createTemplate = async (name, sourceId) => {
    try {
        const res = await fetch('/api/templates', {
            method: 'POST',
            body: JSON.stringify({ action: 'create', name, sourceId }),
            headers: { 'Content-Type': 'application/json' }
        });
        return await res.json();
    } catch (e) { return { success: false, error: e.message }; }
};

export const renameTemplate = async (id, newName) => {
    try {
        const res = await fetch('/api/templates', {
            method: 'POST',
            body: JSON.stringify({ action: 'rename', id, newName }),
            headers: { 'Content-Type': 'application/json' }
        });
        return await res.json();
    } catch (e) { return { success: false, error: e.message }; }
};

export const deleteTemplate = async (id) => {
    try {
        const res = await fetch('/api/templates', {
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
        const response = await fetch(`/api/template?id=${id}`, {
            method: 'POST',
            body: JSON.stringify({ template }),
            headers: { 'Content-Type': 'application/json' }
        });
        return await response.json();
    } catch (error) {
        console.error("Failed to save template", error);
        return null;
    }
};

export const loadTemplate = async (id = 'default') => {
    try {
        const response = await fetch(`/api/template?id=${id}`);
        const data = await response.json();
        return data.template || '';
    } catch (error) {
        console.error("Failed to load template", error);
        return null;
    }
};

export const saveStaticTemplate = async (template, id = 'default') => {
    try {
        const response = await fetch(`/api/static-template?id=${id}`, {
            method: 'POST',
            body: JSON.stringify({ template }),
            headers: { 'Content-Type': 'application/json' }
        });
        return await response.json();
    } catch (error) {
        console.error("Failed to save static template", error);
        return null;
    }
};

export const loadStaticTemplate = async (id = 'default') => {
    try {
        const response = await fetch(`/api/static-template?id=${id}`);
        const data = await response.json();
        return data.template || '';
    } catch (error) {
        console.error("Failed to load static template", error);
        return null;
    }
};
