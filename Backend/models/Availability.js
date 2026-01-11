const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    day_of_week: { type: String, required: true }, // Monday, Tuesday, etc.
    start_time: { type: String, required: true }, // "09:00"
    end_time: { type: String, required: true }, // "17:00"
    slot_duration_mins: { type: Number, default: 30 },
    max_patients_per_slot: { type: Number, default: 1 },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Availability', availabilitySchema);
