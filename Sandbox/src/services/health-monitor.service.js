const Redis = require('ioredis');
const config = require('../config/services.config');
const bundles = require('../config/bundles.config');

class HealthMonitorService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.metrics = {
            trials: 'health:trials',
            services: 'health:services',
            agents: 'health:agents',
            proxies: 'health:proxies'
        };
        this.checkInterval = 5 * 60 * 1000; // 5 minutes
        this.initializeMonitoring();
    }

    async initializeMonitoring() {
        // Start monitoring loops
        this.startServiceHealthChecks();
        this.startProxyRotationMonitoring();
        this.startAgentPerformanceMonitoring();
        this.startSuccessRateMonitoring();
    }

    async checkServiceHealth(serviceName) {
        const metrics = {
            timestamp: Date.now(),
            status: 'operational',
            successRate: await this.calculateSuccessRate(serviceName),
            responseTime: await this.measureResponseTime(serviceName),
            errorRate: await this.calculateErrorRate(serviceName),
            activeTrials: await this.countActiveTrials(serviceName)
        };

        // Update health status
        await this.updateServiceHealth(serviceName, metrics);

        // Check against thresholds
        await this.checkThresholds(serviceName, metrics);

        return metrics;
    }

    async updateServiceHealth(serviceName, metrics) {
        const key = `${this.metrics.services}:${serviceName}`;
        await this.redis.hset(key, {
            status: metrics.status,
            successRate: metrics.successRate,
            responseTime: metrics.responseTime,
            errorRate: metrics.errorRate,
            activeTrials: metrics.activeTrials,
            lastCheck: metrics.timestamp
        });
    }

    async checkThresholds(serviceName, metrics) {
        const alerts = [];

        // Check success rate
        if (metrics.successRate < bundles.metrics.alertThresholds.successRate) {
            alerts.push({
                type: 'success_rate',
                message: `Success rate below threshold: ${metrics.successRate}%`,
                severity: 'high'
            });
        }

        // Check error rate
        if (metrics.errorRate > bundles.metrics.alertThresholds.errorRate) {
            alerts.push({
                type: 'error_rate',
                message: `Error rate above threshold: ${metrics.errorRate}%`,
                severity: 'high'
            });
        }

        // Check response time
        if (metrics.responseTime > bundles.metrics.alertThresholds.responseTime) {
            alerts.push({
                type: 'response_time',
                message: `High response time: ${metrics.responseTime}ms`,
                severity: 'medium'
            });
        }

        if (alerts.length > 0) {
            await this.triggerAlerts(serviceName, alerts);
        }
    }

    async monitorProxyHealth() {
        const proxies = await this.getActiveProxies();
        const results = await Promise.all(
            proxies.map(async proxy => ({
                proxy: proxy.id,
                metrics: await this.checkProxyHealth(proxy)
            }))
        );

        await this.updateProxyMetrics(results);
    }

    async checkProxyHealth(proxy) {
        return {
            speed: await this.measureProxySpeed(proxy),
            reliability: await this.calculateProxyReliability(proxy),
            successRate: await this.getProxySuccessRate(proxy),
            lastUsed: await this.getProxyLastUsed(proxy)
        };
    }

    async monitorAgentPerformance() {
        const agents = await this.getActiveAgents();
        const performance = await Promise.all(
            agents.map(async agent => ({
                agent: agent.id,
                metrics: await this.checkAgentPerformance(agent)
            }))
        );

        await this.updateAgentMetrics(performance);
    }

    async checkAgentPerformance(agent) {
        return {
            successRate: await this.calculateAgentSuccessRate(agent),
            memoryUsage: await this.getAgentMemoryUsage(agent),
            patternAccuracy: await this.calculatePatternAccuracy(agent),
            learningRate: await this.calculateLearningRate(agent)
        };
    }

    async calculateSuccessRate(serviceName, period = '24h') {
        const trials = await this.getTrialsInPeriod(serviceName, period);
        if (!trials.length) return 100;

        const successful = trials.filter(t => t.status === 'active').length;
        return (successful / trials.length) * 100;
    }

    async measureResponseTime(serviceName) {
        const start = Date.now();
        try {
            await this.performHealthCheck(serviceName);
            return Date.now() - start;
        } catch (error) {
            return -1;
        }
    }

    async calculateErrorRate(serviceName, period = '24h') {
        const errors = await this.getErrorsInPeriod(serviceName, period);
        const trials = await this.getTrialsInPeriod(serviceName, period);
        
        if (!trials.length) return 0;
        return (errors.length / trials.length) * 100;
    }

    async getSystemStatus() {
        const services = await this.getAllServicesHealth();
        const agents = await this.getAllAgentsHealth();
        const proxies = await this.getAllProxiesHealth();

        return {
            overall: this.calculateOverallHealth(services, agents, proxies),
            services,
            agents,
            proxies,
            timestamp: Date.now()
        };
    }

    calculateOverallHealth(services, agents, proxies) {
        const metrics = [...services, ...agents, ...proxies];
        const operational = metrics.filter(m => m.status === 'operational').length;
        
        return {
            status: operational / metrics.length > 0.8 ? 'healthy' : 'degraded',
            operationalPercentage: (operational / metrics.length) * 100
        };
    }

    async triggerAlerts(serviceName, alerts) {
        for (const alert of alerts) {
            await this.redis.lpush('alerts', JSON.stringify({
                service: serviceName,
                ...alert,
                timestamp: Date.now()
            }));
        }

        // Implement alert notifications here
        console.error(`Service alerts for ${serviceName}:`, alerts);
    }

    // Monitoring loop starters
    startServiceHealthChecks() {
        setInterval(async () => {
            const services = Object.keys(bundles.entertainmentBundle.services);
            for (const service of services) {
                await this.checkServiceHealth(service).catch(console.error);
            }
        }, this.checkInterval);
    }

    startProxyRotationMonitoring() {
        setInterval(async () => {
            await this.monitorProxyHealth().catch(console.error);
        }, this.checkInterval);
    }

    startAgentPerformanceMonitoring() {
        setInterval(async () => {
            await this.monitorAgentPerformance().catch(console.error);
        }, this.checkInterval);
    }

    startSuccessRateMonitoring() {
        setInterval(async () => {
            await this.updateGlobalSuccessRates().catch(console.error);
        }, this.checkInterval);
    }
}

module.exports = new HealthMonitorService();
