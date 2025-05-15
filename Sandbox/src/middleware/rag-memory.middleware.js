const Redis = require('ioredis');
const config = require('../config/services.config');

class RAGMemoryMiddleware {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.namespace = 'rag:memory:';
        this.ttl = 30 * 24 * 60 * 60; // 30 days
    }

    async middleware(req, res, next) {
        req.ragMemory = {
            learn: async (context, outcome) => await this.learnPattern(context, outcome),
            recall: async (context) => await this.recallPatterns(context),
            suggest: async (context) => await this.suggestStrategy(context),
            validate: async (strategy) => await this.validateStrategy(strategy)
        };
        next();
    }

    async learnPattern(context, outcome) {
        const pattern = {
            context: this.normalizeContext(context),
            outcome: this.normalizeOutcome(outcome),
            timestamp: Date.now()
        };

        const key = this.getMemoryKey(context.serviceType);
        
        await this.redis.multi()
            .lpush(`${key}:patterns`, JSON.stringify(pattern))
            .ltrim(`${key}:patterns`, 0, 999) // Keep last 1000 patterns
            .hincrby(`${key}:stats`, outcome.success ? 'successes' : 'failures', 1)
            .expire(`${key}:patterns`, this.ttl)
            .expire(`${key}:stats`, this.ttl)
            .exec();

        await this.updateServiceProfile(context.serviceType, pattern);
    }

    async recallPatterns(context) {
        const key = this.getMemoryKey(context.serviceType);
        const patterns = await this.redis.lrange(`${key}:patterns`, 0, -1);

        return patterns
            .map(p => JSON.parse(p))
            .filter(p => this.matchContext(p.context, context))
            .sort((a, b) => b.outcome.confidence - a.outcome.confidence);
    }

    async suggestStrategy(context) {
        const patterns = await this.recallPatterns(context);
        const serviceProfile = await this.getServiceProfile(context.serviceType);

        // Weight factors for strategy selection
        const weights = {
            successRate: 0.4,
            recency: 0.3,
            complexity: 0.2,
            efficiency: 0.1
        };

        const strategies = patterns.map(pattern => ({
            ...pattern,
            score: this.calculateStrategyScore(pattern, serviceProfile, weights)
        }));

        // Select best strategy
        const bestStrategy = strategies.reduce((best, current) => 
            current.score > best.score ? current : best
        );

        return {
            ...bestStrategy,
            modifications: await this.suggestModifications(bestStrategy, context)
        };
    }

    async validateStrategy(strategy) {
        const validations = {
            riskLevel: this.assessRiskLevel(strategy),
            successProbability: this.calculateSuccessProbability(strategy),
            requirements: this.checkRequirements(strategy)
        };

        return {
            isValid: Object.values(validations).every(v => v.pass),
            validations,
            suggestions: await this.generateSuggestions(validations)
        };
    }

    // Helper Methods
    normalizeContext(context) {
        return {
            serviceType: context.serviceType,
            requirements: context.requirements || {},
            complexity: this.assessComplexity(context),
            timestamp: Date.now()
        };
    }

    normalizeOutcome(outcome) {
        return {
            success: Boolean(outcome.success),
            confidence: Number(outcome.confidence) || 0,
            duration: Number(outcome.duration) || 0,
            errors: Array.isArray(outcome.errors) ? outcome.errors : []
        };
    }

    getMemoryKey(serviceType) {
        return `${this.namespace}${serviceType}`;
    }

    async updateServiceProfile(serviceType, pattern) {
        const key = `${this.namespace}profile:${serviceType}`;
        const profile = await this.redis.hgetall(key) || {};

        const updates = {
            totalAttempts: (parseInt(profile.totalAttempts) || 0) + 1,
            successRate: this.calculateNewSuccessRate(
                parseInt(profile.totalAttempts) || 0,
                parseFloat(profile.successRate) || 0,
                pattern.outcome.success
            ),
            avgDuration: this.calculateNewAverage(
                parseInt(profile.totalAttempts) || 0,
                parseFloat(profile.avgDuration) || 0,
                pattern.outcome.duration
            ),
            lastUpdated: Date.now()
        };

        await this.redis.hmset(key, updates);
    }

    async getServiceProfile(serviceType) {
        const key = `${this.namespace}profile:${serviceType}`;
        return await this.redis.hgetall(key) || {};
    }

    calculateStrategyScore(pattern, profile, weights) {
        const successRateScore = pattern.outcome.success ? 1 : 0;
        const recencyScore = this.calculateRecencyScore(pattern.timestamp);
        const complexityScore = 1 - (pattern.context.complexity || 0);
        const efficiencyScore = this.calculateEfficiencyScore(pattern, profile);

        return (
            successRateScore * weights.successRate +
            recencyScore * weights.recency +
            complexityScore * weights.complexity +
            efficiencyScore * weights.efficiency
        );
    }

    calculateRecencyScore(timestamp) {
        const age = Date.now() - timestamp;
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        return Math.max(0, 1 - (age / maxAge));
    }

    calculateEfficiencyScore(pattern, profile) {
        if (!profile.avgDuration) return 1;
        return Math.min(1, profile.avgDuration / pattern.outcome.duration);
    }

    async suggestModifications(strategy, context) {
        const modifications = [];

        // Check for potential improvements
        if (strategy.outcome.duration > 10000) {
            modifications.push({
                type: 'optimization',
                suggestion: 'Reduce wait times between steps'
            });
        }

        if (strategy.outcome.errors.length > 0) {
            modifications.push({
                type: 'error_handling',
                suggestion: 'Add additional error checks'
            });
        }

        return modifications;
    }

    matchContext(storedContext, currentContext) {
        return (
            storedContext.serviceType === currentContext.serviceType &&
            this.compareRequirements(storedContext.requirements, currentContext.requirements)
        );
    }

    compareRequirements(stored, current) {
        const keys = Object.keys({ ...stored, ...current });
        return keys.every(key => stored[key] === current[key]);
    }

    calculateNewSuccessRate(totalAttempts, currentRate, success) {
        return ((totalAttempts * currentRate) + (success ? 1 : 0)) / (totalAttempts + 1);
    }

    calculateNewAverage(totalAttempts, currentAvg, newValue) {
        return ((totalAttempts * currentAvg) + newValue) / (totalAttempts + 1);
    }

    assessComplexity(context) {
        let complexity = 0;
        if (context.requirements.captcha) complexity += 0.3;
        if (context.requirements.phoneVerification) complexity += 0.2;
        if (context.requirements.emailVerification) complexity += 0.1;
        return Math.min(1, complexity);
    }
}

module.exports = new RAGMemoryMiddleware().middleware;
