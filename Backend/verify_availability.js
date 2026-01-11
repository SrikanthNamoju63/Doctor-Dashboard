const http = require('http');

// Use the ID seen in user logs or a placeholder if testing specifically
const doctorId = '69578b0436ce57af1a3a8777';

const options = {
    hostname: 'localhost',
    port: 5000,
    path: `/api/availability/weekly/${doctorId}`,
    method: 'GET',
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log('BODY:', data);
        try {
            const json = JSON.parse(data);
            if (json.success) {
                console.log('Verified: API returned success.');
                if (json.data.length === 0) {
                    console.log('Notice: Data is empty. This is normal if no schedule is saved yet.');
                } else {
                    console.log(`Found ${json.data.length} schedule items.`);
                }
            } else {
                console.log('Failed: API returned success: false');
            }
        } catch (e) {
            console.log('Failed: Invalid JSON');
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
