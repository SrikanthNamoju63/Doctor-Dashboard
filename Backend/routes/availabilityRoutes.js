const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');

// Save Weekly Configuration (replaces old POST /)
router.post('/weekly', availabilityController.saveWeeklyAvailability);

// Get Weekly Configuration (replaces old GET /:doctorId)
router.get('/weekly/:doctorId', availabilityController.getWeeklyAvailability);

// Add Leave
router.post('/leave', availabilityController.addLeave);

// Block specific slot
router.post('/block', availabilityController.blockSlot);

// Get Generated Slots for a specific date
router.get('/slots/:doctorId', availabilityController.getSlots);

// Get Calendar Events (Leaves + Blocked)
router.get('/calendar/:doctorId', availabilityController.getCalendarEvents);

module.exports = router;
