/**
 * Entertainment Services Configuration
 * Detailed configuration for streaming and entertainment trial automation
 */

module.exports = {
    services: {
        netflix: {
            name: 'Netflix Premium',
            url: 'https://netflix.com/signup',
            icon: '🎬',
            price: 19.99,
            trialDuration: 30,
            automationSteps: {
                signup: [
                    { type: 'input', selector: '#id_email', value: '{email}' },
                    { type: 'input', selector: '#id_password', value: '{password}' },
                    { type: 'click', selector: '.submit-button' },
                    { type: 'wait', selector: '#creditOrDebitCardDisplayStringId' },
                    { type: 'input', selector: '#id_creditCardNumber', value: '{card_number}' },
                    { type: 'input', selector: '#id_creditExpirationMonth', value: '{card_month}' },
                    { type: 'input', selector: '#id_creditExpirationYear', value: '{card_year}' },
                    { type: 'input', selector: '#id_creditCardSecurityCode', value: '{card_cvv}' }
                ],
                cleanup: [
                    { type: 'navigate', url: 'https://netflix.com/youraccount' },
                    { type: 'click', selector: '.cancel-button' },
                    { type: 'click', selector: '.confirm-cancel-button' }
                ]
            }
        },
        spotify: {
            name: 'Spotify Premium',
            url: 'https://spotify.com/premium',
            icon: '🎵',
            price: 9.99,
            trialDuration: 30,
            automationSteps: {
                signup: [
                    { type: 'click', selector: '[data-testid="premium-button"]' },
                    { type: 'input', selector: '#email', value: '{email}' },
                    { type: 'input', selector: '#password', value: '{password}' },
                    { type: 'input', selector: '#displayname', value: '{username}' },
                    { type: 'click', selector: '#terms-conditions-checkbox' },
                    { type: 'click', selector: '[data-testid="submit-button"]' }
                ]
            }
        },
        disneyPlus: {
            name: 'Disney+',
            url: 'https://disneyplus.com',
            icon: '🏰',
            price: 7.99,
            trialDuration: 7,
            automationSteps: {
                signup: [
                    { type: 'click', selector: '.sign-up-button' },
                    { type: 'input', selector: '#email', value: '{email}' },
                    { type: 'click', selector: '.submit-button' },
                    { type: 'input', selector: '#password', value: '{password}' }
                ]
            }
        },
        hboMax: {
            name: 'HBO Max',
            url: 'https://hbomax.com',
            icon: '📺',
            price: 15.99,
            trialDuration: 7,
            automationSteps: {
                signup: [
                    { type: 'click', selector: '.trial-button' },
                    { type: 'input', selector: '#email', value: '{email}' },
                    { type: 'input', selector: '#password', value: '{password}' }
                ]
            }
        }
    },

    cardRequirements: {
        netflix: { required: true, preAuth: 1.00 },
        spotify: { required: true, preAuth: 0.00 },
        disneyPlus: { required: true, preAuth: 1.00 },
        hboMax: { required: true, preAuth: 0.00 }
    },

    browserProfiles: {
        netflix: {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            geolocation: { country: 'US' }
        },
        spotify: {
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            viewport: { width: 1440, height: 900 },
            geolocation: { country: 'US' }
        }
    },

    proxyRequirements: {
        netflix: { type: 'residential', country: 'US' },
        spotify: { type: 'datacenter', country: 'US' },
        disneyPlus: { type: 'residential', country: 'US' },
        hboMax: { type: 'residential', country: 'US' }
    },

    // Common patterns for entertainment services
    patterns: {
        emailValidation: {
            domains: ['gmail.com', 'outlook.com', 'yahoo.com'],
            format: '{username}+trial{random}@{domain}'
        },
        passwordPattern: 'Trial{random}!{year}',
        cardPatterns: {
            visa: /^4[0-9]{12}(?:[0-9]{3})?$/,
            mastercard: /^5[1-5][0-9]{14}$/
        }
    },

    // Recovery procedures
    recovery: {
        captchaDetection: {
            selectors: [
                'iframe[src*="recaptcha"]',
                'iframe[src*="hcaptcha"]',
                '#captcha-container'
            ]
        },
        ipBlocking: {
            indicators: [
                'unusual activity',
                'too many attempts',
                'please try again later'
            ],
            waitTime: 3600 // 1 hour
        }
    },

    // Success indicators
    successIndicators: {
        netflix: {
            urls: ['/browse', '/profiles'],
            elements: ['.profile-icon', '.account-menu']
        },
        spotify: {
            urls: ['/home', '/browse'],
            elements: ['.now-playing-bar', '.your-library-x']
        }
    },

    // Entertainment bundle packages
    bundles: {
        streaming: {
            name: 'Streaming Bundle',
            services: ['netflix', 'disneyPlus', 'hboMax'],
            discount: 0.15, // 15% off
            duration: 30
        },
        music: {
            name: 'Music Bundle',
            services: ['spotify', 'appleMusicUrl', 'tidalUrl'],
            discount: 0.10, // 10% off
            duration: 30
        }
    },

    // Rate limiting and cooldown
    rateLimiting: {
        perService: {
            maxAttempts: 3,
            cooldown: 3600, // 1 hour
            maxDaily: 10
        },
        perIP: {
            maxAttempts: 5,
            cooldown: 1800, // 30 minutes
            maxDaily: 20
        }
    }
};
