class MonitoringDashboard {
    constructor() {
        this.charts = {};
        this.updateInterval = 5000; // 5 seconds
        this.timeRange = '1h';
        this.filters = {
            severity: 'all',
            status: 'all'
        };

        this.initializeCharts();
        this.initializeWebSocket();
        this.initializeEventListeners();
        this.startDataUpdates();
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

        // Response Time Chart
        this.charts.responseTime = new Chart(
            document.getElementById('response-time-chart').getContext('2d'),
            {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Response Time (ms)',
                        data: [],
                        borderColor: '#4f46e5',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            }
        );

        // Trial Distribution Chart
        this.charts.trialDistribution = new Chart(
            document.getElementById('trial-distribution-chart').getContext('2d'),
            {
                type: 'doughnut',
                data: {
                    labels: ['Success', 'Failed', 'Pending'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#22c55e', '#ef4444', '#f59e0b']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            }
        );

        // Error Analysis Chart
        this.charts.errorAnalysis = new Chart(
            document.getElementById('error-analysis-chart').getContext('2d'),
            {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Error Count',
                        data: [],
                        backgroundColor: '#ef4444'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            }
        );
    }

    // Initialize WebSocket connection
    initializeWebSocket() {
        this.ws = window.wsHandler;
        
        // Subscribe to monitoring events
        this.ws.addHandler('monitoring', (data) => this.handleMonitoringUpdate(data));
        this.ws.addHandler('alert', (data) => this.handleAlert(data));
    }

    // Initialize Event Listeners
    initializeEventListeners() {
        // Time range selector
        document.getElementById('time-range')?.addEventListener('change', (e) => {
            this.timeRange = e.target.value;
            this.fetchData();
        });

        // Export button
        document.getElementById('export-data')?.addEventListener('click', () => {
            this.exportData();
        });

        // Issue filters
        document.getElementById('severity-filter')?.addEventListener('change', (e) => {
            this.filters.severity = e.target.value;
            this.filterIssues();
        });

        document.getElementById('status-filter')?.addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.filterIssues();
        });
    }

    // Start periodic data updates
    startDataUpdates() {
        this.fetchData(); // Initial fetch
        setInterval(() => this.fetchData(), this.updateInterval);
    }

    // Fetch monitoring data
    async fetchData() {
        try {
            const response = await fetch(`/api/monitoring/data?timeRange=${this.timeRange}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.updateDashboard(data);
            }
        } catch (error) {
            console.error('Failed to fetch monitoring data:', error);
        }
    }

    // Update dashboard with new data
    updateDashboard(data) {
        this.updateOverviewCards(data.overview);
        this.updateCharts(data.charts);
        this.updateBotHealth(data.botHealth);
        this.updateIssues(data.issues);
    }

    // Update overview cards
    updateOverviewCards(overview) {
        document.getElementById('active-trials-count').textContent = overview.activeTrials;
        document.getElementById('issues-count').textContent = overview.issues;
        document.getElementById('success-rate').textContent = `${overview.successRate}%`;
        document.getElementById('active-bots').textContent = overview.activeBots;
    }

    // Update charts with new data
    updateCharts(data) {
        // Success Rate Chart
        this.updateChart(this.charts.successRate, data.successRate);

        // Response Time Chart
        this.updateChart(this.charts.responseTime, data.responseTime);

        // Trial Distribution Chart
        this.charts.trialDistribution.data.datasets[0].data = [
            data.distribution.success,
            data.distribution.failed,
            data.distribution.pending
        ];
        this.charts.trialDistribution.update();

        // Error Analysis Chart
        this.updateChart(this.charts.errorAnalysis, data.errorAnalysis);
    }

    // Update individual chart
    updateChart(chart, data) {
        chart.data.labels = data.labels;
        chart.data.datasets[0].data = data.values;
        chart.update();
    }

    // Update bot health status
    updateBotHealth(botHealth) {
        const container = document.getElementById('bot-health-grid');
        if (!container) return;

        container.innerHTML = botHealth.map(bot => `
            <div class="health-card">
                <div class="health-status">
                    <span class="status-indicator ${bot.status}"></span>
                    <h3>${bot.name}</h3>
                </div>
                <div class="health-metrics">
                    <div class="metric">
                        <span class="metric-label">Success Rate</span>
                        <span class="metric-value">${bot.successRate}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Response Time</span>
                        <span class="metric-value">${bot.responseTime}ms</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Update issues table
    updateIssues(issues) {
        const container = document.getElementById('issues-table-body');
        if (!container) return;

        const filteredIssues = this.filterIssuesByCurrentFilters(issues);
        container.innerHTML = filteredIssues.map(issue => `
            <tr>
                <td>${issue.botName}</td>
                <td>${issue.description}</td>
                <td>
                    <span class="severity-badge ${issue.severity}">${issue.severity}</span>
                </td>
                <td>${issue.status}</td>
                <td>${this.formatTime(issue.timestamp)}</td>
                <td>
                    <button class="btn-secondary btn-sm" onclick="monitoringDashboard.resolveIssue('${issue.id}')">
                        Resolve
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Filter issues by current filters
    filterIssuesByCurrentFilters(issues) {
        return issues.filter(issue => {
            const matchesSeverity = this.filters.severity === 'all' || issue.severity === this.filters.severity;
            const matchesStatus = this.filters.status === 'all' || issue.status === this.filters.status;
            return matchesSeverity && matchesStatus;
        });
    }

    // Handle real-time monitoring update
    handleMonitoringUpdate(data) {
        this.updateOverviewCards(data.overview);
        this.updateCharts(data.charts);
    }

    // Handle alert
    handleAlert(alert) {
        this.showAlert(alert);
        this.updateIssues(alert.issues);
    }

    // Show alert in sidebar
    showAlert(alert) {
        const alertList = document.getElementById('alert-list');
        if (!alertList) return;

        const alertElement = document.createElement('div');
        alertElement.className = 'alert-item';
        alertElement.innerHTML = `
            <span class="alert-time">${this.formatTime(alert.timestamp)}</span>
            <p class="alert-message">${alert.message}</p>
        `;

        alertList.insertBefore(alertElement, alertList.firstChild);
    }

    // Export monitoring data
    async exportData() {
        try {
            const response = await fetch(`/api/monitoring/export?timeRange=${this.timeRange}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `monitoring-data-${new Date().toISOString()}.json`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export data:', error);
        }
    }

    // Resolve issue
    async resolveIssue(issueId) {
        try {
            const response = await fetch(`/api/monitoring/issues/${issueId}/resolve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.fetchData(); // Refresh data
            }
        } catch (error) {
            console.error('Failed to resolve issue:', error);
        }
    }

    // Format timestamp
    formatTime(timestamp) {
        return new Date(timestamp).toLocaleString();
    }

    // Clean up resources
    cleanup() {
        // Destroy charts
        Object.values(this.charts).forEach(chart => chart.destroy());
        
        // Clear update interval
        clearInterval(this.updateInterval);
    }
}

// Initialize monitoring dashboard
const monitoringDashboard = new MonitoringDashboard();

// Clean up on page unload
window.addEventListener('unload', () => {
    monitoringDashboard.cleanup();
});
