const Redis = require('ioredis');
const config = require('../config/industry-services.config');
const apiConfig = require('../config/api-integrations.config');

class PerformanceMonitorService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.metrics = {
            trials: 'metrics:trials',
            agents: 'metrics:agents',
            services: 'metrics:services',
            proxies: 'metrics:proxies'
        };
        this.monitoringInterval = 5 * 60 * 1000; // 5 minutes
        this.initializeMonitoring();
    }

    async initializeMonitoring() {
        setInterval(() => this.runPerformanceChecks(), this.monitoringInterval);
    }

    async runPerformanceChecks() {
        try {
            await Promise.all([
                this.checkTrialSuccess(),
                this.checkAgentPerformance(),
                this.checkServiceHealth(),
                this.checkProxyHealth()
            ]);
        } catch (error) {
            console.error('Performance check error:', error);
        }
    }

    async trackTrialAttempt(service, result) {
        const metrics = {
            serviceId: service.name,
            timestamp: Date.now(),
            success: result.success,
            duration: result.duration,
            errors: result.errors || [],
            agentId: result.agentId,
            proxyId: result.proxyId
        };

        await Promise.all([
            this.updateServiceMetrics(service.name, result.success),
            this.updateAgentMetrics(result.agentId, result.success),
            this.updateProxyMetrics(result.proxyId, result.success),
            this.storeTrialMetrics(metrics)
        ]);
    }

    async updateServiceMetrics(serviceId, success) {
        const key = `${this.metrics.services}:${serviceId}`;
        await this.redis.multi()
            .hincrby(key, 'total', 1)
            .hincrby(key, success ? 'success' : 'failure', 1)
            .exec();
    }

    async updateAgentMetrics(agentId, success) {
        const key = `${this.metrics.agents}:${agentId}`;
        await this.redis.multi()
            .hincrby(key, 'total', 1)
            .hincrby(key, success ? 'success' : 'failure', 1)
            .exec();
    }

    async updateProxyMetrics(proxyId, success) {
        const key = `${this.metrics.proxies}:${proxyId}`;
        await this.redis.multi()
            .hincrby(key, 'total', 1)
            .hincrby(key, success ? 'success' : 'failure', 1)
            .exec();
    }

    async storeTrialMetrics(metrics) {
        await this.redis.lpush(
            `${this.metrics.trials}:history`,
            JSON.stringify(metrics)
        );
        await this.redis.ltrim(`${this.metrics.trials}:history`, 0, 999);
    }

    async checkTrialSuccess() {
        const services = Object.keys(config.requirements);
        const reports = await Promise.all(
            services.map(service => this.analyzeServicePerformance(service))
        );

        await this.handlePerformanceReports(reports);
    }

    async analyzeServicePerformance(service) {
        const metrics = await this.getServiceMetrics(service);
        const successRate = this.calculateSuccessRate(metrics);

        return {
            service,
            successRate,
            total: metrics.total,
            issues: await this.identifyIssues(service)
        };
    }

    async checkAgentPerformance() {
        const agents = await this.getActiveAgents();
        const performanceData = await Promise.all(
            agents.map(agent => this.analyzeAgentPerformance(agent))
        );

        await this.optimizeAgents(performanceData);
    }

    async checkServiceHealth() {
        const services = Object.keys(apiConfig.services);
        const healthChecks = await Promise.all(
            services.map(service => this.checkServiceHealth(service))
        );

        await this.updateServiceStatus(healthChecks);
    }

    async checkProxyHealth() {
        const proxies = await this.getActiveProxies();
        const healthData = await Promise.all(
            proxies.map(proxy => this.checkProxyHealth(proxy))
        );

        await this.optimizeProxies(healthData);
    }

    async getServiceMetrics(service) {
        const key = `${this.metrics.services}:${service}`;
        const metrics = await this.redis.hgetall(key);
        return {
            total: parseInt(metrics.total || 0),
            success: parseInt(metrics.success || 0),
            failure: parseInt(metrics.failure || 0)
        };
    }

    calculateSuccessRate(metrics) {
        if (!metrics.total) return 100;
        return (metrics.success / metrics.total) * 100;
    }

    async identifyIssues(service) {
        const history = await this.redis.lrange(
            `${this.metrics.trials}:history`,
            0,
            99
        );

        const issues = history
            .map(h => JSON.parse(h))
            .filter(h => h.serviceId === service && !h.success)
            .reduce((acc, trial) => {
                trial.errors.forEach(error => {
                    acc[error.type] = (acc[error.type] || 0) + 1;
                });
                return acc;
            }, {});

        return Object.entries(issues)
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count);
    }

    async getActiveAgents() {
        const agentKeys = await this.redis.keys(`${this.metrics.agents}:*`);
        return Promise.all(
            agentKeys.map(async key => {
                const metrics = await this.redis.hgetall(key);
                return {
                    id: key.split(':')[2],
                    metrics
                };
            })
        );
    }

    async analyzeAgentPerformance(agent) {
        const metrics = await this.getAgentMetrics(agent.id);
        return {
            agentId: agent.id,
            successRate: this.calculateSuccessRate(metrics),
            performance: await this.calculateAgentPerformance(agent.id),
            issues: await this.getAgentIssues(agent.id)
        };
    }

    async optimizeAgents(performanceData) {
        for (const data of performanceData) {
            if (data.successRate < 80) {
                await this.retrainAgent(data.agentId);
            }
        }
    }

    async getPerformanceReport() {
        const serviceMetrics = await this.getAllServiceMetrics();
        const agentMetrics = await this.getAllAgentMetrics();
        const proxyMetrics = await this.getAllProxyMetrics();

        return {
            overall: this.calculateOverallPerformance(serviceMetrics),
            services: serviceMetrics,
            agents: agentMetrics,
            proxies: proxyMetrics,
            timestamp: Date.now()
        };
    }

    async getAllServiceMetrics() {
        const services = Object.keys(config.requirements);
        const metrics = await Promise.all(
            services.map(async service => ({
                service,
                metrics: await this.getServiceMetrics(service)
            }))
        );

        return metrics.reduce((acc, { service, metrics }) => {
            acc[service] = metrics;
            return acc;
        }, {});
    }

    calculateOverallPerformance(serviceMetrics) {
        const totals = Object.values(serviceMetrics).reduce(
            (acc, metrics) => ({
                total: acc.total + metrics.total,
                success: acc.success + metrics.success
            }),
            { total: 0, success: 0 }
        );

        return {
            successRate: this.calculateSuccessRate(totals),
            total: totals.total,
            timestamp: Date.now()
        };
    }
}

module.exports = new PerformanceMonitorService();
