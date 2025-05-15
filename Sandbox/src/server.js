require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

// Import routes
const authRoutes = require('./routes/auth.routes');
const trialRoutes = require('./routes/trial.routes');
const userRoutes = require('./routes/user.routes');
const paymentRoutes = require('./routes/payment.routes');
const botRoutes = require('./routes/bot.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const subscriptionRoutes = require('./routes/subscription.routes');

// Import services
const MonitorService = require('./services/monitor.service');
const NotificationService = require('./services/notification.service');
const SchedulerService = require('./services/scheduler.service');

// Import middleware
const errorMiddleware = require('./middleware/error.middleware');
const authMiddleware = require('./middleware/auth.middleware');

// Import config
const config = require('./config/config');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: config.cors.origin,
    credentials: true
}));

// General middleware
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    }
});
app.use('/api/', limiter);

// Database connection
mongoose.connect(config.database.uri, config.database.options)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Initialize services
MonitorService.initializeMonitoring();
SchedulerService.initializeQueues();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/trials', authMiddleware.verifyToken, trialRoutes);
app.use('/api/users', authMiddleware.verifyToken, userRoutes);
app.use('/api/payments', authMiddleware.verifyToken, paymentRoutes);
app.use('/api/bots', authMiddleware.verifyToken, botRoutes);
app.use('/api/analytics', authMiddleware.verifyToken, analyticsRoutes);
app.use('/api/subscription', authMiddleware.verifyToken, subscriptionRoutes);

// System status endpoint
app.get('/api/status', (req, res) => {
    const status = {
        server: 'running',
        time: new Date(),
        environment: process.env.NODE_ENV,
        services: {
            monitor: MonitorService.getStatus(),
            scheduler: SchedulerService.getQueueStats(),
            notification: NotificationService.getStatus()
        }
    };
    res.json(status);
});

// Documentation redirect
app.get('/docs', (req, res) => {
    res.redirect('/documentation.html');
});

// Error handling
app.use(errorMiddleware.handleError);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Resource not found'
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Starting graceful shutdown...');
    
    // Close database connection
    await mongoose.connection.close();
    
    // Cleanup services
    await SchedulerService.cleanup();
    await MonitorService.cleanup();
    
    process.exit(0);
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Documentation available at http://localhost:${PORT}/docs`);
});

// WebSocket setup for notifications
NotificationService.attach(server);

module.exports = app;
