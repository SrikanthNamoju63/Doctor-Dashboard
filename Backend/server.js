const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const { authConnection, dashboardConnection } = require('./config/db');

// Database Connection
// Connections are initialized in config/db.js upon import
// You can add listeners here if needed for server startup checks

// Routes
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

app.get('/', (req, res) => {
    res.send('Doctor Dashboard API is running');
});

const doctorRoutes = require('./routes/doctorRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');

app.use('/api/doctors', doctorRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/appointments', require('./routes/appointmentRoutes'));

// Serve Frontend
const path = require('path');
app.use(express.static(path.join(__dirname, '../Frontend')));
// Serve Uploads (for profile images if stored locally)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Catch-all route to serve index.html for non-API requests (SPA support)er, but for simple HTML index it's fine.
// But to be safe if they hit /dashboard or something:
app.get('*', (req, res) => {
    // If it's an API request, don't serve HTML
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ message: 'API Endpoint Not Found' });
    }
    res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for development, restrict in production
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// Middleware to attach io to req
app.use((req, res, next) => {
    req.io = io;
    next();
});

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
