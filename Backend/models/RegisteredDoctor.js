const mongoose = require('mongoose');
const { authConnection } = require('../config/db');

// Schema matches what is likely in the existing Registration DB
// Using strict: false to be safe as we don't control the registration app
const registeredDoctorSchema = new mongoose.Schema({
    full_name: { type: String },
    email: { type: String, required: true },
    password: { type: String },
    phone: { type: String },
    // Include other fields we might need to copy initially
    specialization: { type: String },
    registration_number: { type: String }
}, { strict: false });

module.exports = authConnection.model('Doctor', registeredDoctorSchema, 'doctors');
