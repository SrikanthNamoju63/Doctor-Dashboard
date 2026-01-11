const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/appointments',
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
            if (json.success && Array.isArray(json.data)) {
                console.log('Verified: /api/appointments returned success and data array.');
            } else {
                console.log('Failed: structure mismatch.');
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
