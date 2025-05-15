class WebSocketHandler {
    constructor() {
        this.baseUrl = window.location.hostname === 'localhost' ? 
            'ws://localhost:3000' : 
            `wss://${window.location.host}`;
        
        this.subscriptions = new Set();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second
        
        this.handlers = {
            'bot_update': new Set(),
            'monitoring': new Set(),
            'status_change': new Set(),
            'error': new Set(),
            'metrics': new Set(),
            'log': new Set()
        };

        this.connect();
    }

    // Establish WebSocket connection
    connect() {
        try {
            this.ws = new WebSocket(this.baseUrl);
            
            // Add authentication token
            this.ws.onopen = () => {
                this.ws.send(JSON.stringify({
                    type: 'authenticate',
                    token: localStorage.getItem('authToken')
                }));

                // Resubscribe to previous subscriptions
                this.resubscribe();

                // Reset reconnect attempts
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;

                // Start heartbeat
                this.startHeartbeat();
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.ws.onclose = (event) => {
                this.handleDisconnection(event);
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.showToast('Connection error occurred', 'error');
            };

        } catch (error) {
            console.error('Failed to establish WebSocket connection:', error);
            this.handleDisconnection();
        }
    }

    // Handle incoming messages
    handleMessage(message) {
        // Handle system messages
        switch (message.type) {
            case 'connection':
                this.showToast('Connected to real-time updates', 'success');
                return;

            case 'pong':
                this.lastPong = Date.now();
                return;

            case 'subscription_success':
                this.subscriptions.add(message.botId);
                return;

            case 'unsubscription_success':
                this.subscriptions.delete(message.botId);
                return;
        }

        // Handle bot updates
        if (this.handlers[message.type]) {
            this.handlers[message.type].forEach(handler => {
                try {
                    handler(message);
                } catch (error) {
                    console.error(`Handler error for ${message.type}:`, error);
                }
            });
        }
    }

    // Handle disconnection
    handleDisconnection(event) {
        // Clear heartbeat
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        // Attempt reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.reconnectDelay *= 2; // Exponential backoff

            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay);

            this.showToast(`Connection lost. Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'warning');
        } else {
            this.showToast('Connection lost. Please refresh the page.', 'error');
        }
    }

    // Subscribe to bot updates
    subscribeToBotUpdates(botId) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'subscribe_bot',
                botId
            }));
        }
    }

    // Unsubscribe from bot updates
    unsubscribeFromBotUpdates(botId) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'unsubscribe_bot',
                botId
            }));
        }
    }

    // Resubscribe to previous subscriptions
    resubscribe() {
        this.subscriptions.forEach(botId => {
            this.subscribeToBotUpdates(botId);
        });
    }

    // Add message handler
    addHandler(type, handler) {
        if (this.handlers[type]) {
            this.handlers[type].add(handler);
        }
    }

    // Remove message handler
    removeHandler(type, handler) {
        if (this.handlers[type]) {
            this.handlers[type].delete(handler);
        }
    }

    // Start heartbeat monitoring
    startHeartbeat() {
        this.lastPong = Date.now();
        
        this.heartbeatInterval = setInterval(() => {
            if (this.ws.readyState === WebSocket.OPEN) {
                // Check if we've received a pong recently
                if (Date.now() - this.lastPong > 45000) { // 45 seconds
                    // Connection might be dead
                    this.ws.close();
                    return;
                }

                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000); // Send ping every 30 seconds
    }

    // Subscribe to specific bot events
    subscribeToBotEvents(botId, handlers) {
        this.subscribeToBotUpdates(botId);

        // Add handlers
        Object.entries(handlers).forEach(([type, handler]) => {
            this.addHandler(type, handler);
        });

        // Return unsubscribe function
        return () => {
            this.unsubscribeFromBotUpdates(botId);
            Object.entries(handlers).forEach(([type, handler]) => {
                this.removeHandler(type, handler);
            });
        };
    }

    // Show toast notification
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Close connection
    close() {
        if (this.ws) {
            this.ws.close();
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
    }
}

// Create global instance
window.wsHandler = new WebSocketHandler();

// Clean up on page unload
window.addEventListener('unload', () => {
    if (window.wsHandler) {
        window.wsHandler.close();
    }
});

// Example usage in bot details page:
/*
const unsubscribe = wsHandler.subscribeToBotEvents(botId, {
    monitoring: (data) => updateMonitoringCharts(data),
    status_change: (data) => updateBotStatus(data),
    error: (data) => handleBotError(data),
    metrics: (data) => updateMetrics(data),
    log: (data) => appendLog(data)
});

// Cleanup when leaving page
window.addEventListener('unload', unsubscribe);
*/
