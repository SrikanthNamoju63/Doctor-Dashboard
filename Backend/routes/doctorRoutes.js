const express = require('express');
const router = express.Router();
const RegisteredDoctor = require('../models/RegisteredDoctor');
const DoctorProfile = require('../models/DoctorProfile');

// Get all doctors (from Dashboard DB)
router.get('/', async (req, res) => {
    try {
        const doctors = await DoctorProfile.find();
        res.json(doctors);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get the latest doctor (simulating one for dev purposes, from Dashboard DB)
router.get('/latest', async (req, res) => {
    try {
        const doctor = await DoctorProfile.findOne().sort({ createdAt: -1 });
        if (!doctor) return res.status(404).json({ message: 'No doctors found' });
        res.json(doctor);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get specific doctor by ID (from Dashboard DB)
router.get('/:id', async (req, res) => {
    try {
        const doctor = await DoctorProfile.findById(req.params.id).populate('documents');
        if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
        res.json(doctor);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Doctor Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // 1. Check Auth DB for credentials
        const authDoctor = await RegisteredDoctor.findOne({ email: email });

        if (!authDoctor) {
            return res.status(400).json({ success: false, message: 'Doctor not found' });
        }

        // 2. Validate Password (Hybrid: supports legacy plain-text and new bcrypt hash)
        let isMatch = false;
        if (authDoctor.password && authDoctor.password.startsWith('$2')) {
            // It's a hash
            isMatch = await bcrypt.compare(password, authDoctor.password);
        } else {
            // It's plain text (Legacy)
            if (authDoctor.password === password) {
                isMatch = true;
                // Auto-migrate to hash for better security (Optional)
                try {
                    const salt = await bcrypt.genSalt(10);
                    authDoctor.password = await bcrypt.hash(password, salt);
                    // Use updateOne to avoid full document validation issues if any
                    await RegisteredDoctor.updateOne({ _id: authDoctor._id }, { $set: { password: authDoctor.password } });
                } catch (e) { console.error('Migration error', e); }
            }
        }

        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // 3. SYNC DATA
        const { syncDoctorProfile } = require('../services/syncService');
        const profile = await syncDoctorProfile(email);

        if (!profile) {
            return res.status(500).json({ success: false, message: 'Failed to sync doctor profile' });
        }

        // 4. Generate JWT Token
        const token = jwt.sign(
            { id: profile._id, email: profile.email },
            process.env.JWT_SECRET || 'secret_key_123',
            { expiresIn: '24h' }
        );

        // 5. Return Token & Profile
        res.json({ success: true, token, doctor: profile });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update Doctor Profile (Updates Dashboard DB)
router.put('/:id', async (req, res) => {
    try {
        const updatedDoctor = await DoctorProfile.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        res.json({ success: true, data: updatedDoctor });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});


const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create unique filename: DOC-{id}-{timestamp}.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'DOC-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// Upload Profile Image Route
router.post('/:id/upload-image', upload.single('profile_image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Generate public URL (assuming 'uploads' static serve is set up in server.js)
        const fileUrl = `/uploads/${req.file.filename}`;

        // Optionally update the doctor profile immediately in DB
        const updatedDoctor = await DoctorProfile.findByIdAndUpdate(
            req.params.id,
            { profile_image: fileUrl },
            { new: true }
        );

        res.json({ success: true, url: fileUrl, doctor: updatedDoctor });
    } catch (err) {
        console.error('Upload Error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

