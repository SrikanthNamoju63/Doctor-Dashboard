const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../Frontend/index.html');
const content = fs.readFileSync(filePath, 'utf8');

const components = ['FinancialSection', 'AvailabilityPage', 'ProfilePage', 'Dashboard', 'Login', 'Modal', 'Sidebar'];

components.forEach(comp => {
    const regex = new RegExp(`const ${comp}\\s*=`);
    const match = content.match(regex);
    if (match) {
        const lines = content.substring(0, match.index).split('\n');
        console.log(`${comp} found at line ${lines.length}`);
    } else {
        console.log(`${comp} NOT FOUND`);
    }
});

// Also check for usage
if (content.includes('<FinancialSection')) {
    console.log('FinancialSection is USED in JSX');
} else {
    console.log('FinancialSection usage NOT found');
}
