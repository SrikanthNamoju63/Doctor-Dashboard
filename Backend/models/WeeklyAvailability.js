const mongoose = require('mongoose');
const { dashboardConnection } = require('../config/db');

const weeklyAvailabilitySchema = new mongoose.Schema({
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorProfile', required: true },
    day_of_week: { type: String, required: true }, // "Monday", "Tuesday", etc.
    start_time: { type: String, required: true }, // "09:00" (24h format)
    end_time: { type: String, required: true }, // "17:00"
    slot_duration_mins: { type: Number, required: true, enum: [10, 15, 20, 30] }
}, {
    collection: 'weekly_availability',
    timestamps: true
});

// Compound index to ensure one rule per day per doctor
weeklyAvailabilitySchema.index({ doctor_id: 1, day_of_week: 1 }, { unique: true });

module.exports = dashboardConnection.model('WeeklyAvailability', weeklyAvailabilitySchema);
