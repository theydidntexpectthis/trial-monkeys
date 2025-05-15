const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const MonitorService = require('./monitor.service');
const NotificationService = require('./notification.service');
const StatsService = require('./stats.service');
const config = require('../config/config');

class WebSocketEventsService {
    constructor() {
        this.eventHandlers = new Map();
        this.subscriptions = new Map(); // userId -> Set<eventType>
        this.clientSessions = new Map(); // userId -> WebSocket
        this.initializeEventHandlers();
    }

    // Initialize default event handlers
    initializeEventHandlers() {
        // Bot status updates
        this.eventHandlers.set('bot_status', async (userId, data) => {
            const { botId, status } = data;
            await MonitorService.updateBotStatus(botId, status);
            this.broadcastToUser(userId, 'bot_status_update', { botId, status });
        });

        // Trial updates
        this.eventHandlers.set('trial_update', async (userId, data) => {
            const { trialId, status, details } = data;
            await this.handleTrialUpdate(userId, trialId, status, details);
        });

        // System alerts
        this.eventHandlers.set('system_alert', async (userId, data) => {
            const { type, message, severity } = data;
            await this.handleSystemAlert(userId, type, message, severity);
        });

        // Dashboard updates
        this.eventHandlers.set('dashboard_update', async (userId, data) => {
            await this.handleDashboardUpdate(userId, data);
        });

        // Performance metrics
        this.eventHandlers.set('performance_metrics', async (userId, data) => {
            await this.handlePerformanceMetrics(userId, data);
        });
    }

    // Handle new WebSocket connection
    async handleConnection(ws, req) {
        try {
            const userId = await this.authenticateConnection(req);
            if (!userId) {
                ws.close(4001, 'Unauthorized');
                return;
            }

            // Store client session
            this.clientSessions.set(userId, ws);

            // Set up heartbeat
            ws.isAlive = true;
            ws.on('pong', () => { ws.isAlive = true; });

            // Handle messages
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleMessage(userId, data);
                } catch (error) {
                    console.error('Failed to handle message:', error);
                    this.sendError(ws, 'Invalid message format');
                }
            });

            // Handle disconnection
            ws.on('close', () => {
                this.handleDisconnection(userId);
            });

            // Send welcome message
            this.sendToClient(ws, {
                type: 'connection_established',
                timestamp: new Date()
            });

        } catch (error) {
            console.error('WebSocket connection error:', error);
            ws.close(4002, 'Connection error');
        }
    }

    // Authenticate WebSocket connection
    async authenticateConnection(req) {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) return null;

            const decoded = jwt.verify(token, config.jwt.secret);
            const user = await User.findById(decoded.userId);
            return user ? user._id : null;
        } catch (error) {
            console.error('WebSocket authentication failed:', error);
            return null;
        }
    }

    // Handle incoming messages
    async handleMessage(userId, data) {
        const { type, payload } = data;

        // Handle subscriptions
        if (type === 'subscribe') {
            await this.handleSubscription(userId, payload.events);
            return;
        }

        // Handle unsubscriptions
        if (type === 'unsubscribe') {
            await this.handleUnsubscription(userId, payload.events);
            return;
        }

        // Handle event
        const handler = this.eventHandlers.get(type);
        if (handler) {
            await handler(userId, payload);
        }
    }

    // Handle subscription request
    async handleSubscription(userId, events) {
        if (!this.subscriptions.has(userId)) {
            this.subscriptions.set(userId, new Set());
        }

        const userSubs = this.subscriptions.get(userId);
        events.forEach(event => userSubs.add(event));

        this.sendToUser(userId, {
            type: 'subscription_update',
            subscribed: Array.from(userSubs)
        });
    }

    // Handle unsubscription request
    async handleUnsubscription(userId, events) {
        const userSubs = this.subscriptions.get(userId);
        if (userSubs) {
            events.forEach(event => userSubs.delete(event));
        }

        this.sendToUser(userId, {
            type: 'subscription_update',
            subscribed: Array.from(userSubs || [])
        });
    }

    // Handle trial update
    async handleTrialUpdate(userId, trialId, status, details) {
        // Update trial status
        await require('./trial-account.service').updateTrialStatus(trialId, status);

        // Send notification
        await NotificationService.sendToUser(userId, {
            type: 'trial_update',
            title: 'Trial Status Update',
            message: `Trial ${trialId} status: ${status}`,
            details
        });

        // Broadcast update
        this.broadcastToUser(userId, 'trial_status_update', {
            trialId,
            status,
            details
        });
    }

    // Handle system alert
    async handleSystemAlert(userId, type, message, severity) {
        // Log alert
        await MonitorService.logSystemAlert(type, message, severity);

        // Notify user
        await NotificationService.sendToUser(userId, {
            type: 'system_alert',
            title: 'System Alert',
            message,
            severity
        });

        // Broadcast alert
        this.broadcastToSubscribers('system_alert', {
            type,
            message,
            severity,
            timestamp: new Date()
        });
    }

    // Handle dashboard update
    async handleDashboardUpdate(userId, data) {
        // Update statistics
        await StatsService.updateDashboardStats(userId, data);

        // Broadcast update
        this.broadcastToUser(userId, 'dashboard_update', data);
    }

    // Handle performance metrics
    async handlePerformanceMetrics(userId, data) {
        // Update metrics
        await StatsService.updatePerformanceMetrics(userId, data);

        // Broadcast update
        this.broadcastToUser(userId, 'performance_update', data);
    }

    // Broadcast to specific user
    broadcastToUser(userId, type, data) {
        const ws = this.clientSessions.get(userId);
        if (ws?.readyState === WebSocket.OPEN) {
            this.sendToClient(ws, {
                type,
                data,
                timestamp: new Date()
            });
        }
    }

    // Broadcast to all subscribers
    broadcastToSubscribers(eventType, data) {
        for (const [userId, subs] of this.subscriptions) {
            if (subs.has(eventType)) {
                this.broadcastToUser(userId, eventType, data);
            }
        }
    }

    // Send message to client
    sendToClient(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    // Send error to client
    sendError(ws, message) {
        this.sendToClient(ws, {
            type: 'error',
            message,
            timestamp: new Date()
        });
    }

    // Handle client disconnection
    handleDisconnection(userId) {
        this.clientSessions.delete(userId);
        this.subscriptions.delete(userId);
    }

    // Check client connections
    checkConnections() {
        for (const [userId, ws] of this.clientSessions) {
            if (!ws.isAlive) {
                this.handleDisconnection(userId);
                ws.terminate();
                continue;
            }

            ws.isAlive = false;
            ws.ping();
        }
    }

    // Get connection statistics
    getConnectionStats() {
        return {
            activeConnections: this.clientSessions.size,
            totalSubscriptions: Array.from(this.subscriptions.values())
                .reduce((sum, subs) => sum + subs.size, 0),
            events: Array.from(this.eventHandlers.keys())
        };
    }

    // Start heartbeat monitoring
    startHeartbeat() {
        setInterval(() => {
            this.checkConnections();
        }, 30000); // Check every 30 seconds
    }
}

module.exports = new WebSocketEventsService();
