/**
 * Integrated Services Configuration for Trial Monkeys
 * Manages all external API integrations and automation tools
 */

module.exports = {
    // RapidAPI Configuration
    rapidApi: {
        key: 'd42dbed423mshd69f27217e2311bp11bd5cjsnc2b55ca495da',
        services: {
            scrapeNinja: {
                host: 'scrape-ninja.p.rapidapi.com',
                endpoints: {
                    scrape: '/scrape',
                    render: '/render'
                }
            },
            scrapingAnt: {
                host: 'scraping-ant.p.rapidapi.com',
                endpoints: {
                    scrape: '/scrape',
                    javascript: '/js'
                }
            },
            logValid: {
                host: 'log-valid.p.rapidapi.com',
                endpoints: {
                    verify: '/verify',
                    validate: '/validate'
                }
            },
            twoCaptcha: {
                host: '2captcha.p.rapidapi.com',
                endpoints: {
                    solve: '/solve',
                    balance: '/balance'
                }
            }
        }
    },

    // Browser Automation
    browserAutomation: {
        chrome: {
            headless: true,
            defaultViewport: { width: 1920, height: 1080 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080'
            ],
            ignoreHTTPSErrors: true,
            userDataDir: './browser-profiles'
        },
        profiles: {
            maxProfiles: 50,
            rotationInterval: 3600, // 1 hour
            storageLimit: '10GB'
        }
    },

    // Proxy Configuration
    proxies: {
        ephemeral: {
            rotationInterval: 600, // 10 minutes
            maxConcurrent: 100,
            providers: ['luminati', 'brightdata', 'oxylabs']
        },
        residential: {
            countryCode: 'US',
            sessionDuration: 300, // 5 minutes
            stickySession: true
        }
    },

    // Bot Configuration
    bots: {
        telegram: {
            token: process.env.TELEGRAM_BOT_TOKEN,
            features: {
                trialGeneration: true,
                notifications: true,
                statusChecks: true,
                groupManagement: true
            },
            commands: [
                { command: 'generate', description: 'Generate new trial' },
                { command: 'status', description: 'Check trial status' },
                { command: 'extend', description: 'Extend trial duration' },
                { command: 'list', description: 'List active trials' }
            ]
        },
        twitter: {
            apiKey: process.env.TWITTER_API_KEY,
            apiSecret: process.env.TWITTER_API_SECRET,
            features: {
                autoPost: true,
                dealAlerts: true,
                monitoring: true
            }
        }
    },

    // Virtual Cards
    virtualCards: {
        providers: ['privacy.com', 'stripe.com'],
        limits: {
            daily: 1000,
            monthly: 5000
        },
        features: {
            autoDecline: true,
            singleUse: true,
            merchantLock: true
        }
    },

    // Service Categories
    categories: {
        entertainment: {
            name: 'Entertainment',
            icon: '🎬',
            services: [
                'Netflix', 'Disney+', 'HBO Max', 'Spotify',
                'Apple Music', 'YouTube Premium', 'Hulu'
            ]
        },
        software: {
            name: 'Software',
            icon: '💻',
            services: [
                'Adobe Creative Cloud', 'Microsoft 365',
                'Autodesk', 'JetBrains', 'Notion Pro'
            ]
        },
        education: {
            name: 'Education',
            icon: '📚',
            services: [
                'Coursera', 'Udemy', 'Skillshare',
                'MasterClass', 'LinkedIn Learning'
            ]
        }
    },

    // RAG Agents Configuration
    ragAgents: {
        models: ['gpt-4', 'claude-2'],
        memory: {
            type: 'persistent',
            storage: 'redis',
            ttl: 2592000 // 30 days
        },
        capabilities: {
            trialGeneration: true,
            patternLearning: true,
            errorHandling: true,
            optimization: true
        }
    },

    // Initialize configuration
    init() {
        this.validateConfig();
        this.setupEventHandlers();
        this.initializeServices();
    },

    validateConfig() {
        if (!this.rapidApi.key) {
            throw new Error('RapidAPI key is required');
        }
    },

    setupEventHandlers() {
        process.on('SIGINT', this.cleanup.bind(this));
        process.on('SIGTERM', this.cleanup.bind(this));
    },

    initializeServices() {
        // Initialize all integrated services
        Object.keys(this.rapidApi.services).forEach(service => {
            console.log(`Initializing ${service}...`);
        });
    },

    cleanup() {
        // Cleanup resources before shutdown
        console.log('Cleaning up resources...');
    }
};
