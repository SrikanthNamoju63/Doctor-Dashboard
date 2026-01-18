const http = require('http');

const DOCTOR_ID = '69578b0436ce57af1a3a8777';
const BASE_PATH = '/api/appointments';

function request(method, path, data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve(body);
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function run() {
    console.log('--- Starting Verification ---');
    try {
        const date = new Date().toISOString().split('T')[0];

        // 1. Create
        console.log('Creating Appointment...');
        const createRes = await request('POST', BASE_PATH, {
            doctor_id: DOCTOR_ID,
            patient_name: 'Test Patient',
            appointment_date: date,
            appointment_time: '10:00'
        });
        console.log('Create Response:', JSON.stringify(createRes, null, 2));

        if (!createRes.success) {
            console.error('Creation failed:', createRes.message);
            return;
        }

        const id = createRes.data._id;

        // 2. Verify QR
        console.log(`Verifying QR for ID: ${id}...`);
        const verifyRes = await request('POST', `${BASE_PATH}/verify-qr`, {
            qr_code_value: id,
            doctor_id: DOCTOR_ID
        });
        console.log('Verify Response:', verifyRes.message);

        // 3. Status Update
        console.log('Updating Status...');
        const updateRes = await request('PUT', `${BASE_PATH}/${id}/status`, { status: 'In-Consultation' });
        console.log('Update Response:', updateRes.data.status);

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
