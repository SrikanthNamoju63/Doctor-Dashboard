const RegisteredDoctor = require('../models/RegisteredDoctor');
const DoctorDocument = require('../models/DoctorDocument');
const DoctorProfile = require('../models/DoctorProfile');

const syncDoctorProfile = async (email) => {
    try {
        console.log(`[Sync] Starting sync for email: ${email}`);

        // 1. Find the doctor in the Registration DB
        const existingUser = await RegisteredDoctor.findOne({ email });
        if (!existingUser) {
            console.log(`[Sync] No registered doctor found with email: ${email}`);
            return null;
        }

        // 0. Check if profile already exists in Dashboard DB
        const existingProfile = await DoctorProfile.findById(existingUser._id);
        if (existingProfile) {
            console.log(`[Sync] Profile already exists for ${email}, skipping sync.`);
            return existingProfile;
        }

        console.log(`[Sync] Found registered doctor: ${existingUser._id}`);

        // 2. Find documents in the Registration DB
        // The doctor field in 'doctordocuments' is an ObjectId referencing the 'doctors' collection
        const documents = await DoctorDocument.find({ doctor: existingUser._id });
        console.log(`[Sync] Found ${documents.length} documents.`);

        // 3. Prepare data for Dashboard DB 'doctor_profile'
        // We preserve the _id from the registration DB to keep them linked easily
        // Documents are copied/referenced. If we need them in dashboard, we map them.
        // For profile_image, if it's a local file, we might need to adjust the path or copy the file.
        // Assuming documents have a 'path' that is relative or absolute.
        // If the registration app stores in 'uploads/', and we just mount that, we need to ensure path is correct.
        // Let's assume path in DB is 'uploads\filename' or just 'filename'.
        const profileImageDoc = documents.find(d => d.type === 'profile_image');
        let profileImagePath = null;
        if (profileImageDoc) {
            // simple heuristic: if it doesn't start with http, and doesn't start with /, assume it needs /uploads/
            // OR if the path in DB is just filename.
            const p = profileImageDoc.path || profileImageDoc.filename; // Fallback
            if (p && !p.startsWith('http') && !p.startsWith('/')) {
                // Check if it already has 'uploads'
                if (p.includes('uploads')) {
                    // normalize slashes
                    profileImagePath = '/' + p.replace(/\\/g, '/');
                } else {
                    profileImagePath = '/uploads/' + p;
                }
            } else {
                profileImagePath = p;
            }
        }

        const doctorProfileData = {
            _id: existingUser._id, // Keep same ID
            full_name: existingUser.full_name,
            email: existingUser.email,
            phone: existingUser.phone,
            languages: existingUser.languages, // Fetch languages
            password: existingUser.password, // Sync password if needed, or handle auth separately
            // Map other fields
            education: existingUser.education,
            'professional_details.registration_number': existingUser.doctor_display_id, // Map from doctor_display_id
            'professional_details.license_year': existingUser.professional_details && existingUser.professional_details.license_year,
            'professional_details.experience': existingUser.professional_details && existingUser.professional_details.experience,

            // Map hospital details if they exist in source
            'hospital_details.name': existingUser.hospital_details?.name,
            'hospital_details.pincode': existingUser.hospital_details?.pincode,
            'hospital_details.village': existingUser.hospital_details?.village,
            'hospital_details.city': existingUser.hospital_details?.city,
            'hospital_details.state': existingUser.hospital_details?.state,
            'hospital_details.landmark': existingUser.hospital_details?.landmark,
            'hospital_details.address': existingUser.hospital_details?.address,

            profile_image: profileImagePath, // Updated path logic

            is_active: true, // Retain existing field
            updatedAt: new Date()
        };

        // 4. Upsert into DoctorProfile (Dashboard DB)
        // options: { upsert: true, new: true, setDefaultsOnInsert: true }
        const syncedProfile = await DoctorProfile.findByIdAndUpdate(
            existingUser._id,
            { $set: doctorProfileData }, // Use $set to avoid overwriting fields that might be unique to Dashboard DB if we were doing partial updates, but here we want to ensure basic info is in sync.
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log(`[Sync] Successfully synced profile for ${email}`);
        return syncedProfile;

    } catch (error) {
        console.error('[Sync] Error syncing doctor profile:', error);
        throw error;
    }
};

module.exports = { syncDoctorProfile };
