const HTMLToDOCX = require('html-to-docx');
const fs = require('fs');

async function test() {
    // Small red dot base64
    const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==';
    const html = `<div><h1>Test with Image</h1><p>Embedded image:</p><img src="${base64Image}" width="50" /></div>`;

    const options = {
        title: 'Image Test',
        font: 'Arial'
    };

    try {
        console.log('Generating docx with image...');
        const buffer = await HTMLToDOCX(html, null, options);
        console.log('Generated! Buffer size:', buffer.length);
        fs.writeFileSync('test_image.docx', buffer);
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
