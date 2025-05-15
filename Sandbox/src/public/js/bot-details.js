class BotDetailsManager {
    constructor() {
        this.botId = new URLSearchParams(window.location.search).get('id');
        this.charts = {};
        this.updateInterval = 5000; // 5 seconds
        this.logUpdateInterval = 10000; // 10 seconds
        
        this.initializeCharts();
        this.initializeEventListeners();
        this.loadBotDetails();
        this.startMonitoring();
    }

    // Initialize Charts
    initializeCharts() {
        // Success Rate Chart
        const successCtx = document.getElementById('success-rate-chart').getContext('2d');
        this.charts.successRate = new Chart(successCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Success Rate',
                    data: [],
                    borderColor: '#4f46e5',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(79, 70, 229, 0.1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });

        // Response Time Chart
        const responseCtx = document.getElementById('response-time-chart').getContext('2d');
        this.charts.responseTime = new Chart(responseCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Response Time (ms)',
                    data: [],
                    borderColor: '#22c55e',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    // Initialize Event Listeners
    initializeEventListeners() {
        // Bot Actions
        document.getElementById('launch-bot')?.addEventListener('click', () => this.launchBot());
        document.getElementById('edit-bot')?.addEventListener('click', () => this.showEditModal());
        document.getElementById('delete-bot')?.addEventListener('click', () => this.deleteBot());

        // Configuration Changes
        document.getElementById('auto-retry')?.addEventListener('change', (e) => this.updateConfig('autoRetry', e.target.checked));
        document.getElementById('retry-attempts')?.addEventListener('change', (e) => this.updateConfig('retryAttempts', e.target.value));
        document.getElementById('use-proxy')?.addEventListener('change', (e) => this.updateConfig('useProxy', e.target.checked));
        document.getElementById('proxy-type')?.addEventListener('change', (e) => this.updateConfig('proxyType', e.target.value));

        // Log Filtering
        document.getElementById('log-level')?.addEventListener('change', (e) => this.filterLogs(e.target.value));
        document.getElementById('export-logs')?.addEventListener('click', () => this.exportLogs());
    }

    // Load Bot Details
    async loadBotDetails() {
        try {
            const response = await fetch(`/api/bots/${this.botId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.updateBotDetails(data.bot);
            }
        } catch (error) {
            console.error('Failed to load bot details:', error);
            this.showToast('Failed to load bot details', 'error');
        }
    }

    // Update Bot Details in UI
    updateBotDetails(bot) {
        // Update basic info
        document.getElementById('bot-icon').src = bot.icon;
        document.getElementById('bot-name').textContent = bot.name;
        document.getElementById('bot-status').textContent = bot.status;
        document.getElementById('bot-status').className = `bot-status ${bot.status}`;

        // Update statistics
        document.getElementById('success-rate').textContent = `${bot.statistics.averageSuccessRate.toFixed(1)}%`;
        document.getElementById('avg-runtime').textContent = `${(bot.statistics.averageRunTime / 1000).toFixed(1)}s`;
        document.getElementById('total-runs').textContent = bot.statistics.totalRuns;
        document.getElementById('health-status').textContent = bot.monitoring.health.status;

        // Update configuration
        document.getElementById('auto-retry').checked = bot.config.autoRetry;
        document.getElementById('retry-attempts').value = bot.config.retryAttempts;
        document.getElementById('use-proxy').checked = bot.config.useProxy;
        document.getElementById('proxy-type').value = bot.config.proxyConfig?.type || 'browser';
    }

    // Start Real-time Monitoring
    startMonitoring() {
        this.monitoringInterval = setInterval(() => this.updateMonitoring(), this.updateInterval);
        this.logUpdateInterval = setInterval(() => this.updateLogs(), this.logUpdateInterval);
    }

    // Update Monitoring Data
    async updateMonitoring() {
        try {
            const response = await fetch(`/api/bots/${this.botId}/monitoring`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.updateCharts(data.monitoring);
                this.updateHealthStatus(data.monitoring.health);
            }
        } catch (error) {
            console.error('Failed to update monitoring:', error);
        }
    }

    // Update Charts
    updateCharts(monitoring) {
        const timestamp = new Date().toLocaleTimeString();

        // Update Success Rate Chart
        this.charts.successRate.data.labels.push(timestamp);
        this.charts.successRate.data.datasets[0].data.push(monitoring.successRate);
        if (this.charts.successRate.data.labels.length > 20) {
            this.charts.successRate.data.labels.shift();
            this.charts.successRate.data.datasets[0].data.shift();
        }
        this.charts.successRate.update();

        // Update Response Time Chart
        this.charts.responseTime.data.labels.push(timestamp);
        this.charts.responseTime.data.datasets[0].data.push(monitoring.responseTime);
        if (this.charts.responseTime.data.labels.length > 20) {
            this.charts.responseTime.data.labels.shift();
            this.charts.responseTime.data.datasets[0].data.shift();
        }
        this.charts.responseTime.update();
    }

    // Update Health Status
    updateHealthStatus(health) {
        const statusElement = document.getElementById('health-status');
        statusElement.textContent = health.status;
        statusElement.className = `health-status ${health.status.toLowerCase()}`;
    }

    // Update Logs
    async updateLogs(filter = 'all') {
        try {
            const response = await fetch(`/api/bots/${this.botId}/logs?level=${filter}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.renderLogs(data.logs);
            }
        } catch (error) {
            console.error('Failed to update logs:', error);
        }
    }

    // Render Logs
    renderLogs(logs) {
        const container = document.getElementById('log-container');
        container.innerHTML = logs.map(log => `
            <div class="log-entry">
                <span class="log-time">${new Date(log.timestamp).toLocaleString()}</span>
                <span class="log-level ${log.level}">${log.level}</span>
                <span class="log-message">${log.message}</span>
            </div>
        `).join('');
    }

    // Bot Actions
    async launchBot() {
        try {
            const response = await fetch(`/api/bots/${this.botId}/launch`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.showToast('Bot launched successfully', 'success');
                await this.loadBotDetails();
            }
        } catch (error) {
            console.error('Failed to launch bot:', error);
            this.showToast('Failed to launch bot', 'error');
        }
    }

    // Show Edit Modal
    showEditModal() {
        const modal = document.getElementById('edit-modal');
        modal.classList.add('show');
    }

    // Delete Bot
    async deleteBot() {
        if (!confirm('Are you sure you want to delete this bot?')) return;

        try {
            const response = await fetch(`/api/bots/${this.botId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                window.location.href = '/bots.html';
            }
        } catch (error) {
            console.error('Failed to delete bot:', error);
            this.showToast('Failed to delete bot', 'error');
        }
    }

    // Update Configuration
    async updateConfig(key, value) {
        try {
            const response = await fetch(`/api/bots/${this.botId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    config: {
                        [key]: value
                    }
                })
            });

            const data = await response.json();
            if (data.success) {
                this.showToast('Configuration updated', 'success');
            }
        } catch (error) {
            console.error('Failed to update configuration:', error);
            this.showToast('Failed to update configuration', 'error');
        }
    }

    // Filter Logs
    filterLogs(level) {
        this.updateLogs(level);
    }

    // Export Logs
    async exportLogs() {
        try {
            const response = await fetch(`/api/bots/${this.botId}/logs/export`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bot-${this.botId}-logs.json`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export logs:', error);
            this.showToast('Failed to export logs', 'error');
        }
    }

    // Show Toast Notification
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

    // Cleanup
    cleanup() {
        clearInterval(this.monitoringInterval);
        clearInterval(this.logUpdateInterval);
    }
}

// Initialize Bot Details Manager
const botDetails = new BotDetailsManager();

// Cleanup on page unload
window.addEventListener('unload', () => {
    botDetails.cleanup();
});
