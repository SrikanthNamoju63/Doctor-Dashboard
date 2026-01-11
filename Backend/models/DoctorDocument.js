
const mongoose = require('mongoose');
const { authConnection } = require('../config/db');

// Ensure schema is loose or matches exactly. strict: false is safer if we just want to read.
const doctorDocumentSchema = new mongoose.Schema({
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    type: { type: String, default: 'document' },
    original_name: { type: String },
    filename: { type: String, required: true },
    path: { type: String, required: true },
    mimetype: { type: String },
    size: { type: Number },
    uploadedAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = authConnection.model('DoctorDocument', doctorDocumentSchema, 'doctordocuments');
