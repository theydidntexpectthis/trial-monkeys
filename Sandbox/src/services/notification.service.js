const WebSocket = require('ws');
const User = require('../models/user.model');
const config = require('../config/config');

class NotificationService {
    constructor() {
        this.clients = new Map(); // userId -> WebSocket
        this.subscriptions = new Map(); // userId -> [eventTypes]
        this.initializeWebSocket();
    }

    // Initialize WebSocket server
    initializeWebSocket() {
        this.wss = new WebSocket.Server({
            port: config.websocket.port || 8080
        });

        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });
    }

    // Handle new WebSocket connection
    handleConnection(ws, req) {
        const userId = this.authenticateConnection(req);
        if (!userId) {
            ws.close(4001, 'Unauthorized');
            return;
        }

        // Store client connection
        this.clients.set(userId, ws);

        // Setup message handling
        ws.on('message', (message) => {
            this.handleMessage(userId, message);
        });

        // Handle disconnection
        ws.on('close', () => {
            this.handleDisconnection(userId);
        });

        // Send welcome message
        this.sendToClient(userId, {
            type: 'connection',
            status: 'connected',
            timestamp: new Date()
        });
    }

    // Authenticate WebSocket connection
    authenticateConnection(req) {
        try {
            const token = req.headers['authorization'];
            if (!token) return null;

            // Verify token and get userId
            // Implementation depends on your auth system
            return 'user_id'; // Placeholder
        } catch (error) {
            console.error('WebSocket authentication failed:', error);
            return null;
        }
    }

    // Handle incoming WebSocket messages
    handleMessage(userId, message) {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'subscribe':
                    this.handleSubscription(userId, data.events);
                    break;
                case 'unsubscribe':
                    this.handleUnsubscription(userId, data.events);
                    break;
                case 'ping':
                    this.sendToClient(userId, { type: 'pong' });
                    break;
                default:
                    console.warn(`Unknown message type: ${data.type}`);
            }
        } catch (error) {
            console.error('Failed to handle message:', error);
        }
    }

    // Handle client disconnection
    handleDisconnection(userId) {
        this.clients.delete(userId);
        this.subscriptions.delete(userId);
    }

    // Handle event subscriptions
    handleSubscription(userId, events) {
        if (!Array.isArray(events)) events = [events];
        
        const userSubs = this.subscriptions.get(userId) || new Set();
        events.forEach(event => userSubs.add(event));
        this.subscriptions.set(userId, userSubs);

        this.sendToClient(userId, {
            type: 'subscription_update',
            subscribed: Array.from(userSubs)
        });
    }

    // Handle event unsubscriptions
    handleUnsubscription(userId, events) {
        if (!Array.isArray(events)) events = [events];
        
        const userSubs = this.subscriptions.get(userId);
        if (userSubs) {
            events.forEach(event => userSubs.delete(event));
            this.subscriptions.set(userId, userSubs);
        }

        this.sendToClient(userId, {
            type: 'subscription_update',
            subscribed: Array.from(userSubs || [])
        });
    }

    // Send notification to specific user
    async sendToUser(userId, notification) {
        try {
            // Check user notification preferences
            const user = await User.findById(userId);
            if (!user) return;

            // Send in-app notification
            this.sendToClient(userId, notification);

            // Send email if enabled
            if (user.preferences?.notifications?.email) {
                await this.sendEmail(user.email, notification);
            }

            // Send browser notification if enabled
            if (user.preferences?.notifications?.browser) {
                this.sendBrowserNotification(userId, notification);
            }

            // Store notification in database
            await this.storeNotification(userId, notification);

        } catch (error) {
            console.error('Failed to send notification:', error);
        }
    }

    // Send to WebSocket client
    sendToClient(userId, data) {
        const client = this.clients.get(userId);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                ...data,
                timestamp: new Date()
            }));
        }
    }

    // Broadcast notification to all subscribers
    broadcast(notification, eventType) {
        for (const [userId, subs] of this.subscriptions.entries()) {
            if (subs.has(eventType) || subs.has('all')) {
                this.sendToClient(userId, notification);
            }
        }
    }

    // Send email notification
    async sendEmail(email, notification) {
        try {
            // Implementation depends on your email service
            console.log(`Sending email to ${email}:`, notification);
        } catch (error) {
            console.error('Failed to send email:', error);
        }
    }

    // Send browser notification
    sendBrowserNotification(userId, notification) {
        const client = this.clients.get(userId);
        if (client) {
            client.send(JSON.stringify({
                type: 'browser_notification',
                title: notification.title,
                body: notification.message,
                icon: notification.icon,
                timestamp: new Date()
            }));
        }
    }

    // Store notification in database
    async storeNotification(userId, notification) {
        try {
            await User.findByIdAndUpdate(userId, {
                $push: {
                    notifications: {
                        ...notification,
                        timestamp: new Date()
                    }
                }
            });
        } catch (error) {
            console.error('Failed to store notification:', error);
        }
    }

    // Send bot status update
    async sendBotStatusUpdate(botId, status) {
        const notification = {
            type: 'bot_status',
            botId,
            status,
            message: `Bot ${botId} status changed to ${status}`
        };

        this.broadcast(notification, 'bot_status');
    }

    // Send trial progress update
    async sendTrialProgress(userId, trialId, progress) {
        const notification = {
            type: 'trial_progress',
            trialId,
            progress,
            message: `Trial ${trialId} progress: ${progress}%`
        };

        await this.sendToUser(userId, notification);
    }

    // Send trial completion notification
    async sendTrialCompletion(userId, trialId, success) {
        const notification = {
            type: 'trial_completion',
            trialId,
            success,
            message: success ? 
                `Trial ${trialId} completed successfully` : 
                `Trial ${trialId} failed`
        };

        await this.sendToUser(userId, notification);
    }

    // Send system alert
    async sendSystemAlert(message, level = 'info') {
        const notification = {
            type: 'system_alert',
            level,
            message
        };

        this.broadcast(notification, 'system_alerts');
    }

    // Get user's notifications
    async getUserNotifications(userId) {
        try {
            const user = await User.findById(userId);
            return user.notifications || [];
        } catch (error) {
            console.error('Failed to get notifications:', error);
            return [];
        }
    }

    // Mark notification as read
    async markNotificationRead(userId, notificationId) {
        try {
            await User.findOneAndUpdate(
                { _id: userId, 'notifications._id': notificationId },
                { $set: { 'notifications.$.read': true } }
            );
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    }

    // Clear user's notifications
    async clearNotifications(userId) {
        try {
            await User.findByIdAndUpdate(userId, {
                $set: { notifications: [] }
            });
        } catch (error) {
            console.error('Failed to clear notifications:', error);
        }
    }
}

module.exports = new NotificationService();
