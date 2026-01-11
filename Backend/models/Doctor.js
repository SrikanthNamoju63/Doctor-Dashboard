const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
    full_name: { type: String, required: true },
    doctor_display_id: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Store hashed
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
        experience: { type: Number }, // Years of experience
        registration_number: { type: String }
    },

    // Documents references
    documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DoctorDocument' }],

    profile_image: { type: String }, // URL path

    consultation_fee: { type: Number },
    consultation_duration_mins: { type: Number, default: 30 },
    bio: { type: String },
    achievements: { type: String },
    search_keywords: { type: String },
    is_active: { type: Boolean, default: true },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = mongoose.model('Doctor', doctorSchema);
