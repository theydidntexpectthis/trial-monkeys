/**
 * API Routes Configuration
 * Defines all routes and their middleware requirements
 */

const authMiddleware = require('../middleware/auth.middleware');

module.exports = {
    // Authentication Routes
    auth: {
        prefix: '/auth',
        routes: {
            register: {
                path: '/register',
                method: 'POST',
                middleware: []
            },
            login: {
                path: '/login',
                method: 'POST',
                middleware: []
            },
            verifyEmail: {
                path: '/verify-email',
                method: 'POST',
                middleware: []
            },
            refreshToken: {
                path: '/refresh-token',
                method: 'POST',
                middleware: []
            },
            logout: {
                path: '/logout',
                method: 'POST',
                middleware: [authMiddleware.authenticate()]
            }
        }
    },

    // User Routes
    user: {
        prefix: '/user',
        middleware: [authMiddleware.authenticate()],
        routes: {
            profile: {
                path: '/profile',
                method: 'GET'
            },
            updateProfile: {
                path: '/profile',
                method: 'PUT'
            },
            preferences: {
                path: '/preferences',
                method: 'PUT'
            }
        }
    },

    // Trial Routes
    trials: {
        prefix: '/trials',
        middleware: [
            authMiddleware.authenticate(),
            authMiddleware.requireSubscription()
        ],
        routes: {
            generate: {
                path: '/generate',
                method: 'POST'
            },
            list: {
                path: '/',
                method: 'GET'
            },
            detail: {
                path: '/:trialId',
                method: 'GET'
            },
            cancel: {
                path: '/:trialId',
                method: 'DELETE'
            }
        }
    },

    // Subscription Routes
    subscription: {
        prefix: '/subscription',
        middleware: [authMiddleware.authenticate()],
        routes: {
            plans: {
                path: '/plans',
                method: 'GET'
            },
            subscribe: {
                path: '/subscribe',
                method: 'POST'
            },
            update: {
                path: '/update',
                method: 'PUT'
            },
            cancel: {
                path: '/cancel',
                method: 'POST'
            },
            details: {
                path: '/details',
                method: 'GET'
            }
        }
    },

    // Payment Routes
    payment: {
        prefix: '/payment',
        middleware: [authMiddleware.authenticate()],
        routes: {
            verify: {
                path: '/verify',
                method: 'POST'
            },
            history: {
                path: '/history',
                method: 'GET'
            },
            setupVirtual: {
                path: '/virtual-card',
                method: 'POST'
            }
        }
    },

    // Referral Routes
    referral: {
        prefix: '/referral',
        middleware: [authMiddleware.authenticate()],
        routes: {
            generate: {
                path: '/generate',
                method: 'POST'
            },
            process: {
                path: '/process',
                method: 'POST'
            },
            stats: {
                path: '/stats',
                method: 'GET'
            },
            withdraw: {
                path: '/withdraw',
                method: 'POST'
            },
            history: {
                path: '/history',
                method: 'GET'
            },
            leaderboard: {
                path: '/leaderboard',
                method: 'GET'
            }
        }
    },

    // Admin Routes
    admin: {
        prefix: '/admin',
        middleware: [
            authMiddleware.authenticate(),
            authMiddleware.requireRole('admin')
        ],
        routes: {
            dashboard: {
                path: '/dashboard',
                method: 'GET'
            },
            users: {
                path: '/users',
                method: 'GET'
            },
            payments: {
                path: '/payments',
                method: 'GET'
            },
            trials: {
                path: '/trials',
                method: 'GET'
            },
            referrals: {
                path: '/referrals',
                method: 'GET'
            },
            logs: {
                path: '/logs',
                method: 'GET'
            },
            updateUser: {
                path: '/users/:userId',
                method: 'PUT'
            },
            verifyPayment: {
                path: '/payments/:paymentId/verify',
                method: 'POST'
            }
        }
    },

    // Discord Bot Routes
    discord: {
        prefix: '/discord',
        middleware: [authMiddleware.authenticate()],
        routes: {
            connect: {
                path: '/connect',
                method: 'POST'
            },
            disconnect: {
                path: '/disconnect',
                method: 'POST'
            },
            commands: {
                path: '/commands',
                method: 'GET'
            }
        }
    },

    // Webhook Routes
    webhooks: {
        prefix: '/webhooks',
        routes: {
            stripe: {
                path: '/stripe',
                method: 'POST',
                middleware: []
            },
            discord: {
                path: '/discord',
                method: 'POST',
                middleware: []
            }
        }
    },

    // API Documentation Routes
    docs: {
        prefix: '/docs',
        routes: {
            swagger: {
                path: '/swagger',
                method: 'GET',
                middleware: []
            },
            redoc: {
                path: '/redoc',
                method: 'GET',
                middleware: []
            }
        }
    },

    // Rate Limiting Configuration
    rateLimits: {
        default: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        },
        auth: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 5 // limit attempts
        },
        trials: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 10 // limit trial generations
        }
    },

    // Error Handling Configuration
    errorHandling: {
        logging: true,
        stackTrace: process.env.NODE_ENV !== 'production',
        errorCodes: {
            VALIDATION_ERROR: 400,
            AUTH_ERROR: 401,
            FORBIDDEN: 403,
            NOT_FOUND: 404,
            SERVER_ERROR: 500
        }
    }
};
