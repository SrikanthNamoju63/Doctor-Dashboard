const mongoose = require('mongoose');
const { dashboardConnection } = require('../config/db');

const blockedSlotSchema = new mongoose.Schema({
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorProfile', required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    start_time: { type: String, required: true }, // "10:00"
    end_time: { type: String, required: true }, // "11:00"
    reason: { type: String } // Optional: "Surgery", "Meeting", etc.
}, {
    collection: 'blocked_slots',
    timestamps: true
});

module.exports = dashboardConnection.model('BlockedSlot', blockedSlotSchema);
