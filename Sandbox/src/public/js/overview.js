class OverviewDashboard {
    constructor() {
        this.charts = {};
        this.updateInterval = 30000; // 30 seconds
        this.wsHandler = window.wsHandler;
        
        this.initializeCharts();
        this.initializeWebSocket();
        this.loadDashboardData();
        this.startPeriodicUpdates();
    }

    // Initialize Charts
    initializeCharts() {
        // Success Rate Chart
        this.charts.successRate = new Chart(
            document.getElementById('success-rate-chart').getContext('2d'),
            {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Success Rate',
                        data: [],
                        borderColor: '#22c55e',
                        tension: 0.4,
                        fill: true,
                        backgroundColor: 'rgba(34, 197, 94, 0.1)'
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
            }
        );

        // Trial Distribution Chart
        this.charts.trialDistribution = new Chart(
            document.getElementById('trial-distribution-chart').getContext('2d'),
            {
                type: 'doughnut',
                data: {
                    labels: ['Active', 'Completed', 'Failed'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#22c55e', '#3b82f6', '#ef4444']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            }
        );
    }

    // Initialize WebSocket connection
    initializeWebSocket() {
        // Subscribe to real-time updates
        this.wsHandler.addHandler('dashboard_update', (data) => this.handleDashboardUpdate(data));
        this.wsHandler.addHandler('trial_update', (data) => this.handleTrialUpdate(data));
        this.wsHandler.addHandler('system_status', (data) => this.handleSystemStatus(data));
    }

    // Load initial dashboard data
    async loadDashboardData() {
        try {
            const response = await fetch('/api/dashboard/overview', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.updateDashboard(data);
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.showToast('Failed to load dashboard data', 'error');
        }
    }

    // Start periodic updates
    startPeriodicUpdates() {
        setInterval(() => this.loadDashboardData(), this.updateInterval);
    }

    // Update dashboard with new data
    updateDashboard(data) {
        this.updateStats(data.stats);
        this.updateCharts(data.charts);
        this.updateActivityList(data.activity);
        this.updateTrialsList(data.trials);
        this.updateSystemStatus(data.systemStatus);
    }

    // Update statistics
    updateStats(stats) {
        document.getElementById('active-trials').textContent = stats.activeTrials;
        document.getElementById('active-bots').textContent = stats.activeBots;
        document.getElementById('time-saved').textContent = this.formatTime(stats.timeSaved);
        document.getElementById('success-rate').textContent = `${stats.successRate}%`;

        // Update trends
        this.updateTrends(stats.trends);
    }

    // Update charts
    updateCharts(data) {
        // Update Success Rate Chart
        this.charts.successRate.data.labels = data.successRate.labels;
        this.charts.successRate.data.datasets[0].data = data.successRate.values;
        this.charts.successRate.update();

        // Update Trial Distribution Chart
        this.charts.trialDistribution.data.datasets[0].data = [
            data.distribution.active,
            data.distribution.completed,
            data.distribution.failed
        ];
        this.charts.trialDistribution.update();
    }

    // Update activity list
    updateActivityList(activities) {
        const container = document.getElementById('activity-list');
        if (!container) return;

        container.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    <i class="fas ${this.getActivityIcon(activity.type)}"></i>
                </div>
                <div class="activity-content">
                    <p class="activity-title">${activity.message}</p>
                    <span class="activity-time">${this.formatTime(activity.timestamp)}</span>
                </div>
            </div>
        `).join('');
    }

    // Update trials list
    updateTrialsList(trials) {
        const container = document.getElementById('trials-list');
        if (!container) return;

        container.innerHTML = trials.map(trial => `
            <div class="trial-item">
                <div class="trial-info">
                    <h4>${trial.name}</h4>
                    <p>Created ${this.formatTimeAgo(trial.createdAt)}</p>
                </div>
                <span class="trial-status ${trial.status}">${trial.status}</span>
            </div>
        `).join('');
    }

    // Update system status
    updateSystemStatus(status) {
        const statusItems = document.querySelectorAll('.status-value');
        statusItems.forEach(item => {
            const service = item.closest('.status-item').querySelector('.status-label').textContent.toLowerCase();
            const serviceStatus = status[service];
            item.className = `status-value ${serviceStatus.status}`;
            item.textContent = serviceStatus.message;
        });

        // Update overall status indicator
        const indicator = document.querySelector('.status-indicator');
        const allOperational = Object.values(status).every(s => s.status === 'healthy');
        indicator.className = `status-indicator ${allOperational ? 'healthy' : 'warning'}`;
        indicator.textContent = allOperational ? 'All Systems Operational' : 'Some Systems Degraded';
    }

    // Handle real-time dashboard update
    handleDashboardUpdate(data) {
        this.updateStats(data.stats);
        this.updateCharts(data.charts);
    }

    // Handle real-time trial update
    handleTrialUpdate(data) {
        this.updateTrialsList(data.trials);
        this.updateActivityList(data.activity);
    }

    // Handle system status update
    handleSystemStatus(data) {
        this.updateSystemStatus(data);
    }

    // Helper methods
    getActivityIcon(type) {
        const icons = {
            trial: 'fa-robot',
            bot: 'fa-cog',
            system: 'fa-server',
            user: 'fa-user'
        };
        return icons[type] || 'fa-info-circle';
    }

    formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        return `${hours}h`;
    }

    formatTimeAgo(timestamp) {
        const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return `${Math.floor(interval)}y ago`;
        
        interval = seconds / 2592000;
        if (interval > 1) return `${Math.floor(interval)}mo ago`;
        
        interval = seconds / 86400;
        if (interval > 1) return `${Math.floor(interval)}d ago`;
        
        interval = seconds / 3600;
        if (interval > 1) return `${Math.floor(interval)}h ago`;
        
        interval = seconds / 60;
        if (interval > 1) return `${Math.floor(interval)}m ago`;
        
        return 'just now';
    }

    updateTrends(trends) {
        Object.entries(trends).forEach(([metric, trend]) => {
            const element = document.querySelector(`#${metric} + .trend`);
            if (element) {
                element.className = `trend ${trend.direction}`;
                element.textContent = trend.value;
            }
        });
    }

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

    // Clean up resources
    cleanup() {
        // Destroy charts
        Object.values(this.charts).forEach(chart => chart.destroy());
        
        // Clear update interval
        clearInterval(this.updateInterval);
    }
}

// Initialize dashboard
const overviewDashboard = new OverviewDashboard();

// Clean up on page unload
window.addEventListener('unload', () => {
    overviewDashboard.cleanup();
});
