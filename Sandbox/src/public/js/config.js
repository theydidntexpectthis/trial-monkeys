// Configuration and Environment Settings for Trial Monkeys
const config = {
    // API Endpoints
    api: {
        auth: {
            wallet: '/api/auth/wallet',
            discord: '/api/auth/discord',
            validate: '/api/auth/validate'
        },
        trials: {
            generate: '/api/trials/generate',
            extend: '/api/trials/extend',
            list: '/api/trials/list',
            cancel: '/api/trials/cancel'
        },
        subscription: {
            upgrade: '/api/subscription/upgrade',
            status: '/api/subscription/status'
        }
    },

    // External Services
    services: {
        rapidApi: {
            emailVerification: process.env.RAPID_API_EMAIL_VERIFY_URL,
            phoneVerification: process.env.RAPID_API_PHONE_VERIFY_URL,
            captchaSolver: process.env.RAPID_API_CAPTCHA_SOLVER_URL
        },
        discord: {
            clientId: process.env.DISCORD_CLIENT_ID,
            redirectUri: `${window.location.origin}/auth/discord/callback`,
            scopes: ['identify', 'email']
        },
        solana: {
            network: process.env.SOLANA_NETWORK || 'devnet',
            tokenAddress: process.env.MONK_TOKEN_ADDRESS
        }
    },

    // Trial Configuration
    trials: {
        defaultDuration: 14, // days
        maxDuration: 60, // days
        maxConcurrent: {
            single: 1,
            power: 5,
            enterprise: 10
        },
        extensionPrice: 2 // $MONK tokens
    },

    // UI Configuration
    ui: {
        themes: {
            dark: {
                primary: '#7aa2f7',
                secondary: '#24273a',
                background: '#1a1b26',
                card: '#1f2937',
                text: '#ffffff',
                border: 'rgba(255, 255, 255, 0.1)'
            }
        },
        animations: {
            duration: '0.3s',
            timing: 'ease'
        },
        notifications: {
            duration: 5000, // ms
            position: 'top-right'
        }
    },

    // Monitoring Configuration
    monitoring: {
        enabled: true,
        interval: 5000, // ms
        endpoints: {
            status: '/api/status',
            metrics: '/api/metrics'
        }
    },

    // Feature Flags
    features: {
        discordAuth: true,
        walletAuth: true,
        urlGeneration: true,
        autoRenewal: true,
        customDomains: true,
        apiAccess: true
    },

    // Error Messages
    errors: {
        wallet: {
            notInstalled: 'Phantom wallet is not installed! Please install it from phantom.app',
            connectionFailed: 'Failed to connect to Phantom wallet',
            paymentFailed: 'Payment transaction failed'
        },
        trial: {
            generation: 'Failed to generate trial account',
            extension: 'Failed to extend trial duration',
            limitReached: 'Trial limit reached for your subscription tier'
        },
        auth: {
            invalidToken: 'Authentication token is invalid or expired',
            unauthorized: 'Unauthorized access'
        }
    },

    // Initialize configuration
    init() {
        // Validate required environment variables
        this.validateConfig();
        
        // Set up global error handler
        window.onerror = (msg, url, line, col, error) => {
            console.error('Global error:', { msg, url, line, col, error });
            // You might want to send this to your error tracking service
        };

        // Initialize features based on environment
        this.initializeFeatures();
    },

    validateConfig() {
        const required = [
            'RAPID_API_KEY',
            'DISCORD_CLIENT_ID',
            'MONK_TOKEN_ADDRESS'
        ];

        const missing = required.filter(key => !process.env[key]);
        if (missing.length > 0) {
            console.warn('Missing required environment variables:', missing);
        }
    },

    initializeFeatures() {
        // Disable features based on environment or configuration
        if (process.env.NODE_ENV === 'development') {
            this.features.autoRenewal = false;
        }

        // Add feature detection
        this.features.walletAuth = this.features.walletAuth && !!window?.solana;
    }
};

// Initialize configuration
document.addEventListener('DOMContentLoaded', () => config.init());

// Export configuration
export default config;
