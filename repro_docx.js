const HTMLToDOCX = require('html-to-docx');
const fs = require('fs');

async function test() {
    const html = '<html><body><h1>Hello World</h1><p>Test document</p></body></html>';
    const options = {
        title: 'Test',
        font: 'Arial'
    };

    try {
        console.log('Generating docx...');
        const buffer = await HTMLToDOCX(html, null, options);
        console.log('Generated! Buffer size:', buffer.length);
        fs.writeFileSync('test_output.docx', buffer);
        console.log('Saved to test_output.docx');
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
