/**
 * RapidAPI Configuration for Trial Monkeys
 * External service integrations for trial generation and verification
 */

module.exports = {
    // Email verification service
    emailVerification: {
        endpoint: process.env.RAPID_API_EMAIL_VERIFY_URL || 'https://email-verification.p.rapidapi.com/verify',
        headers: {
            'X-RapidAPI-Key': process.env.RAPID_API_KEY,
            'X-RapidAPI-Host': 'email-verification.p.rapidapi.com'
        },
        options: {
            checkDisposable: true,
            checkFree: true,
            validateSyntax: true
        }
    },

    // Phone verification service
    phoneVerification: {
        endpoint: process.env.RAPID_API_PHONE_VERIFY_URL || 'https://phone-verification.p.rapidapi.com/verify',
        headers: {
            'X-RapidAPI-Key': process.env.RAPID_API_KEY,
            'X-RapidAPI-Host': 'phone-verification.p.rapidapi.com'
        }
    },

    // Captcha solving service
    captchaSolver: {
        endpoint: process.env.RAPID_API_CAPTCHA_URL || 'https://captcha-solver.p.rapidapi.com/solve',
        headers: {
            'X-RapidAPI-Key': process.env.RAPID_API_KEY,
            'X-RapidAPI-Host': 'captcha-solver.p.rapidapi.com'
        },
        supportedTypes: ['recaptcha', 'hcaptcha', 'image'],
        timeout: 30000 // 30 seconds
    },

    // Identity generation service
    identityGenerator: {
        endpoint: process.env.RAPID_API_IDENTITY_URL || 'https://fake-identity-generator.p.rapidapi.com/generate',
        headers: {
            'X-RapidAPI-Key': process.env.RAPID_API_KEY,
            'X-RapidAPI-Host': 'fake-identity-generator.p.rapidapi.com'
        },
        defaultCountry: 'US',
        includeSocialMedia: true
    },

    // Error messages
    errors: {
        invalidEmail: 'Invalid email address or domain',
        invalidPhone: 'Invalid phone number format',
        captchaFailed: 'Failed to solve captcha challenge',
        serviceUnavailable: 'External service temporarily unavailable'
    },

    // Retry configuration
    retry: {
        attempts: 3,
        delay: 1000, // 1 second
        factor: 2, // exponential backoff
        maxDelay: 5000 // 5 seconds
    },

    // Cache configuration
    cache: {
        email: {
            ttl: 24 * 60 * 60, // 24 hours
            maxSize: 10000 // entries
        },
        identity: {
            ttl: 12 * 60 * 60, // 12 hours
            maxSize: 5000 // entries
        }
    },

    // Initialize and validate configuration
    init() {
        if (!process.env.RAPID_API_KEY) {
            throw new Error('RAPID_API_KEY environment variable is required');
        }

        // Validate endpoints
        Object.entries(this).forEach(([key, value]) => {
            if (value && value.endpoint && !this.isValidUrl(value.endpoint)) {
                throw new Error(`Invalid endpoint URL for ${key}`);
            }
        });
    },

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
};
