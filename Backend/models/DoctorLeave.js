const mongoose = require('mongoose');
const { dashboardConnection } = require('../config/db');

const doctorLeaveSchema = new mongoose.Schema({
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorProfile', required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD" format for easy querying
    leave_type: {
        type: String,
        required: true,
        enum: ['FULL', 'HALF_MORNING', 'HALF_AFTERNOON']
    }
}, {
    collection: 'doctor_leaves',
    timestamps: true
});

// One leave entry per date per doctor
doctorLeaveSchema.index({ doctor_id: 1, date: 1 }, { unique: true });

module.exports = dashboardConnection.model('DoctorLeave', doctorLeaveSchema);
