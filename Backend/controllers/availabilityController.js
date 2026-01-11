const WeeklyAvailability = require('../models/WeeklyAvailability');
const DoctorLeave = require('../models/DoctorLeave');
const BlockedSlot = require('../models/BlockedSlot');

// Helper: Add minutes to time string "HH:mm"
const addMinutes = (time, mins) => {
    const [h, m] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    date.setMinutes(date.getMinutes() + mins);
    const newH = String(date.getHours()).padStart(2, '0');
    const newM = String(date.getMinutes()).padStart(2, '0');
    return `${newH}:${newM}`;
};

// Helper: Compare times "09:00" < "10:00"
const isTimeBefore = (t1, t2) => {
    return t1 < t2; // String comparison works for HH:mm 24h format
};

// Helper: Check if slot is within a range [start, end)
const isSlotOverlapping = (slotStart, slotEnd, blockStart, blockEnd) => {
    return (slotStart < blockEnd && slotEnd > blockStart);
};

// 1. Save Weekly Availability
exports.saveWeeklyAvailability = async (req, res) => {
    try {
        const { doctor_id, schedule } = req.body;
        // schedule: array of { day_of_week, start_time, end_time, slot_duration_mins }

        // Clear existing for this doctor to overwrite
        await WeeklyAvailability.deleteMany({ doctor_id });

        if (schedule && schedule.length > 0) {
            const docs = schedule.map(s => ({ ...s, doctor_id }));
            await WeeklyAvailability.insertMany(docs);
        }

        res.json({ success: true, message: 'Weekly availability saved' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 2. Get Weekly Availability
exports.getWeeklyAvailability = async (req, res) => {
    try {
        const { doctorId } = req.params;
        const schedule = await WeeklyAvailability.find({ doctor_id: doctorId });
        res.json({ success: true, data: schedule });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 3. Add or Update Leave
exports.addLeave = async (req, res) => {
    try {
        const { doctor_id, date, leave_type } = req.body;
        // Upsert: Update if exists, otherwise Insert
        await DoctorLeave.findOneAndUpdate(
            { doctor_id, date },
            { leave_type },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.json({ success: true, message: 'Leave updated' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// 4. Block Slot
exports.blockSlot = async (req, res) => {
    try {
        const { doctor_id, date, start_time, end_time, reason } = req.body;
        // Basic validation
        if (!isTimeBefore(start_time, end_time)) {
            return res.status(400).json({ success: false, message: 'Start time must be before end time' });
        }

        const newBlock = new BlockedSlot({ doctor_id, date, start_time, end_time, reason });
        await newBlock.save();
        res.json({ success: true, message: 'Slot blocked' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// 5. Get Generated Slots (The Core Logic)
exports.getSlots = async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { date } = req.query; // YYYY-MM-DD format

        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        // A. Check Leaves
        const leave = await DoctorLeave.findOne({ doctor_id: doctorId, date });
        if (leave && leave.leave_type === 'FULL') {
            return res.json({ success: true, slots: [], message: 'Doctor is on full day leave' });
        }

        // B. Get Weekly Schedule for this day
        // Robust way to get weekday name from YYYY-MM-DD independent of timezone
        const [y, m, d] = date.split('-').map(Number);
        // Date(y, m-1, d) uses local time. getDay() returns 0-6. 
        // We match this against our days array.
        const dayIndex = new Date(y, m - 1, d).getDay();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = days[dayIndex];

        const weeklyRule = await WeeklyAvailability.findOne({ doctor_id: doctorId, day_of_week: dayName });

        if (!weeklyRule) {
            return res.json({ success: true, slots: [], message: 'No working hours for this day' });
        }

        // C. Generate Base Slots
        const { start_time, end_time, slot_duration_mins } = weeklyRule;
        let generatedSlots = [];
        let current = start_time;

        while (isTimeBefore(current, end_time)) {
            const next = addMinutes(current, slot_duration_mins);
            if (!isTimeBefore(next, end_time) && next !== end_time) break; // Don't exceed end time

            // Filter Half Day Leaves
            let skip = false;
            if (leave) {
                if (leave.leave_type === 'HALF_MORNING' && isTimeBefore(current, '12:00')) skip = true; // Assume morning ends at 12:00
                if (leave.leave_type === 'HALF_AFTERNOON' && !isTimeBefore(current, '12:00')) skip = true;
            }

            if (!skip) {
                generatedSlots.push({ start: current, end: next });
            }
            current = next;
        }

        // D. Filter Blocked Slots
        const blockedSlots = await BlockedSlot.find({ doctor_id: doctorId, date });

        if (blockedSlots.length > 0) {
            generatedSlots = generatedSlots.filter(slot => {
                // Keep slot if it does NOT overlap with any blocked slot
                const isBlocked = blockedSlots.some(block =>
                    isSlotOverlapping(slot.start, slot.end, block.start_time, block.end_time)
                );
                return !isBlocked;
            });
        }

        res.json({ success: true, slots: generatedSlots });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// Get existing Leaves and Blocked Slots for calendar display
exports.getCalendarEvents = async (req, res) => {
    try {
        const { doctorId } = req.params;
        const leaves = await DoctorLeave.find({ doctor_id: doctorId });
        const blocked = await BlockedSlot.find({ doctor_id: doctorId });
        res.json({ success: true, leaves, blocked });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
