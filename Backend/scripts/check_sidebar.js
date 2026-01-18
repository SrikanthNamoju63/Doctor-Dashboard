const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../Frontend/js/app.js');
const content = fs.readFileSync(filePath, 'utf8');

const items = ['const Sidebar', 'handleLogout'];

items.forEach(item => {
    const lines = content.split('\n');
    let found = false;
    lines.forEach((line, index) => {
        if (line.includes(item)) {
            console.log(`${item} found at line ${index + 1}`);
            found = true;
        }
    });
    if (!found) console.log(`${item} NOT FOUND`);
});
