/**
 * Automation Patterns Configuration
 * Defines patterns and strategies for browser automation and captcha solving
 */

module.exports = {
    // Browser Profiles
    browserProfiles: {
        default: {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'en-US',
            timezone: 'America/New_York'
        },
        mobile: {
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
            viewport: { width: 375, height: 812 },
            hasTouch: true,
            isMobile: true
        }
    },

    // Captcha Patterns
    captchaPatterns: {
        recaptchaV2: {
            detection: {
                iframe: "iframe[src*='recaptcha']",
                checkbox: ".recaptcha-checkbox-border",
                anchor: "[name='a-']"
            },
            solution: {
                tokenField: "#g-recaptcha-response",
                callback: "grecaptcha.enterprise.callback"
            }
        },
        recaptchaV3: {
            detection: {
                script: "script[src*='recaptcha']",
                action: "[data-action]"
            },
            solution: {
                tokenField: "[name='recaptcha-token']",
                injectable: true
            }
        },
        hcaptcha: {
            detection: {
                iframe: "iframe[src*='hcaptcha']",
                checkbox: "#checkbox",
                challenge: ".challenge-container"
            },
            solution: {
                tokenField: "[name='h-captcha-response']",
                callback: "hcaptcha.submit"
            }
        },
        imageCaptcha: {
            detection: {
                image: "img[alt*='captcha']",
                input: "input[name*='captcha']",
                form: "form:has(img[alt*='captcha'])"
            }
        }
    },

    // Form Patterns
    formPatterns: {
        login: {
            selectors: {
                email: "input[type='email'], input[name*='email']",
                password: "input[type='password']",
                submit: "button[type='submit'], input[type='submit']"
            }
        },
        registration: {
            selectors: {
                name: "input[name*='name']",
                email: "input[type='email']",
                password: "input[type='password']",
                confirm: "input[name*='confirm'], input[name*='verify']",
                submit: "button:contains('Sign up'), button:contains('Register')"
            }
        },
        payment: {
            selectors: {
                number: "input[name*='card'][name*='number']",
                expiry: "input[name*='expir']",
                cvv: "input[name*='cvv'], input[name*='cvc']",
                submit: "button:contains('Pay'), button:contains('Subscribe')"
            },
            iframePatterns: {
                stripe: {
                    number: "iframe[name*='cardnumber']",
                    expiry: "iframe[name*='exp-date']",
                    cvv: "iframe[name*='cvc']"
                }
            }
        }
    },

    // Anti-Detection Patterns
    antiDetection: {
        webdriver: {
            properties: [
                'webdriver',
                '_selenium',
                '_Selenium_IDE_Recorder',
                'callSelenium',
                '_WEBDRIVER_ELEM_CACHE'
            ]
        },
        automation: {
            properties: [
                'domAutomation',
                'domAutomationController',
                '__lastWatirPrompt',
                '__lastWatirConfirm',
                '__lastWatirAlert'
            ]
        },
        plugins: {
            mime: ['application/pdf', 'video/quicktime', 'application/x-shockwave-flash'],
            names: ['Chrome PDF Plugin', 'Chrome PDF Viewer', 'Native Client']
        }
    },

    // Success Patterns
    successPatterns: {
        urls: [
            '/dashboard',
            '/account',
            '/welcome',
            '/home',
            '/success'
        ],
        elements: [
            '.dashboard-welcome',
            '.account-panel',
            '#user-profile',
            '.welcome-message',
            '.success-notification'
        ],
        text: [
            'Welcome aboard',
            'Successfully activated',
            'Your account is ready',
            'Trial activated',
            'Getting started'
        ]
    },

    // Error Patterns
    errorPatterns: {
        captcha: [
            'verify you are human',
            'complete the security check',
            'prove you\'re not a robot',
            'captcha verification failed'
        ],
        automation: [
            'automated access detected',
            'unusual activity detected',
            'suspicious behavior',
            'security challenge'
        ],
        payment: [
            'payment failed',
            'card declined',
            'invalid card',
            'payment error'
        ],
        rate: [
            'too many attempts',
            'try again later',
            'rate limited',
            'temporary block'
        ]
    },

    // Wait Patterns
    waitPatterns: {
        navigation: {
            timeout: 30000,
            waitUntil: 'networkidle'
        },
        element: {
            timeout: 5000,
            visible: true
        },
        action: {
            timeout: 2000,
            stable: true
        }
    },

    // Randomization
    randomization: {
        delays: {
            input: { min: 50, max: 150 },
            click: { min: 100, max: 300 },
            page: { min: 1000, max: 3000 }
        },
        mouse: {
            movement: true,
            natural: true
        },
        keyboard: {
            natural: true,
            mistakes: 0.01
        }
    }
};
