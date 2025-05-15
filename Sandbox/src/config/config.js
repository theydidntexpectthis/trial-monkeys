const dotenv = require('dotenv');
dotenv.config();

const config = {
    // Server configuration
    server: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development',
        jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
        jwtExpiresIn: '24h'
    },

    // Database configuration
    database: {
        uri: process.env.MONGODB_URI || 'mongodb://mongodb:27017/trial-junkies',
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            retryWrites: true,
            w: 'majority'
        }
    },

    // CORS configuration
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    },

    // Redis configuration
    redis: {
        host: process.env.REDIS_HOST || 'redis',
        port: process.env.REDIS_PORT || 6379,
        options: {
            retryStrategy: times => Math.min(times * 50, 2000)
        }
    },

    // Session configuration
    session: {
        secret: process.env.SESSION_SECRET || 'your-session-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    },

    // Solana configuration
    solana: {
        network: process.env.SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com',
        commitment: 'confirmed'
    },

    // Bright Data configuration
    brightData: {
        username: process.env.BRIGHT_DATA_USERNAME,
        password: process.env.BRIGHT_DATA_PASSWORD,
        host: process.env.BRIGHT_DATA_HOST,
        port: process.env.BRIGHT_DATA_PORT,
        proxyTypes: {
            browser: 'brd',
            dataCenter: 'dc',
            residential: 'res'
        }
    },

    // RapidAPI configuration
    rapidApi: {
        key: process.env.RAPID_API_KEY,
        endpoints: {
            emailVerification: {
                host: 'email-verification.p.rapidapi.com',
                url: 'https://email-verification.p.rapidapi.com/verify'
            },
            phoneVerification: {
                host: 'phone-verification.p.rapidapi.com',
                url: 'https://phone-verification.p.rapidapi.com/verify'
            },
            identityGeneration: {
                host: 'fake-identity-generator.p.rapidapi.com',
                url: 'https://fake-identity-generator.p.rapidapi.com/generate'
            },
            captchaSolver: {
                host: 'captcha-solver.p.rapidapi.com',
                url: 'https://captcha-solver.p.rapidapi.com/solve'
            }
        }
    },

    // Browser automation configuration
    automation: {
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ],
            defaultViewport: {
                width: 1920,
                height: 1080
            },
            timeout: 30000
        }
    },

    // Service configuration
    service: {
        trialDurations: {
            min: 1,
            max: 30,
            default: 7
        },
        subscriptionLevels: ['free', 'basic', 'premium'],
        maxTrialsPerUser: {
            free: 1,
            basic: 3,
            premium: 10
        },
        categories: [
            'streaming',
            'software',
            'gaming',
            'education',
            'other'
        ]
    },

    // Rate limiting configuration
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    },

    // Error messages
    errors: {
        auth: {
            invalidToken: 'Invalid or expired token',
            noToken: 'No token provided',
            invalidSignature: 'Invalid wallet signature',
            unauthorized: 'Unauthorized access'
        },
        trial: {
            notFound: 'Trial service not found',
            notEligible: 'User not eligible for this trial',
            limitReached: 'Trial limit reached for this service',
            creationFailed: 'Failed to create trial account'
        },
        user: {
            notFound: 'User not found',
            invalidData: 'Invalid user data provided'
        }
    }
};

// Validate required environment variables
const requiredEnvVars = [
    'JWT_SECRET',
    'MONGODB_URI',
    'BRIGHT_DATA_USERNAME',
    'BRIGHT_DATA_PASSWORD',
    'RAPID_API_KEY'
];

requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
        console.warn(`Warning: ${envVar} environment variable is not set`);
    }
});

module.exports = config;
