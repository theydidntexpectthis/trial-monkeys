class BotManager {
    constructor() {
        this.bots = new Map();
        this.currentView = 'grid';
        this.filters = {
            category: '',
            status: '',
            sort: 'name'
        };
        
        this.initializeEventListeners();
        this.loadBots();
    }

    // Initialize event listeners
    initializeEventListeners() {
        // View toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => this.toggleView(btn.dataset.view));
        });

        // Filters
        document.getElementById('category-filter')?.addEventListener('change', (e) => {
            this.filters.category = e.target.value;
            this.applyFilters();
        });

        document.getElementById('status-filter')?.addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.applyFilters();
        });

        document.getElementById('sort-filter')?.addEventListener('change', (e) => {
            this.filters.sort = e.target.value;
            this.applyFilters();
        });

        // Search
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        // Modal close buttons
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Service type change
        document.getElementById('service-type')?.addEventListener('change', (e) => {
            const customConfig = document.getElementById('custom-config');
            if (customConfig) {
                customConfig.classList.toggle('hidden', e.target.value !== 'custom');
            }
        });
    }

    // Load bots from API
    async loadBots() {
        try {
            const response = await fetch('/api/bots', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.bots.clear();
                data.bots.forEach(bot => this.bots.set(bot.id, bot));
                this.renderBots();
            }
        } catch (error) {
            console.error('Failed to load bots:', error);
            this.showToast('Failed to load bots', 'error');
        }
    }

    // Toggle view between grid and list
    toggleView(view) {
        const container = document.getElementById('bot-container');
        const listView = document.getElementById('bot-list');
        
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        if (view === 'grid') {
            container.classList.remove('hidden');
            listView.classList.add('hidden');
        } else {
            container.classList.add('hidden');
            listView.classList.remove('hidden');
        }

        this.currentView = view;
        this.renderBots();
    }

    // Render bots in current view
    renderBots() {
        const container = this.currentView === 'grid' ? 
            document.getElementById('bot-container') : 
            document.getElementById('bot-list');

        if (!container) return;

        container.innerHTML = '';
        const filteredBots = this.getFilteredBots();

        filteredBots.forEach(bot => {
            const element = this.currentView === 'grid' ? 
                this.createBotCard(bot) : 
                this.createBotListItem(bot);
            
            container.appendChild(element);
        });
    }

    // Create bot card for grid view
    createBotCard(bot) {
        const card = document.createElement('div');
        card.className = 'bot-card';
        card.innerHTML = `
            <span class="status-badge ${bot.status}">${bot.status}</span>
            <img src="${bot.icon}" alt="${bot.name}" class="bot-icon">
            <div class="bot-info">
                <h3>${bot.name}</h3>
                <p>${bot.description}</p>
            </div>
            <div class="bot-metrics">
                <div class="metric">
                    <div class="metric-value">${bot.successRate}%</div>
                    <div class="metric-label">Success Rate</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${bot.totalRuns}</div>
                    <div class="metric-label">Total Runs</div>
                </div>
            </div>
            <div class="bot-actions">
                <button class="btn-primary" onclick="botManager.launchBot('${bot.id}')">
                    Launch
                </button>
                <button class="btn-secondary" onclick="botManager.showBotDetails('${bot.id}')">
                    Details
                </button>
            </div>
        `;
        return card;
    }

    // Create bot list item for list view
    createBotListItem(bot) {
        const item = document.createElement('div');
        item.className = 'bot-list-item';
        item.innerHTML = `
            <img src="${bot.icon}" alt="${bot.name}" class="bot-list-icon">
            <div class="bot-list-info">
                <h3>${bot.name}</h3>
                <p>${bot.description}</p>
            </div>
            <div class="bot-list-metrics">
                <div class="metric">
                    <div class="metric-value">${bot.successRate}%</div>
                    <div class="metric-label">Success Rate</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${bot.totalRuns}</div>
                    <div class="metric-label">Total Runs</div>
                </div>
            </div>
            <div class="bot-list-actions">
                <button class="btn-primary" onclick="botManager.launchBot('${bot.id}')">
                    Launch
                </button>
                <button class="btn-secondary" onclick="botManager.showBotDetails('${bot.id}')">
                    Details
                </button>
            </div>
        `;
        return item;
    }

    // Get filtered and sorted bots
    getFilteredBots() {
        let filteredBots = Array.from(this.bots.values());

        // Apply category filter
        if (this.filters.category) {
            filteredBots = filteredBots.filter(bot => 
                bot.category === this.filters.category
            );
        }

        // Apply status filter
        if (this.filters.status) {
            filteredBots = filteredBots.filter(bot => 
                bot.status === this.filters.status
            );
        }

        // Apply sorting
        filteredBots.sort((a, b) => {
            switch (this.filters.sort) {
                case 'success-rate':
                    return b.successRate - a.successRate;
                case 'last-used':
                    return new Date(b.lastUsed) - new Date(a.lastUsed);
                case 'created':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                default:
                    return a.name.localeCompare(b.name);
            }
        });

        return filteredBots;
    }

    // Handle search
    handleSearch(query) {
        const elements = this.currentView === 'grid' ? 
            document.querySelectorAll('.bot-card') : 
            document.querySelectorAll('.bot-list-item');

        elements.forEach(element => {
            const name = element.querySelector('h3').textContent.toLowerCase();
            const description = element.querySelector('p').textContent.toLowerCase();
            
            if (name.includes(query.toLowerCase()) || description.includes(query.toLowerCase())) {
                element.style.display = '';
            } else {
                element.style.display = 'none';
            }
        });
    }

    // Show bot details modal
    async showBotDetails(botId) {
        const bot = this.bots.get(botId);
        if (!bot) return;

        const modal = document.getElementById('bot-details-modal');
        if (!modal) return;

        // Update modal content
        document.getElementById('bot-success-rate').textContent = `${bot.successRate}%`;
        document.getElementById('bot-total-runs').textContent = bot.totalRuns;
        document.getElementById('bot-last-run').textContent = this.getTimeAgo(new Date(bot.lastUsed));

        // Load bot configuration
        document.getElementById('bot-retry-config').value = bot.config.retryAttempts;
        document.getElementById('bot-proxy-config').value = bot.config.proxy;
        document.getElementById('bot-notify-success').checked = bot.config.notifications.success;
        document.getElementById('bot-notify-failure').checked = bot.config.notifications.failure;

        // Load recent logs
        const logsContainer = document.getElementById('bot-logs');
        logsContainer.innerHTML = bot.logs.map(log => `
            <div class="log-entry">
                <span class="log-time">${this.getTimeAgo(new Date(log.timestamp))}</span>
                <span class="log-message">${log.message}</span>
            </div>
        `).join('');

        modal.classList.remove('hidden');
    }

    // Launch bot
    async launchBot(botId) {
        try {
            const response = await fetch(`/api/bots/${botId}/launch`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.showToast('Bot launched successfully', 'success');
                await this.loadBots(); // Refresh bot list
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Failed to launch bot:', error);
            this.showToast('Failed to launch bot: ' + error.message, 'error');
        }
    }

    // Create new bot
    async createNewBot() {
        const form = document.getElementById('new-bot-form');
        if (!form) return;

        const formData = {
            serviceType: document.getElementById('service-type').value,
            name: document.getElementById('bot-name').value,
            config: {
                autoRetry: document.getElementById('auto-retry').checked,
                useProxy: document.getElementById('use-proxy').checked
            }
        };

        if (formData.serviceType === 'custom') {
            formData.config.serviceUrl = document.getElementById('service-url').value;
            formData.config.trialDuration = document.getElementById('trial-duration').value;
        }

        try {
            const response = await fetch('/api/bots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (data.success) {
                this.showToast('Bot created successfully', 'success');
                this.closeModals();
                await this.loadBots();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Failed to create bot:', error);
            this.showToast('Failed to create bot: ' + error.message, 'error');
        }
    }

    // Delete bot
    async deleteBot() {
        const botId = this.currentBotId;
        if (!botId) return;

        if (!confirm('Are you sure you want to delete this bot?')) return;

        try {
            const response = await fetch(`/api/bots/${botId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.showToast('Bot deleted successfully', 'success');
                this.closeModals();
                await this.loadBots();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Failed to delete bot:', error);
            this.showToast('Failed to delete bot: ' + error.message, 'error');
        }
    }

    // Reset bot statistics
    async resetBotStats() {
        const botId = this.currentBotId;
        if (!botId) return;

        try {
            const response = await fetch(`/api/bots/${botId}/reset-stats`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.showToast('Bot statistics reset successfully', 'success');
                await this.loadBots();
                this.showBotDetails(botId);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Failed to reset bot stats:', error);
            this.showToast('Failed to reset statistics: ' + error.message, 'error');
        }
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

    // Close all modals
    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
    }
}

// Initialize bot manager
window.botManager = new BotManager();

// Global functions for HTML onclick handlers
window.showNewBotModal = () => {
    const modal = document.getElementById('new-bot-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
};

window.closeNewBotModal = () => {
    const modal = document.getElementById('new-bot-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

window.createNewBot = () => {
    botManager.createNewBot();
};

window.deleteBot = () => {
    botManager.deleteBot();
};

window.resetBotStats = () => {
    botManager.resetBotStats();
};
