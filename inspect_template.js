const fs = require('fs');
const path = 'app/data/staticReportTemplate.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const html = data.template;

// Find table rows to see structure
const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g);
if (rows && rows.length > 0) {
    console.log('Found ' + rows.length + ' rows.');
    console.log('First Row Sample:');
    console.log(rows[0]);
    console.log('--------------------------------');
    // Find row with 3 columns (td or th)
    const threeColRow = rows.find(r => (r.match(/<(td|th)/g) || []).length === 3);
    if (threeColRow) {
        console.log('Three Column Row Sample:');
        console.log(threeColRow);
    }
} else {
    console.log('No rows found via regex');
}
