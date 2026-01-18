const mongoose = require('mongoose');

const uri = 'mongodb://127.0.0.1:27017/HealthPredict_UserApp';

console.log('Connecting to', uri);

const fs = require('fs');

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        let output = '';
        output += 'Connected!\n';
        const collections = await mongoose.connection.db.listCollections().toArray();
        output += 'Collections: ' + JSON.stringify(collections.map(c => c.name)) + '\n';

        if (collections.find(c => c.name === 'appointments')) {
            output += 'Found appointments collection.\n';
            const sample = await mongoose.connection.db.collection('appointments').findOne({});
            output += 'Sample appointment: ' + JSON.stringify(sample, null, 2) + '\n';
        } else if (collections.find(c => c.name === 'user_appointments')) {
            output += 'Found user_appointments collection.\n';
            const sample = await mongoose.connection.db.collection('user_appointments').findOne({});
            output += 'Sample user_appointment: ' + JSON.stringify(sample, null, 2) + '\n';
        } else {
            output += 'No appointments or user_appointments collection found.\n';
        }

        fs.writeFileSync('db_check_result.txt', output);
        mongoose.disconnect();
    })
    .catch(err => {
        console.error('Connection error:', err);
    });
