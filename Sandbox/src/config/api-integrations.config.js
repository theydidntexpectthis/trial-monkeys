/**
 * Comprehensive API Integrations Configuration
 * Includes all service endpoints, logos, and authentication details
 */

module.exports = {
    rapidApiKey: 'd42dbed423mshd69f27217e2311bp11bd5cjsnc2b55ca495da',
    logoBaseUrl: 'https://img.logo.dev/',
    logoToken: 'pk_RDgtA8q6SmeobLWwPgJEwg',

    // Service Categories
    categories: {
        streaming: {
            name: 'Streaming Services',
            icon: '🎬',
            services: [
                {
                    name: 'Netflix',
                    domain: 'netflix.com',
                    logo: '{logoBaseUrl}netflix.com?token={logoToken}',
                    endpoints: {
                        signup: '/signup/registration',
                        plans: '/signup/planform',
                        payment: '/signup/payment'
                    },
                    apiHost: 'netflix-service.p.rapidapi.com'
                },
                {
                    name: 'Disney+',
                    domain: 'disneyplus.com',
                    logo: '{logoBaseUrl}disneyplus.com?token={logoToken}',
                    endpoints: {
                        signup: '/sign-up',
                        payment: '/payment',
                        validate: '/validate'
                    },
                    apiHost: 'disney-plus.p.rapidapi.com'
                }
                // Add more streaming services...
            ]
        },
        productivity: {
            name: 'Productivity Tools',
            icon: '💼',
            services: [
                {
                    name: 'Adobe Creative Cloud',
                    domain: 'adobe.com',
                    logo: '{logoBaseUrl}adobe.com?token={logoToken}',
                    endpoints: {
                        signup: '/creativecloud/plans',
                        trial: '/trials/create',
                        validate: '/account/verify'
                    },
                    apiHost: 'adobe-services.p.rapidapi.com'
                }
                // Add more productivity services...
            ]
        }
        // Add more categories...
    },

    // Authentication Services
    auth: {
        discord: {
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            redirectUri: '/auth/discord/callback',
            scopes: ['identify', 'email', 'guilds']
        },
        phantom: {
            network: process.env.SOLANA_NETWORK || 'mainnet-beta',
            cluster: 'https://api.mainnet-beta.solana.com'
        }
    },

    // Protection Services
    protection: {
        captcha: {
            provider: '2captcha',
            apiHost: '2captcha-solver.p.rapidapi.com',
            endpoints: {
                solve: '/solve',
                balance: '/balance'
            }
        },
        proxy: {
            brightData: {
                apiHost: 'bright-data.p.rapidapi.com',
                endpoints: {
                    getProxy: '/proxy',
                    rotate: '/rotate'
                }
            },
            scrapeNinja: {
                apiHost: 'scrape-ninja.p.rapidapi.com',
                endpoints: {
                    scrape: '/scrape',
                    render: '/render'
                }
            }
        },
        email: {
            logValid: {
                apiHost: 'log-valid.p.rapidapi.com',
                endpoints: {
                    verify: '/verify',
                    check: '/check'
                }
            }
        }
    },

    // Notification Services
    notifications: {
        telegram: {
            commands: [
                { command: 'trial', description: 'Generate new trial 🎯' },
                { command: 'bundle', description: 'Get service bundle 📦' },
                { command: 'status', description: 'Check trial status 📊' },
                { command: 'extend', description: 'Extend trial duration ⏰' }
            ]
        },
        discord: {
            commands: [
                { name: 'trial', description: 'Generate new trial', options: ['service', 'duration'] },
                { name: 'bundle', description: 'Get service bundle', options: ['type', 'duration'] },
                { name: 'status', description: 'Check trial status' },
                { name: 'extend', description: 'Extend trial duration' }
            ],
            embedColors: {
                success: '#7aa2f7',
                error: '#f7768e',
                info: '#9ece6a'
            }
        }
    },

    // Payment Processing
    payments: {
        solana: {
            tokenAddress: process.env.MONK_TOKEN_ADDRESS,
            endpoints: {
                transfer: '/transfer',
                balance: '/balance',
                history: '/history'
            }
        },
        stripe: {
            publicKey: process.env.STRIPE_PUBLIC_KEY,
            endpoints: {
                createPayment: '/create-payment-intent',
                confirm: '/confirm-payment'
            }
        }
    },

    // Service Integration APIs
    serviceApis: {
        browserAutomation: {
            playwright: {
                endpoints: {
                    launch: '/browser/launch',
                    navigate: '/page/navigate',
                    interact: '/page/interact'
                }
            }
        },
        cardGeneration: {
            privacy: {
                apiHost: 'privacy-card.p.rapidapi.com',
                endpoints: {
                    create: '/card/create',
                    update: '/card/update',
                    delete: '/card/delete'
                }
            }
        }
    },

    // Global Settings
    settings: {
        retryAttempts: 3,
        timeout: 30000,
        rateLimit: {
            requests: 100,
            period: 60 // seconds
        },
        caching: {
            enabled: true,
            duration: 3600 // seconds
        }
    },

    // Error Messages
    errors: {
        auth: {
            invalidToken: 'Invalid or expired token',
            missingPermissions: 'Missing required permissions'
        },
        trial: {
            generationFailed: 'Failed to generate trial',
            limitReached: 'Trial limit reached'
        },
        payment: {
            insufficient: 'Insufficient balance',
            failed: 'Payment processing failed'
        }
    }
};
