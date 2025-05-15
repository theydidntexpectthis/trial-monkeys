class DashboardManager {
    constructor() {
        this.initializeEventListeners();
        this.loadBots();
        this.updateStats();
        this.startActivityMonitor();
        this.initializeSettingsSupport();
    // Initialize settings support
    initializeSettingsSupport() {
        this.notificationPreferences = {
            enabled: localStorage.getItem('notifications') === 'true',
            browser: true,
            email: true
        };

        this.botSettings = {
            autoRetry: localStorage.getItem('autoRetry') || 'off',
            retryAttempts: {
                'off': 0,
                'once': 1,
                'three': 3
            }
        };
    }

    // Update notification preferences
    updateNotificationPreferences(enabled) {
        this.notificationPreferences.enabled = enabled;
        if (enabled) {
            this.showToast('Notifications enabled', 'success');
        } else {
            this.showToast('Notifications disabled', 'info');
        }
        this.updateBotMonitoring();
    }

    // Update bot retry settings
    updateBotRetrySettings(setting) {
        this.botSettings.autoRetry = setting;
        const attempts = this.botSettings.retryAttempts[setting];
        this.showToast(`Auto-retry set to ${attempts} attempt${attempts !== 1 ? 's' : ''}`, 'info');
        this.updateActiveBots();
    }

    // Update bot monitoring based on notification preferences
    updateBotMonitoring() {
        const activeTrials = document.querySelectorAll('.bot-card[data-status="active"]');
        activeTrials.forEach(trial => {
            const botId = trial.dataset.botId;
            if (this.notificationPreferences.enabled) {
                this.startBotMonitoring(botId);
            } else {
                this.stopBotMonitoring(botId);
            }
        });
    }

    // Update active bots with new settings
    updateActiveBots() {
        const activeTrials = document.querySelectorAll('.bot-card[data-status="active"]');
        activeTrials.forEach(trial => {
            const botId = trial.dataset.botId;
            this.updateBotRetryConfig(botId);
        });
    }

    // Start monitoring specific bot
    startBotMonitoring(botId) {
        console.log(`Started monitoring bot: ${botId}`);
    }

    // Stop monitoring specific bot
    stopBotMonitoring(botId) {
        console.log(`Stopped monitoring bot: ${botId}`);
    }

    // Update bot retry configuration
    updateBotRetryConfig(botId) {
        const attempts = this.botSettings.retryAttempts[this.botSettings.autoRetry];
        console.log(`Updated bot ${botId} retry attempts to ${attempts}`);
    }
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // Search functionality
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        // Bot launch buttons
        document.querySelectorAll('.btn-primary.btn-full').forEach(button => {
            button.addEventListener('click', (e) => this.handleBotLaunch(e));
        });

        // Category filtering
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', (e) => this.filterBotsByCategory(e));
        });

        // Notification handling
        const notificationBell = document.querySelector('.notifications');
        if (notificationBell) {
            notificationBell.addEventListener('click', () => this.showNotifications());
        }
    }

    // Handle bot search
    handleSearch(query) {
        const botCards = document.querySelectorAll('.bot-card');
        query = query.toLowerCase();

        botCards.forEach(card => {
            const botName = card.querySelector('h3').textContent.toLowerCase();
            const botDescription = card.querySelector('p').textContent.toLowerCase();
            
            if (botName.includes(query) || botDescription.includes(query)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    // Handle bot launch
    async handleBotLaunch(event) {
        const botCard = event.target.closest('.bot-card');
        const botName = botCard.querySelector('h3').textContent;
        const button = event.target;

        try {
            button.disabled = true;
            button.textContent = 'Launching...';

            // Simulate bot launch process
            await this.launchBot(botName);

            this.showToast(`Successfully launched ${botName}`, 'success');
            this.addActivityItem({
                type: 'success',
                title: `${botName} Launched`,
                description: 'Bot started successfully',
                time: 'Just now'
            });

        } catch (error) {
            this.showToast(`Failed to launch ${botName}: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            button.textContent = 'Launch Bot';
        }
    }

    // Simulate bot launch
    async launchBot(botName) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const success = Math.random() > 0.1; // 90% success rate
                if (success) {
                    resolve();
                } else {
                    reject(new Error('Connection failed'));
                }
            }, 2000);
        });
    }

    // Filter bots by category
    filterBotsByCategory(event) {
        const category = event.currentTarget.querySelector('h3').textContent.toLowerCase();
        const botCards = document.querySelectorAll('.bot-card');

        document.querySelectorAll('.category-card').forEach(card => {
            card.classList.remove('active');
        });
        event.currentTarget.classList.add('active');

        botCards.forEach(card => {
            const botCategory = card.dataset.category?.toLowerCase();
            if (category === 'all' || botCategory === category) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    // Show notifications panel
    showNotifications() {
        // Implementation for notifications panel
        this.showToast('Notifications feature coming soon!', 'info');
    }

    // Load bots data
    async loadBots() {
        try {
            // Simulate API call to load bots
            const response = await fetch('/api/bots');
            const bots = await response.json();
            this.renderBots(bots);
        } catch (error) {
            console.error('Failed to load bots:', error);
            this.showToast('Failed to load bots', 'error');
        }
    }

    // Render bot cards
    renderBots(bots) {
        const botGrid = document.querySelector('.bot-grid');
        if (!botGrid) return;

        botGrid.innerHTML = bots.map(bot => `
            <div class="bot-card" data-category="${bot.category}">
                <div class="bot-header">
                    <img src="${bot.icon}" alt="${bot.name}" class="bot-icon">
                    <span class="bot-status ${bot.status}">${bot.status}</span>
                </div>
                <h3>${bot.name}</h3>
                <p>${bot.description}</p>
                <div class="bot-stats">
                    <span><i class="fas fa-user-check"></i> ${bot.successRate}% success</span>
                    <span><i class="fas fa-clock"></i> ${bot.trialDuration}</span>
                </div>
                <button class="btn-primary btn-full">Launch Bot</button>
            </div>
        `).join('');

        this.initializeEventListeners();
    }

    // Update dashboard statistics
    updateStats() {
        const stats = {
            totalBots: 500,
            activeTrials: Math.floor(Math.random() * 200),
            totalUsers: 10500,
            successRate: 98.5
        };

        Object.entries(stats).forEach(([key, value]) => {
            const element = document.querySelector(`[data-stat="${key}"]`);
            if (element) {
                element.textContent = typeof value === 'number' && !Number.isInteger(value) 
                    ? value.toFixed(1) 
                    : value;
            }
        });
    }

    // Monitor and update activity feed
    startActivityMonitor() {
        setInterval(() => {
            this.updateActivityTimes();
        }, 60000); // Update every minute
    }

    // Update activity timestamps
    updateActivityTimes() {
        document.querySelectorAll('.activity-time').forEach(timeElement => {
            const timestamp = timeElement.dataset.timestamp;
            if (timestamp) {
                timeElement.textContent = this.getTimeAgo(new Date(timestamp));
            }
        });
    }

    // Add new activity item
    addActivityItem(activity) {
        const activityList = document.querySelector('.activity-list');
        if (!activityList) return;

        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <i class="fas fa-${activity.type === 'success' ? 'check-circle success' : 'info-circle primary'}"></i>
            <div class="activity-info">
                <h4>${activity.title}</h4>
                <p>${activity.description}</p>
            </div>
            <span class="activity-time" data-timestamp="${new Date().toISOString()}">${activity.time}</span>
        `;

        activityList.insertBefore(activityItem, activityList.firstChild);
    }

    // Show toast notification
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
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

    // Helper function to format time ago
    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + ' years ago';
        
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + ' months ago';
        
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + ' days ago';
        
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + ' hours ago';
        
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + ' minutes ago';
        
        return 'Just now';
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new DashboardManager();
});
