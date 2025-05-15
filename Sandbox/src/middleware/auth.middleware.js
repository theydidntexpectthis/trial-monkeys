const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/user.model');

class AuthMiddleware {
    // Verify JWT token
    async verifyToken(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({
                    success: false,
                    message: config.errors.auth.noToken
                });
            }

            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, config.server.jwtSecret);

            // Check if user still exists and is active
            const user = await User.findById(decoded.userId);
            if (!user || !user.isActive) {
                return res.status(401).json({
                    success: false,
                    message: config.errors.auth.unauthorized
                });
            }

            req.user = decoded;
            next();
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: config.errors.auth.invalidToken,
                error: error.message
            });
        }
    }

    // Check subscription level
    checkSubscription(requiredLevel) {
        return async (req, res, next) => {
            try {
                const user = await User.findById(req.user.userId);
                const subscriptionLevels = config.service.subscriptionLevels;
                const userLevel = subscriptionLevels.indexOf(user.subscription.plan);
                const requiredLevelIndex = subscriptionLevels.indexOf(requiredLevel);

                if (userLevel < requiredLevelIndex) {
                    return res.status(403).json({
                        success: false,
                        message: 'Subscription level not sufficient',
                        required: requiredLevel,
                        current: user.subscription.plan
                    });
                }

                next();
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to verify subscription level',
                    error: error.message
                });
            }
        };
    }

    // Rate limiting middleware
    rateLimiter(options = {}) {
        const defaultOptions = config.rateLimit;
        const limits = { ...defaultOptions, ...options };
        const requests = new Map();

        return (req, res, next) => {
            const ip = req.ip;
            const now = Date.now();
            
            if (requests.has(ip)) {
                const requestData = requests.get(ip);
                
                // Clear old requests
                if (now - requestData.windowStart > limits.windowMs) {
                    requestData.count = 0;
                    requestData.windowStart = now;
                }

                // Check limit
                if (requestData.count >= limits.max) {
                    return res.status(429).json({
                        success: false,
                        message: 'Too many requests, please try again later'
                    });
                }

                // Increment request count
                requestData.count++;
            } else {
                // First request from this IP
                requests.set(ip, {
                    count: 1,
                    windowStart: now
                });
            }

            next();
        };
    }

    // Wallet verification middleware
    async verifyWalletOwnership(req, res, next) {
        try {
            const user = await User.findById(req.user.userId);
            const requestedWallet = req.params.walletAddress || req.body.walletAddress;

            if (requestedWallet && user.phantomWalletAddress !== requestedWallet) {
                return res.status(403).json({
                    success: false,
                    message: 'Wallet address does not match authenticated user'
                });
            }

            next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to verify wallet ownership',
                error: error.message
            });
        }
    }

    // Permission verification middleware
    checkPermission(requiredPermission) {
        return async (req, res, next) => {
            try {
                const user = await User.findById(req.user.userId);
                
                // Check if user has required permission based on subscription
                const hasPermission = this.validatePermission(user.subscription.plan, requiredPermission);
                
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: 'Insufficient permissions',
                        required: requiredPermission
                    });
                }

                next();
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to verify permissions',
                    error: error.message
                });
            }
        };
    }

    // Helper method to validate permissions
    validatePermission(subscriptionPlan, requiredPermission) {
        const permissionMap = {
            free: ['basic_trials'],
            basic: ['basic_trials', 'advanced_trials'],
            premium: ['basic_trials', 'advanced_trials', 'premium_trials']
        };

        return permissionMap[subscriptionPlan]?.includes(requiredPermission) || false;
    }
}

module.exports = new AuthMiddleware();
