const mongoose = require('mongoose');
const { dashboardConnection } = require('../config/db');

const paymentSchema = new mongoose.Schema({
    appointment_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    payment_status: {
        type: String,
        enum: ['PAID', 'UNPAID', 'FAILED', 'REFUNDED'],
        required: true
    },
    payment_method: {
        type: String,
        enum: ['UPI', 'CARD', 'NETBANKING', 'CASH', 'INSURANCE'],
        required: true
    },
    transaction_id: {
        type: String,
        required: true
    },
    paid_at: {
        type: Date,
        default: Date.now
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = dashboardConnection.model('Payment', paymentSchema);
