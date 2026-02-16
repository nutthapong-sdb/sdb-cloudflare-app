const fs = require('fs');
const path = require('path');
const { log, colors, BASE_URL } = require('../../test-all/libs/ui-helper');

// Mock fetch for node environment if needed, but we can use real fetch to localhost
// Assumes server is running at BASE_URL (localhost:8002)

async function testTemplateAPI() {
    log('🔹 Testing Template Management API...', colors.cyan);

    const api = `${BASE_URL}/api/templates`;

    // 1. List
    log('1. Listing Templates...', colors.yellow);
    let res = await fetch(api);
    let templates = await res.json();
    log(`   Found ${templates.length} templates.`, colors.green);

    // 2. Create New
    log('2. Creating New Template (Duplicate Default)...', colors.yellow);
    res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: 'Test Template API', sourceId: 'default' })
    });
    const createData = await res.json();
    if (!createData.success) throw new Error('Create failed: ' + createData.error);
    const newId = createData.template.id;
    log(`   Created ID: ${newId}`, colors.green);

    // 3. Rename
    log('3. Renaming Template...', colors.yellow);
    res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', id: newId, newName: 'Renamed Test Template' })
    });
    const renameData = await res.json();
    if (!renameData.success) throw new Error('Rename failed');
    log(`   Renamed success.`, colors.green);

    // 4. Verify Content (Sub Report)
    log('4. Verifying Content access...', colors.yellow);
    const contentRes = await fetch(`${BASE_URL}/api/template?id=${newId}`);
    const content = await contentRes.json();
    if (!content) throw new Error('Failed to load content');
    log(`   Content loaded (Size: ${JSON.stringify(content).length})`, colors.green);

    // 5. Create Empty
    log('5. Creating Empty Template...', colors.yellow);
    res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: 'Test Empty Template', sourceId: 'empty' })
    });
    const createEmptyData = await res.json();
    if (!createEmptyData.success) throw new Error('Create empty failed');
    const emptyId = createEmptyData.template.id;
    log(`   Created Empty ID: ${emptyId}`, colors.green);

    // 6. Verify Empty Content
    log('6. Verifying Empty Content...', colors.yellow);
    const emptyContentRes = await fetch(`${BASE_URL}/api/template?id=${emptyId}`);
    const emptyContent = await emptyContentRes.json();

    // Check if truly empty (no keys or empty object)
    if (Object.keys(emptyContent).length > 0 && JSON.stringify(emptyContent) !== '{}') {
        if (emptyContent.template) {
            throw new Error('Empty template contains data! (Found keys: ' + Object.keys(emptyContent).join(',') + ')');
        }
    }
    log(`   Empty Content verified: ${JSON.stringify(emptyContent)}`, colors.green);

    // Clean up
    await fetch(api, { method: 'POST', body: JSON.stringify({ action: 'delete', id: newId }) });
    await fetch(api, { method: 'POST', body: JSON.stringify({ action: 'delete', id: emptyId }) });
    log(`   Cleaned up test templates.`, colors.green);

    log('✅ Template API Tests Passed!', colors.green);
}

testTemplateAPI().catch(err => {
    log(`❌ Test Failed: ${err.message}`, colors.red);
    process.exit(1);
});
