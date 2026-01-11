const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const QRLog = require('../models/QRLog');

const UserAppointment = require('../models/UserAppointment');

// Get all appointments (Doctor View) - STRICTLY PAID ONLY
router.get('/', async (req, res) => {
    try {
        const { doctor_id, date, status } = req.query;

        // 1. Fetch Local Appointments
        // Base Match Stage
        let matchStage = {
            payment_status: 'PAID' // STRICTLY ENFORCE PAID VISIBILITY
        };

        if (doctor_id) matchStage.doctor_id = new mongoose.Types.ObjectId(doctor_id);
        if (status) matchStage.status = status;

        // Date handling
        if (date) {
            const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);
            matchStage.appointment_date = { $gte: startOfDay, $lte: endOfDay };
        }

        // Sort Options
        const sortStage = date ? { token_number: 1 } : { appointment_date: 1, appointment_time: 1 };

        const localAppointmentsPromise = Appointment.aggregate([
            { $match: matchStage },
            {
                $lookup: {
                    from: 'payments',
                    localField: '_id',
                    foreignField: 'appointment_id',
                    as: 'payment_info'
                }
            },
            {
                $addFields: {
                    payment_details: { $arrayElemAt: ["$payment_info", 0] },
                    appointment_id: "$_id", // For frontend compatibility
                    source: 'Local'
                }
            },
            { $sort: sortStage }
        ]);

        // 2. Fetch UserApp Appointments
        // Build UserApp Query
        let userQuery = {
            payment_status: { $in: ['Paid', 'PAID'] } // Match 'Paid' or 'PAID'
        };

        if (doctor_id) userQuery.doctor_id = doctor_id; // String comparison for UserApp
        if (status) {
            // Map status: UserApp uses 'Scheduled' for 'Booked'
            if (status === 'Booked') userQuery.status = 'Scheduled';
            else userQuery.status = status;
        }
        if (date) {
            const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);
            userQuery.appointment_date_time = { $gte: startOfDay, $lte: endOfDay };
        }

        const userAppointmentsPromise = UserAppointment.find(userQuery).lean();

        // Run in parallel
        const [localAppointments, userAppointmentsRaw] = await Promise.all([localAppointmentsPromise, userAppointmentsPromise]);

        // 3. Transform UserApp Appointments
        const mappedUserAppointments = userAppointmentsRaw.map(app => {
            // Extract Patient Name
            let patientName = `User ${app.user_id}`;
            const nameMatch = app.notes && app.notes.match(/Patient:\s*([^,]+)/);
            if (nameMatch) patientName = nameMatch[1].trim();

            // Normalize Status
            let normStatus = app.status === 'Scheduled' ? 'Booked' : app.status;
            let normPaymentStatus = app.payment_status ? app.payment_status.toUpperCase() : 'PAID';

            // Format Time
            const appDate = new Date(app.appointment_date_time);
            const timeString = appDate.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

            return {
                _id: app._id,
                doctor_id: app.doctor_id,
                patient_name: patientName,
                appointment_date: app.appointment_date_time,
                appointment_time: timeString,
                token_number: app.token_number,
                status: normStatus,
                payment_status: normPaymentStatus,
                appointment_id: app._id,
                consultation_fee: app.consultation_fee,
                // Payment info
                payment_details: {
                    amount: app.amount_paid || app.consultation_fee,
                    payment_method: app.payment_method,
                    transaction_id: app.transaction_id,
                    payment_status: normPaymentStatus
                },
                source: 'UserApp',
                is_synced: true,
                // Add contact info inferred from notes or schema if available
                patient_phone: app.notes && app.notes.match(/Contact:\s*(\d+)/) ? app.notes.match(/Contact:\s*(\d+)/)[1] : ''
            };
        });

        // 4. Merge and Sort
        const allAppointments = [...localAppointments, ...mappedUserAppointments];

        // Re-sort combined list
        // Re-sort combined list (FIFO based on TIME)
        allAppointments.sort((a, b) => {
            return new Date(a.appointment_date) - new Date(b.appointment_date);
        });

        // Regenerate Token Numbers Sequentially
        allAppointments.forEach((app, index) => {
            app.token_number = index + 1;
        });

        res.json({ success: true, data: allAppointments });
    } catch (err) {
        console.error("Error fetching appointments:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Calculate Stats
router.get('/stats/:doctor_id', async (req, res) => {
    try {
        const { doctor_id } = req.params;
        const now = new Date();
        const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);

        const startOfTomorrow = new Date(now); startOfTomorrow.setDate(startOfTomorrow.getDate() + 1); startOfTomorrow.setHours(0, 0, 0, 0);
        const endOfTomorrow = new Date(now); endOfTomorrow.setDate(endOfTomorrow.getDate() + 1); endOfTomorrow.setHours(23, 59, 59, 999);

        // Local Counts
        const todayCountPromise = Appointment.countDocuments({
            doctor_id,
            appointment_date: { $gte: startOfToday, $lte: endOfToday },
            status: { $nin: ['Cancelled', 'No-Show'] }
        });

        const tomorrowCountPromise = Appointment.countDocuments({
            doctor_id,
            appointment_date: { $gte: startOfTomorrow, $lte: endOfTomorrow },
            status: { $nin: ['Cancelled', 'No-Show'] }
        });

        const totalCountPromise = Appointment.countDocuments({ doctor_id });
        const pendingCountPromise = Appointment.countDocuments({
            doctor_id,
            appointment_date: { $gte: startOfToday, $lte: endOfToday },
            status: { $in: ['Booked', 'Checked-In'] }
        });

        // UserApp Counts
        // UserAppointment uses 'Scheduled' instead of Booked
        // 'Cancelled' matches. 'Completed' matches. 
        const userTodayCountPromise = UserAppointment.countDocuments({
            doctor_id: doctor_id, // String
            appointment_date_time: { $gte: startOfToday, $lte: endOfToday },
            status: { $nin: ['Cancelled', 'No-Show'] }
        });

        const userTomorrowCountPromise = UserAppointment.countDocuments({
            doctor_id: doctor_id,
            appointment_date_time: { $gte: startOfTomorrow, $lte: endOfTomorrow },
            status: { $nin: ['Cancelled', 'No-Show'] }
        });

        const userTotalCountPromise = UserAppointment.countDocuments({ doctor_id: doctor_id });

        const userPendingCountPromise = UserAppointment.countDocuments({
            doctor_id: doctor_id,
            appointment_date_time: { $gte: startOfToday, $lte: endOfToday },
            status: { $in: ['Scheduled', 'Checked-In', 'Booked'] }
        });

        const [today, tomorrow, total, pending, uToday, uTomorrow, uTotal, uPending] = await Promise.all([
            todayCountPromise, tomorrowCountPromise, totalCountPromise, pendingCountPromise,
            userTodayCountPromise, userTomorrowCountPromise, userTotalCountPromise, userPendingCountPromise
        ]);

        res.json({
            success: true,
            data: {
                today_appointments: today + uToday,
                tomorrow_appointments: tomorrow + uTomorrow,
                total_appointments: total + uTotal,
                pending_appointments: pending + uPending
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create Appointment (Strict Payment First)
router.post('/', async (req, res) => {
    // Start a session for transaction if replica set is available, else use logic (for single node dev, we simulate)
    // const session = await mongoose.startSession();
    // session.startTransaction();
    try {
        const { doctor_id, appointment_date, payment_method, amount, payment_transaction_id } = req.body;

        // 0. Validate Payment Details FIRST
        if (!payment_transaction_id || !amount) {
            throw new Error("Payment Transaction ID and Amount are required for booking.");
        }

        // 1. Calculate Token Number
        const startOfDay = new Date(appointment_date); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(appointment_date); endOfDay.setHours(23, 59, 59, 999);

        const count = await Appointment.countDocuments({
            doctor_id,
            appointment_date: { $gte: startOfDay, $lte: endOfDay }
        });

        const token_number = count + 1;

        // 2. Create Appointment (PAID)
        // Generate QR Content: Just needs to be verifiable string
        const qrContent = JSON.stringify({
            t: token_number,
            d: doctor_id,
            date: appointment_date,
            txn: payment_transaction_id
        });

        const newAppointment = new Appointment({
            ...req.body,
            token_number,
            status: 'Booked',
            payment_status: 'PAID', // Strict
            qr_code: qrContent,
            consultation_fee: amount
        });

        const savedApp = await newAppointment.save();

        // 3. Create Payment Record
        const Payment = require('../models/Payment');
        await Payment.create({
            appointment_id: savedApp._id,
            amount: amount,
            payment_status: 'PAID',
            payment_method: payment_method || 'UPI',
            transaction_id: payment_transaction_id,
            paid_at: new Date()
        });

        // Emit Socket Event to ALL connected clients (for doctor dashboard)
        if (req.io) {
            req.io.emit('new_appointment', {
                doctor_id: doctor_id,
                appointment: savedApp
            });
        }

        res.json({ success: true, data: savedApp, message: `Payment Verified. Appointment Booked. Token: ${token_number}` });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// Verify QR Code
router.post('/verify-qr', async (req, res) => {
    try {
        const { qr_code_value, doctor_id } = req.body;
        let appointmentId;
        try {
            const parsed = JSON.parse(qr_code_value);
            appointmentId = parsed.appointment_id || parsed.id;
        } catch (e) {
            appointmentId = qr_code_value;
        }

        let appointment = await Appointment.findById(appointmentId);
        let isUserApp = false;

        if (!appointment) {
            try {
                appointment = await UserAppointment.findById(appointmentId);
                isUserApp = true;
            } catch (e) { }
        }

        if (!appointment) return res.status(404).json({ success: false, message: 'Invalid QR: Appointment not found' });

        // Check Doctor (UserAppointment doctor_id is String)
        const appDoctorId = isUserApp ? appointment.doctor_id : appointment.doctor_id.toString();
        if (appDoctorId !== doctor_id) {
            return res.status(403).json({ success: false, message: 'Invalid QR: Wrong Doctor' });
        }

        // Status Logic
        const currentStatus = appointment.status;
        const checkInTarget = isUserApp ? 'Scheduled' : 'Booked'; // UserApp uses Scheduled

        if (currentStatus === checkInTarget || currentStatus === 'Booked' || currentStatus === 'Scheduled' || currentStatus === 'No-Show') {
            appointment.status = 'Checked-In';
            if (!isUserApp) appointment.checked_in_at = new Date(); // Schema specific
            await appointment.save();

            await QRLog.create({
                appointment_id: appointment._id,
                doctor_id,
                qr_code_value
            });

            if (req.io) {
                req.io.emit('appointment_updated', {
                    appointment_id: appointment._id,
                    doctor_id: appDoctorId,
                    status: 'Checked-In',
                    updated_appointment: appointment,
                    source: isUserApp ? 'UserApp' : 'Local'
                });
            }

            return res.json({ success: true, message: 'Verified: Patient Checked-In', data: appointment });
        } else {
            return res.json({ success: true, message: `Appointment is already ${currentStatus}`, data: appointment });
        }

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update Status (Handle Cancellation & Refund)
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body; // e.g., 'Cancelled'
        const appointmentId = req.params.id;

        let appointment = await Appointment.findById(appointmentId);
        let isUserApp = false;

        if (!appointment) {
            try {
                appointment = await UserAppointment.findById(appointmentId);
                isUserApp = true;
            } catch (e) { }
        }

        if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

        // Logic for Cancel -> Refund
        if (status === 'Cancelled' && (appointment.payment_status === 'PAID' || appointment.payment_status === 'Paid')) {
            // 1. Update Appointment
            appointment.status = 'Cancelled';

            if (isUserApp) {
                appointment.payment_status = 'Refunded'; // UserApp convention
            } else {
                appointment.payment_status = 'REFUNDED';
                // 2. Update Payment Record (Local only)
                const Payment = require('../models/Payment');
                await Payment.findOneAndUpdate(
                    { appointment_id: appointmentId },
                    { payment_status: 'REFUNDED' }
                );
            }
            await appointment.save();

            if (req.io) {
                req.io.emit('appointment_updated', {
                    appointment_id: appointment._id,
                    doctor_id: isUserApp ? appointment.doctor_id : appointment.doctor_id,
                    status: 'Cancelled',
                    updated_appointment: appointment,
                    source: isUserApp ? 'UserApp' : 'Local'
                });
            }

            return res.json({ success: true, data: appointment, message: 'Appointment Cancelled & Payment Refunded' });
        }

        // Normal Status Update
        // Map status for UserApp
        if (isUserApp && status === 'Booked') appointment.status = 'Scheduled';
        else appointment.status = status;

        await appointment.save();

        if (req.io) {
            req.io.emit('appointment_updated', {
                appointment_id: appointment._id,
                doctor_id: isUserApp ? appointment.doctor_id : appointment.doctor_id,
                status: status,
                updated_appointment: appointment,
                source: isUserApp ? 'UserApp' : 'Local'
            });
        }

        res.json({ success: true, data: appointment });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Gender Analytics Endpoint
router.get('/stats/gender/:doctor_id', async (req, res) => {
    try {
        const { doctor_id } = req.params;
        const { range } = req.query; // day, week, month, year
        const now = new Date();

        let startDate, endDate, groupBy, formatLabel;

        switch (range) {
            case 'day':
                startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
                endDate = new Date(now); endDate.setHours(23, 59, 59, 999);
                // Group by Hour (0-23)
                groupBy = { $hour: "$appointment_date" };
                formatLabel = (h) => `${h}:00`;
                break;
            case 'week':
                // last 7 days or current week? Let's do current week (Mon-Sun)
                const day = now.getDay() || 7; // Get current day number, converting Sun(0) to 7
                if (day !== 1) now.setHours(-24 * (day - 1)); // set to Monday
                startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
                endDate = new Date(now); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23, 59, 59, 999);
                // Group by Day Name
                groupBy = { $dayOfWeek: "$appointment_date" }; // 1 (Sun) - 7 (Sat)
                formatLabel = (d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d - 1];
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                groupBy = { $dayOfMonth: "$appointment_date" };
                formatLabel = (d) => `Day ${d}`;
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                groupBy = { $month: "$appointment_date" }; // 1-12
                formatLabel = (m) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
                break;
            default:
                return res.status(400).json({ success: false, message: 'Invalid range' });
        }

        const stats = await Appointment.aggregate([
            {
                $match: {
                    doctor_id: new mongoose.Types.ObjectId(doctor_id),
                    appointment_date: { $gte: startDate, $lte: endDate },
                    status: { $nin: ['Cancelled', 'No-Show'] }
                }
            },
            {
                $group: {
                    _id: {
                        unit: groupBy,
                        gender: { $toLower: "$gender" }
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Process Data for Chart
        let labels = [];
        let maleData = [];
        let femaleData = [];

        // Initialize buckets based on range
        if (range === 'day') {
            for (let i = 0; i < 24; i++) labels.push(i);
        } else if (range === 'week') {
            labels = [2, 3, 4, 5, 6, 7, 1]; // Mon to Sun (Mongo: 2=Mon ... 7=Sat, 1=Sun)
        } else if (range === 'month') {
            const daysInMonth = endDate.getDate();
            for (let i = 1; i <= daysInMonth; i++) labels.push(i);
        } else if (range === 'year') {
            for (let i = 1; i <= 12; i++) labels.push(i);
        }

        // Fill Data
        labels.forEach(unit => {
            const male = stats.find(s => s._id.unit === unit && s._id.gender === 'male');
            const female = stats.find(s => s._id.unit === unit && s._id.gender === 'female');
            maleData.push(male ? male.count : 0);
            femaleData.push(female ? female.count : 0);
        });

        // Convert labels to human readable
        const readableLabels = labels.map(formatLabel);

        res.json({
            success: true,
            data: {
                labels: readableLabels,
                male: maleData,
                female: femaleData
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
