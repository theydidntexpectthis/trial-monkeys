const WebSocket = require('ws');
const http = require('http');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

class WebSocketService {
    constructor() {
        this.clients = new Map(); // userId -> WebSocket
        this.botSubscriptions = new Map(); // botId -> Set(userId)
        this.heartbeatInterval = 30000; // 30 seconds
    }

    // Initialize WebSocket server
    initialize(server) {
        this.wss = new WebSocket.Server({ server });

        this.wss.on('connection', async (ws, req) => {
            try {
                const userId = await this.authenticateConnection(req);
                if (!userId) {
                    ws.close(4001, 'Unauthorized');
                    return;
                }

                this.handleConnection(ws, userId);
            } catch (error) {
                console.error('WebSocket connection error:', error);
                ws.close(4002, 'Connection error');
            }
        });

        // Start heartbeat monitoring
        setInterval(() => this.checkHeartbeats(), this.heartbeatInterval);
    }

    // Handle new connection
    handleConnection(ws, userId) {
        // Store client connection
        this.clients.set(userId, ws);

        // Set up heartbeat
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        // Handle messages
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                this.handleMessage(userId, data);
            } catch (error) {
                console.error('Failed to handle message:', error);
            }
        });

        // Handle disconnection
        ws.on('close', () => {
            this.handleDisconnection(userId);
        });

        // Send welcome message
        this.sendToUser(userId, {
            type: 'connection',
            status: 'connected',
            timestamp: new Date()
        });
    }

    // Authenticate WebSocket connection
    async authenticateConnection(req) {
        try {
            const token = req.headers['authorization']?.split(' ')[1];
            if (!token) return null;

            const decoded = jwt.verify(token, config.jwt.secret);
            return decoded.userId;
        } catch (error) {
            console.error('WebSocket authentication failed:', error);
            return null;
        }
    }

    // Handle incoming messages
    handleMessage(userId, data) {
        switch (data.type) {
            case 'subscribe_bot':
                this.subscribeToBot(userId, data.botId);
                break;

            case 'unsubscribe_bot':
                this.unsubscribeFromBot(userId, data.botId);
                break;

            case 'ping':
                this.sendToUser(userId, { type: 'pong' });
                break;

            default:
                console.warn(`Unknown message type: ${data.type}`);
        }
    }

    // Handle client disconnection
    handleDisconnection(userId) {
        // Remove client
        this.clients.delete(userId);

        // Remove from all bot subscriptions
        for (const [botId, subscribers] of this.botSubscriptions) {
            subscribers.delete(userId);
            if (subscribers.size === 0) {
                this.botSubscriptions.delete(botId);
            }
        }
    }

    // Subscribe user to bot updates
    subscribeToBot(userId, botId) {
        if (!this.botSubscriptions.has(botId)) {
            this.botSubscriptions.set(botId, new Set());
        }
        this.botSubscriptions.get(botId).add(userId);

        this.sendToUser(userId, {
            type: 'subscription_success',
            botId,
            timestamp: new Date()
        });
    }

    // Unsubscribe user from bot updates
    unsubscribeFromBot(userId, botId) {
        const subscribers = this.botSubscriptions.get(botId);
        if (subscribers) {
            subscribers.delete(userId);
            if (subscribers.size === 0) {
                this.botSubscriptions.delete(botId);
            }
        }

        this.sendToUser(userId, {
            type: 'unsubscription_success',
            botId,
            timestamp: new Date()
        });
    }

    // Send message to specific user
    sendToUser(userId, data) {
        const client = this.clients.get(userId);
        if (client?.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                ...data,
                timestamp: new Date()
            }));
        }
    }

    // Broadcast bot update to subscribers
    broadcastBotUpdate(botId, update) {
        const subscribers = this.botSubscriptions.get(botId);
        if (!subscribers) return;

        const message = JSON.stringify({
            type: 'bot_update',
            botId,
            ...update,
            timestamp: new Date()
        });

        subscribers.forEach(userId => {
            const client = this.clients.get(userId);
            if (client?.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    // Send bot monitoring data
    sendBotMonitoring(botId, data) {
        this.broadcastBotUpdate(botId, {
            type: 'monitoring',
            data
        });
    }

    // Send bot status change
    sendBotStatusChange(botId, status) {
        this.broadcastBotUpdate(botId, {
            type: 'status_change',
            status
        });
    }

    // Send bot error alert
    sendBotError(botId, error) {
        this.broadcastBotUpdate(botId, {
            type: 'error',
            error
        });
    }

    // Send bot performance metrics
    sendBotMetrics(botId, metrics) {
        this.broadcastBotUpdate(botId, {
            type: 'metrics',
            metrics
        });
    }

    // Send bot log update
    sendBotLog(botId, log) {
        this.broadcastBotUpdate(botId, {
            type: 'log',
            log
        });
    }

    // Check client heartbeats
    checkHeartbeats() {
        for (const [userId, client] of this.clients) {
            if (!client.isAlive) {
                client.terminate();
                this.handleDisconnection(userId);
                continue;
            }

            client.isAlive = false;
            client.ping();
        }
    }

    // Get connection statistics
    getStats() {
        return {
            totalConnections: this.clients.size,
            totalSubscriptions: Array.from(this.botSubscriptions.values())
                .reduce((sum, subscribers) => sum + subscribers.size, 0),
            monitoredBots: this.botSubscriptions.size
        };
    }

    // Clean up resources
    cleanup() {
        if (this.wss) {
            this.wss.close();
        }
    }
}

module.exports = new WebSocketService();
