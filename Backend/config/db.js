const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const authURI = process.env.AUTH_DB_URI || 'mongodb://127.0.0.1:27017/HealthPredict_DoctorRegistration';
const userAppURI = process.env.USER_APP_DB_URI || 'mongodb://127.0.0.1:27017/HealthPredict_UserApp';
const dashboardURI = process.env.DASHBOARD_DB_URI || 'mongodb://127.0.0.1:27017/HealthPredict_DoctorDashboard';

// Create separate connections
const authConnection = mongoose.createConnection(authURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const dashboardConnection = mongoose.createConnection(dashboardURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const userAppConnection = mongoose.createConnection(userAppURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

authConnection.on('connected', () => {
    console.log('MongoDB connected to Auth DB (HealthPredict_DoctorRegistration)');
});

authConnection.on('error', (err) => {
    console.error('Auth DB connection error:', err);
});

dashboardConnection.on('connected', () => {
    console.log('MongoDB connected to Dashboard DB (HealthPredict_DoctorDashboard)');
});

dashboardConnection.on('error', (err) => {
    console.error('Dashboard DB connection error:', err);
});

userAppConnection.on('connected', () => {
    console.log('MongoDB connected to User App DB (HealthPredict_UserApp)');
});

userAppConnection.on('error', (err) => {
    console.error('User App DB connection error:', err);
});

module.exports = {
    authConnection,
    dashboardConnection,
    userAppConnection
};
