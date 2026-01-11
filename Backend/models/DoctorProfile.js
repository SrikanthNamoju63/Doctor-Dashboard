const mongoose = require('mongoose');
const { dashboardConnection } = require('../config/db');

const doctorProfileSchema = new mongoose.Schema({
    // We can use the same _id as the auth DB for easy linking
    _id: { type: mongoose.Schema.Types.ObjectId },

    full_name: { type: String, required: true },
    doctor_display_id: { type: String },
    email: { type: String, required: true },
    phone: { type: String },
    specialization: { type: String },
    languages: { type: String },

    hospital_details: {
        name: { type: String },
        pincode: { type: String },
        village: { type: String },
        city: { type: String },
        state: { type: String },
        landmark: { type: String },
        address: { type: String }
    },

    education: { type: String },

    professional_details: {
        license_year: { type: Number },
        experience: { type: Number },
        registration_number: { type: String }
    },

    // Documents references
    documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DoctorDocument' }],

    profile_image: { type: String },

    consultation_fee: { type: Number },
    consultation_duration_mins: { type: Number, default: 30 },
    bio: { type: String },
    achievements: { type: String },
    search_keywords: { type: String },
    is_active: { type: Boolean, default: true },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    collection: 'doctor_profile', // Explicitly named table/collection
    timestamps: true
});

module.exports = dashboardConnection.model('DoctorProfile', doctorProfileSchema);
