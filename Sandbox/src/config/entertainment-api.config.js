/**
 * Entertainment Services API Configuration
 * Endpoints and integration details for entertainment services
 */

module.exports = {
    // RapidAPI Endpoints
    rapidApi: {
        key: 'd42dbed423mshd69f27217e2311bp11bd5cjsnc2b55ca495da',
        endpoints: {
            streaming: {
                netflix: {
                    host: 'netflix-data.p.rapidapi.com',
                    methods: {
                        checkAvailability: '/check',
                        getPlans: '/plans',
                        validateCard: '/validate'
                    }
                },
                disney: {
                    host: 'disney-plus.p.rapidapi.com',
                    methods: {
                        getPlan: '/subscription',
                        validateAccess: '/validate'
                    }
                },
                spotify: {
                    host: 'spotify-api.p.rapidapi.com',
                    methods: {
                        checkTrial: '/trial/check',
                        createAccount: '/account/create'
                    }
                }
            },
            protection: {
                akamai: {
                    host: 'bypass-akamai.p.rapidapi.com',
                    methods: {
                        bypass: '/bypass',
                        getCookies: '/cookies'
                    }
                },
                captcha: {
                    host: '2captcha-solver.p.rapidapi.com',
                    methods: {
                        solve: '/solve',
                        getBalance: '/balance'
                    }
                }
            },
            verification: {
                email: {
                    host: 'log-valid.p.rapidapi.com',
                    methods: {
                        verify: '/verify',
                        disposable: '/check'
                    }
                }
            }
        }
    },

    // Service-specific API endpoints
    services: {
        netflix: {
            baseUrl: 'https://www.netflix.com',
            endpoints: {
                signup: '/signup/registration',
                planSelect: '/signup/planform',
                payment: '/signup/payment',
                activate: '/activate',
                cancel: '/cancelplan'
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        },
        spotify: {
            baseUrl: 'https://www.spotify.com',
            endpoints: {
                signup: '/signup',
                premium: '/premium',
                account: '/account',
                cancel: '/account/subscription/cancel'
            }
        },
        disneyPlus: {
            baseUrl: 'https://www.disneyplus.com',
            endpoints: {
                signup: '/sign-up',
                billing: '/billing',
                cancel: '/subscription/cancel'
            }
        }
    },

    // Authentication methods
    auth: {
        netflix: {
            tokenRequired: true,
            cookieAuth: true,
            headers: ['x-netflix-token', 'x-signup-token']
        },
        spotify: {
            tokenRequired: true,
            cookieAuth: false,
            headers: ['app-platform', 'spotify-token']
        }
    },

    // API Response Patterns
    responsePatterns: {
        success: {
            netflix: /{"success":\s*true}/,
            spotify: /"status":\s*"success"/,
            disneyPlus: /{"status":\s*200}/
        },
        error: {
            captcha: /captcha|verify human|robot check/i,
            blocked: /blocked|banned|suspicious/i,
            invalid: /invalid|expired|incorrect/i
        }
    },

    // Request Retry Configuration
    retry: {
        attempts: 3,
        delay: 1000,
        multiplier: 2,
        statusCodes: [429, 503, 504]
    },

    // Response Validation
    validation: {
        success: {
            required: ['status', 'token'],
            optional: ['user', 'plan', 'expiry']
        },
        error: {
            required: ['code', 'message'],
            optional: ['details', 'retry_after']
        }
    },

    // Rate Limiting
    rateLimit: {
        netflix: {
            requests: 100,
            period: 3600 // 1 hour
        },
        spotify: {
            requests: 150,
            period: 3600
        },
        disney: {
            requests: 120,
            period: 3600
        }
    },

    // Error Messages
    errors: {
        rateLimit: 'Rate limit exceeded. Please try again later.',
        invalidToken: 'Invalid or expired token.',
        captchaRequired: 'Captcha verification required.',
        blocked: 'Access blocked. Please try again later.',
        timeout: 'Request timed out. Please try again.'
    }
};
