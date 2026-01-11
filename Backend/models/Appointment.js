const mongoose = require('mongoose');
const { dashboardConnection } = require('../config/db');

const appointmentSchema = new mongoose.Schema({
    doctor_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DoctorProfile',
        required: true
    },
    patient_name: {
        type: String,
        required: true
    },
    patient_email: {
        type: String
    },
    patient_phone: {
        type: String
    },
    age: {
        type: Number
    },
    gender: {
        type: String
    },
    appointment_date: {
        type: Date,
        required: true
    },
    appointment_time: {
        type: String, // HH:mm format
        required: true
    },
    token_number: {
        type: Number,
        required: true
    },
    reason: {
        type: String
    },
    symptoms: {
        type: String
    },
    status: {
        type: String,
        enum: ['Booked', 'Checked-In', 'In-Consultation', 'Completed', 'Cancelled', 'No-Show', 'Refunded'],
        default: 'Booked'
    },
    payment_status: {
        type: String,
        enum: ['PAID', 'UNPAID', 'FAILED', 'REFUNDED'],
        default: 'PAID', // Strict Paid-Only Creation
        required: true
    },
    consultation_fee: {
        type: Number
    },
    qr_code: {
        type: String // Stores QR content or URL
    },
    validation_key: {
        type: String // Internal key for QR verification if needed
    },
    checked_in_at: {
        type: Date
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = dashboardConnection.model('Appointment', appointmentSchema);
