const mongoose = require('mongoose');
const { userAppConnection } = require('../config/db');

const userAppointmentSchema = new mongoose.Schema({
    appointment_id: { type: Number },
    user_id: { type: Number },
    doctor_id: { type: String, required: true }, // Stored as String in UserApp
    appointment_date_time: { type: Date, required: true },
    duration_mins: { type: Number },
    appointment_type: { type: String },
    status: { type: String },
    symptoms: { type: String },
    notes: { type: String },
    token_number: { type: Number },
    consultation_fee: { type: Number },
    payment_status: { type: String },
    payment_method: { type: String },
    transaction_id: { type: String },
    amount_paid: { type: Number },
    payment_date: { type: Date },
    prescription_given: { type: Boolean },
    expires_at: { type: Date },
    confirmed_at: { type: Date },
    last_synced: { type: Date },
    created_at: { type: Date }
}, { collection: 'user_appointments' }); // Explicitly bind to 'user_appointments' collection

module.exports = userAppConnection.model('UserAppointment', userAppointmentSchema);
