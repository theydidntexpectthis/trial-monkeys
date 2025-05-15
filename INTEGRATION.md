# Trial Bot Explorer Integration Guide

## Overview
This guide provides detailed instructions for integrating and using the Trial Bot Explorer's components and services. It covers authentication, bot management, trial creation, monitoring, and best practices.

## Table of Contents
1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Bot Management](#bot-management)
4. [Trial Creation](#trial-creation)
5. [Real-time Monitoring](#real-time-monitoring)
6. [WebSocket Integration](#websocket-integration)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

## Getting Started

### Prerequisites
- Node.js v14+
- MongoDB
- Redis
- Phantom Wallet
- BrightData account
- RapidAPI subscription

### Installation
```bash
npm install
cp .env.example .env
# Configure your environment variables
npm run setup
```

## Authentication

### Phantom Wallet Integration
```javascript
// Connect to Phantom Wallet
const connectWallet = async () => {
    try {
        const provider = window.solana;
        if (!provider?.isPhantom) {
            throw new Error('Phantom wallet not found');
        }
        
        const response = await provider.connect();
        const publicKey = response.publicKey.toString();
        
        // Authenticate with backend
        const authResponse = await fetch('/api/auth/phantom', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ publicKey })
        });
        
        const { token } = await authResponse.json();
        localStorage.setItem('authToken', token);
    } catch (error) {
        console.error('Wallet connection failed:', error);
    }
};
```

## Bot Management

### Creating a New Bot
```javascript
const createBot = async (botConfig) => {
    try {
        const response = await fetch('/api/bots', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify(botConfig)
        });
        
        const data = await response.json();
        return data.bot;
    } catch (error) {
        console.error('Bot creation failed:', error);
    }
};
```

### Bot Configuration Example
```javascript
const botConfig = {
    name: 'Netflix Trial Bot',
    serviceType: 'netflix',
    config: {
        autoRetry: true,
        retryAttempts: 3,
        useProxy: true,
        proxyType: 'residential',
        captchaSolving: true
    }
};
```

## Trial Creation

### Starting a Trial
```javascript
const startTrial = async (botId) => {
    try {
        const response = await fetch(`/api/trials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                botId,
                serviceType: 'netflix',
                duration: 30 // days
            })
        });
        
        const data = await response.json();
        return data.trial;
    } catch (error) {
        console.error('Trial creation failed:', error);
    }
};
```

## Real-time Monitoring

### Setting Up WebSocket Connection
```javascript
const wsHandler = new WebSocketHandler();

// Subscribe to bot events
const unsubscribe = wsHandler.subscribeToBotEvents(botId, {
    monitoring: (data) => updateMonitoringCharts(data),
    status_change: (data) => updateBotStatus(data),
    error: (data) => handleBotError(data),
    metrics: (data) => updateMetrics(data),
    log: (data) => appendLog(data)
});

// Cleanup on unmount
window.addEventListener('unload', unsubscribe);
```

### Monitoring Dashboard Integration
```javascript
const monitoringDashboard = new MonitoringDashboard();

// Initialize charts
monitoringDashboard.initializeCharts();

// Start real-time updates
monitoringDashboard.startMonitoring();

// Handle updates
monitoringDashboard.handleDashboardUpdate(data);
```

## WebSocket Integration

### Event Handling
```javascript
wsHandler.addHandler('bot_status', (data) => {
    const { botId, status } = data;
    updateBotStatus(botId, status);
});

wsHandler.addHandler('trial_update', (data) => {
    const { trialId, status, progress } = data;
    updateTrialProgress(trialId, status, progress);
});
```

## Error Handling

### Global Error Handler
```javascript
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showErrorNotification(event.reason.message);
});

const showErrorNotification = (message) => {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
};
```

## Best Practices

### Rate Limiting
- Implement exponential backoff for retries
- Respect service-specific rate limits
- Monitor usage patterns

### Error Handling
- Implement proper error boundaries
- Log errors with context
- Provide user-friendly error messages

### Security
- Always validate user input
- Use HTTPS for all requests
- Implement proper authentication checks
- Sanitize data before display

### Performance
- Implement caching where appropriate
- Use WebSocket for real-time updates
- Optimize database queries
- Implement pagination for large datasets

### Monitoring
- Monitor bot performance metrics
- Track success rates
- Set up alerts for critical issues
- Maintain audit logs

## Example Implementation

### Complete Bot Integration
```javascript
class BotManager {
    constructor() {
        this.wsHandler = new WebSocketHandler();
        this.initializeEventListeners();
    }

    async initializeBot(config) {
        // Create bot
        const bot = await createBot(config);
        
        // Subscribe to updates
        this.subscribeToBotUpdates(bot.id);
        
        // Initialize monitoring
        await this.initializeMonitoring(bot.id);
        
        return bot;
    }

    subscribeToBotUpdates(botId) {
        return this.wsHandler.subscribeToBotEvents(botId, {
            status_change: (data) => this.handleStatusChange(data),
            error: (data) => this.handleError(data),
            log: (data) => this.handleLog(data)
        });
    }

    async startTrial(botId) {
        const trial = await startTrial(botId);
        this.monitorTrial(trial.id);
        return trial;
    }

    monitorTrial(trialId) {
        // Implementation
    }

    handleStatusChange(data) {
        // Implementation
    }

    handleError(data) {
        // Implementation
    }

    handleLog(data) {
        // Implementation
    }
}
```

### Usage Example
```javascript
const botManager = new BotManager();

// Create and initialize bot
const bot = await botManager.initializeBot({
    name: 'Netflix Trial Bot',
    serviceType: 'netflix',
    config: {
        autoRetry: true,
        useProxy: true
    }
});

// Start trial
const trial = await botManager.startTrial(bot.id);

// Monitor progress
botManager.monitorTrial(trial.id);
```

## Support
For additional support or questions, please refer to:
- [API Documentation](/docs/API.md)
- [Troubleshooting Guide](/docs/TROUBLESHOOTING.md)
- [Security Guidelines](/docs/SECURITY.md)
