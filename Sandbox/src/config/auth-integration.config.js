/**
 * Authentication and API Integration Configuration
 * Manages authentication flows, API keys, and service integrations
 */

module.exports = {
    // Authentication Configuration
    auth: {
        jwt: {
            secret: process.env.JWT_SECRET,
            expiresIn: '24h',
            refreshToken: {
                expiresIn: '7d',
                secret: process.env.REFRESH_TOKEN_SECRET
            }
        },
        oauth: {
            discord: {
                clientId: process.env.DISCORD_CLIENT_ID,
                clientSecret: process.env.DISCORD_CLIENT_SECRET,
                redirectUri: '/auth/discord/callback',
                scopes: ['identify', 'email', 'guilds']
            },
            google: {
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                redirectUri: '/auth/google/callback',
                scopes: ['profile', 'email']
            }
        },
        sessions: {
            secret: process.env.SESSION_SECRET,
            duration: 24 * 60 * 60 * 1000, // 24 hours
            secure: process.env.NODE_ENV === 'production'
        }
    },

    // Payment Gateway Configuration
    payments: {
        stripe: {
            publicKey: process.env.STRIPE_PUBLIC_KEY,
            secretKey: process.env.STRIPE_SECRET_KEY,
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            endpoints: {
                verify: '/api/payments/verify',
                webhook: '/api/payments/webhook',
                refund: '/api/payments/refund'
            }
        },
        paypal: {
            clientId: process.env.PAYPAL_CLIENT_ID,
            clientSecret: process.env.PAYPAL_CLIENT_SECRET,
            sandbox: process.env.NODE_ENV !== 'production',
            webhookId: process.env.PAYPAL_WEBHOOK_ID
        }
    },

    // RapidAPI Configuration
    rapidApi: {
        key: 'd42dbed423mshd69f27217e2311bp11bd5cjsnc2b55ca495da',
        endpoints: {
            paymentVerification: {
                url: 'https://payment-verification.p.rapidapi.com/verify',
                headers: {
                    'X-RapidAPI-Key': 'd42dbed423mshd69f27217e2311bp11bd5cjsnc2b55ca495da',
                    'X-RapidAPI-Host': 'payment-verification.p.rapidapi.com'
                }
            },
            subscriptionVerification: {
                url: 'https://subscription-verification.p.rapidapi.com/verify',
                headers: {
                    'X-RapidAPI-Key': 'd42dbed423mshd69f27217e2311bp11bd5cjsnc2b55ca495da',
                    'X-RapidAPI-Host': 'subscription-verification.p.rapidapi.com'
                }
            }
        }
    },

    // Referral Program Configuration
    referral: {
        rewards: {
            signupBonus: 5, // $5 for new referral
            referrerBonus: 10, // $10 for referrer
            minimumWithdrawal: 25 // Minimum $25 to withdraw
        },
        validation: {
            requiresVerification: true,
            minimumPurchaseAmount: 10,
            cooldownPeriod: 7 * 24 * 60 * 60 * 1000 // 7 days
        },
        tracking: {
            cookieDuration: 30, // days
            attributionWindow: 7 // days
        }
    },

    // User Registration Requirements
    registration: {
        email: {
            required: true,
            verification: true,
            allowedDomains: ['gmail.com', 'outlook.com', 'yahoo.com']
        },
        password: {
            minLength: 8,
            requireUppercase: true,
            requireNumbers: true,
            requireSymbols: true
        },
        profile: {
            requiredFields: ['username', 'email'],
            optionalFields: ['avatar', 'bio', 'location']
        }
    },

    // Admin Dashboard Configuration
    admin: {
        roles: {
            superAdmin: ['all'],
            admin: ['users.read', 'users.write', 'payments.read'],
            moderator: ['users.read', 'referrals.read']
        },
        features: {
            userManagement: true,
            paymentTracking: true,
            referralManagement: true,
            analytics: true
        },
        notifications: {
            email: true,
            discord: true,
            dashboard: true
        }
    },

    // Security Configuration
    security: {
        rateLimit: {
            window: 15 * 60 * 1000, // 15 minutes
            max: 100 // requests
        },
        cors: {
            origins: ['http://localhost:3000', process.env.FRONTEND_URL],
            credentials: true
        },
        csrf: {
            enabled: true,
            cookieName: 'XSRF-TOKEN'
        }
    },

    // Validation Patterns
    validation: {
        email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        username: /^[a-zA-Z0-9_]{3,20}$/,
        password: /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})/
    },

    // Error Messages
    errors: {
        auth: {
            invalidCredentials: 'Invalid email or password',
            emailNotVerified: 'Please verify your email address',
            accountLocked: 'Account has been locked due to suspicious activity'
        },
        payment: {
            verificationFailed: 'Payment verification failed',
            insufficientFunds: 'Insufficient funds',
            invalidCard: 'Invalid card details'
        },
        referral: {
            invalidCode: 'Invalid referral code',
            alreadyUsed: 'Referral code already used',
            minimumNotMet: 'Minimum withdrawal amount not met'
        }
    }
};
