export const saveTemplate = async (template) => {
    try {
        const response = await fetch('/api/template', {
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

export const loadTemplate = async () => {
    try {
        const response = await fetch('/api/template');
        const data = await response.json();
        return data.template;
    } catch (error) {
        console.error("Failed to load template", error);
        return null;
    }
};

export const saveStaticTemplate = async (template) => {
    try {
        const response = await fetch('/api/static-template', {
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

export const loadStaticTemplate = async () => {
    try {
        const response = await fetch('/api/static-template');
        const data = await response.json();
        return data.template;
    } catch (error) {
        console.error("Failed to load static template", error);
        return null;
    }
};
