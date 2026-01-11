const mongoose = require('mongoose');
const { dashboardConnection } = require('../config/db');

const qrLogSchema = new mongoose.Schema({
    appointment_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true
    },
    doctor_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DoctorProfile',
        required: true
    },
    qr_code_value: {
        type: String,
        required: true
    },
    checked_in_time: {
        type: Date,
        default: Date.now
    }
});

module.exports = dashboardConnection.model('QRLog', qrLogSchema);
