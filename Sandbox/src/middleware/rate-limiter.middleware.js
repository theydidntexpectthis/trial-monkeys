const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const config = require('../config/config');

class RateLimiterMiddleware {
    constructor() {
        this.redis = new Redis(config.redis.url);
        this.defaultLimits = {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        };

        this.limiters = this.initializeLimiters();
    }

    // Initialize different rate limiters
    initializeLimiters() {
        return {
            // Global API limiter
            global: rateLimit({
                store: new RedisStore({
                    client: this.redis,
                    prefix: 'rl:global:'
                }),
                windowMs: this.defaultLimits.windowMs,
                max: this.defaultLimits.max,
                message: {
                    success: false,
                    message: 'Too many requests, please try again later.'
                }
            }),

            // Authentication endpoints limiter
            auth: rateLimit({
                store: new RedisStore({
                    client: this.redis,
                    prefix: 'rl:auth:'
                }),
                windowMs: 60 * 60 * 1000, // 1 hour
                max: 5, // limit each IP to 5 login attempts per hour
                message: {
                    success: false,
                    message: 'Too many login attempts, please try again later.'
                }
            }),

            // Trial creation limiter
            trial: rateLimit({
                store: new RedisStore({
                    client: this.redis,
                    prefix: 'rl:trial:'
                }),
                windowMs: 60 * 60 * 1000, // 1 hour
                max: (req) => {
                    // Limit based on subscription level
                    const subscriptionLevel = req.user?.subscription?.plan || 'free';
                    return config.subscriptions[subscriptionLevel].maxTrials || 1;
                },
                message: {
                    success: false,
                    message: 'Trial creation limit reached for your subscription level.'
                }
            }),

            // Bot creation limiter
            bot: rateLimit({
                store: new RedisStore({
                    client: this.redis,
                    prefix: 'rl:bot:'
                }),
                windowMs: 24 * 60 * 60 * 1000, // 24 hours
                max: (req) => {
                    // Limit based on subscription level
                    const subscriptionLevel = req.user?.subscription?.plan || 'free';
                    return config.subscriptions[subscriptionLevel].maxConcurrent * 2;
                },
                message: {
                    success: false,
                    message: 'Bot creation limit reached for your subscription level.'
                }
            }),

            // API key usage limiter
            apiKey: rateLimit({
                store: new RedisStore({
                    client: this.redis,
                    prefix: 'rl:api:'
                }),
                windowMs: 60 * 60 * 1000, // 1 hour
                max: (req) => {
                    // Limit based on API key tier
                    const apiKeyTier = req.apiKey?.tier || 'basic';
                    const limits = {
                        basic: 1000,
                        premium: 5000,
                        enterprise: 50000
                    };
                    return limits[apiKeyTier] || limits.basic;
                },
                message: {
                    success: false,
                    message: 'API rate limit exceeded.'
                }
            })
        };
    }

    // Get rate limiter by type
    getLimiter(type) {
        return this.limiters[type] || this.limiters.global;
    }

    // Custom rate limiter creator
    createLimiter(options) {
        return rateLimit({
            store: new RedisStore({
                client: this.redis,
                prefix: `rl:custom:${options.prefix || ''}`
            }),
            windowMs: options.windowMs || this.defaultLimits.windowMs,
            max: options.max || this.defaultLimits.max,
            message: options.message || {
                success: false,
                message: 'Rate limit exceeded.'
            }
        });
    }

    // Monitor rate limit hits
    async monitorRateLimits(req, res, next) {
        if (res.locals.rateLimit) {
            const rateLimitInfo = {
                ip: req.ip,
                endpoint: req.originalUrl,
                remaining: res.locals.rateLimit.remaining,
                limit: res.locals.rateLimit.limit,
                timestamp: new Date()
            };

            // Log rate limit info
            if (rateLimitInfo.remaining === 0) {
                console.warn('Rate limit exceeded:', rateLimitInfo);
                
                // Notify monitoring service
                await require('../services/monitor.service').logRateLimitExceeded(rateLimitInfo);
            }
        }
        next();
    }

    // Check subscription limits
    async checkSubscriptionLimits(req, res, next) {
        try {
            const subscriptionLevel = req.user?.subscription?.plan || 'free';
            const limits = config.subscriptions[subscriptionLevel];

            // Check if user has reached their limits
            const currentUsage = await this.getCurrentUsage(req.user.userId);

            if (currentUsage.trials >= limits.maxTrials) {
                return res.status(429).json({
                    success: false,
                    message: 'Trial limit reached for your subscription level.'
                });
            }

            if (currentUsage.concurrent >= limits.maxConcurrent) {
                return res.status(429).json({
                    success: false,
                    message: 'Concurrent trial limit reached for your subscription level.'
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    }

    // Get current usage for user
    async getCurrentUsage(userId) {
        try {
            const usage = await this.redis.hgetall(`usage:${userId}`);
            return {
                trials: parseInt(usage.trials || '0'),
                concurrent: parseInt(usage.concurrent || '0')
            };
        } catch (error) {
            console.error('Failed to get current usage:', error);
            return { trials: 0, concurrent: 0 };
        }
    }

    // Update usage counters
    async updateUsage(userId, type, increment = true) {
        try {
            const key = `usage:${userId}`;
            if (increment) {
                await this.redis.hincrby(key, type, 1);
            } else {
                await this.redis.hincrby(key, type, -1);
            }
        } catch (error) {
            console.error('Failed to update usage:', error);
        }
    }

    // Reset usage counters
    async resetUsage(userId) {
        try {
            await this.redis.del(`usage:${userId}`);
        } catch (error) {
            console.error('Failed to reset usage:', error);
        }
    }

    // Cleanup resources
    async cleanup() {
        try {
            await this.redis.quit();
        } catch (error) {
            console.error('Failed to cleanup rate limiter:', error);
        }
    }
}

module.exports = new RateLimiterMiddleware();
