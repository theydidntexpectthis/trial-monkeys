/**
 * Service-Specific Rules and Patterns Configuration
 * Defines automation rules, form patterns, and requirements for each service
 */

module.exports = {
    streaming: {
        netflix: {
            name: "Netflix",
            rules: {
                registration: {
                    steps: [
                        { type: "emailFirst", required: true },
                        { type: "planSelection", required: true },
                        { type: "paymentInfo", required: true }
                    ],
                    restrictions: {
                        ipReuse: false,
                        deviceLimit: true,
                        geoRestriction: true
                    }
                },
                verification: {
                    email: true,
                    phone: false,
                    captcha: true
                },
                payment: {
                    preAuth: 1.00,
                    cardRequirements: {
                        binRestrictions: true,
                        virtualAllowed: true,
                        debitOnly: false
                    }
                }
            },
            selectors: {
                email: "#id_userLoginId",
                password: "#id_password",
                planSelect: ".planGrid button",
                cardNumber: "#id_creditCardNumber",
                cardExpiry: "#id_creditExpirationMonth",
                cardCvv: "#id_creditCardSecurityCode",
                submit: ".submit-button"
            }
        },
        disney: {
            name: "Disney+",
            rules: {
                registration: {
                    steps: [
                        { type: "accountCreation", required: true },
                        { type: "paymentInfo", required: true }
                    ],
                    restrictions: {
                        ipReuse: true,
                        deviceLimit: false,
                        geoRestriction: true
                    }
                },
                verification: {
                    email: true,
                    phone: false,
                    captcha: true
                },
                payment: {
                    preAuth: 1.00,
                    cardRequirements: {
                        binRestrictions: false,
                        virtualAllowed: true,
                        debitOnly: false
                    }
                }
            },
            selectors: {
                email: "#email",
                password: "#password",
                cardNumber: "#cc-number",
                cardExpiry: "#cc-expiry",
                cardCvv: "#cc-cvv",
                submit: ".sign-up-button"
            }
        }
    },

    productivity: {
        adobe: {
            name: "Adobe Creative Cloud",
            rules: {
                registration: {
                    steps: [
                        { type: "emailVerification", required: true },
                        { type: "planSelection", required: true },
                        { type: "paymentInfo", required: true }
                    ],
                    restrictions: {
                        ipReuse: false,
                        deviceLimit: true,
                        geoRestriction: false
                    }
                },
                verification: {
                    email: true,
                    phone: true,
                    captcha: true
                },
                payment: {
                    preAuth: 0.00,
                    cardRequirements: {
                        binRestrictions: true,
                        virtualAllowed: true,
                        debitOnly: false
                    }
                }
            },
            selectors: {
                email: "#EmailPage-EmailField",
                password: "#PasswordPage-PasswordField",
                phone: "#PhonePage-PhoneNumberField",
                planSelect: ".plan-selector",
                submit: "#EmailPage-ContinueButton"
            }
        }
    },

    gaming: {
        xbox: {
            name: "Xbox Game Pass",
            rules: {
                registration: {
                    steps: [
                        { type: "microsoftAccount", required: true },
                        { type: "paymentInfo", required: true }
                    ],
                    restrictions: {
                        ipReuse: true,
                        deviceLimit: false,
                        geoRestriction: true
                    }
                },
                verification: {
                    email: true,
                    phone: false,
                    captcha: true
                },
                payment: {
                    preAuth: 1.00,
                    cardRequirements: {
                        binRestrictions: true,
                        virtualAllowed: true,
                        debitOnly: true
                    }
                }
            }
        }
    },

    // Common Patterns
    patterns: {
        email: {
            validation: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
            restricted: [
                "@tempmail",
                "@disposable",
                "@throwaway"
            ]
        },
        password: {
            minLength: 8,
            maxLength: 32,
            requirements: {
                uppercase: true,
                lowercase: true,
                numbers: true,
                symbols: true
            }
        },
        phone: {
            format: "+1{area}{exchange}{number}",
            validation: /^\+1[2-9]\d{2}[2-9]\d{2}\d{4}$/
        }
    },

    // Error Patterns
    errors: {
        registration: {
            patterns: [
                "email already registered",
                "invalid email format",
                "password requirements not met"
            ]
        },
        payment: {
            patterns: [
                "card declined",
                "invalid card number",
                "payment failed"
            ]
        },
        verification: {
            patterns: [
                "verification failed",
                "code expired",
                "too many attempts"
            ]
        }
    },

    // Success Patterns
    success: {
        registration: {
            urls: [
                "/welcome",
                "/dashboard",
                "/home"
            ],
            elements: [
                ".welcome-message",
                ".dashboard-panel",
                "#user-profile"
            ]
        },
        payment: {
            urls: [
                "/success",
                "/confirmation",
                "/thank-you"
            ],
            elements: [
                ".payment-success",
                ".confirmation-message",
                "#order-complete"
            ]
        }
    },

    // Recovery Procedures
    recovery: {
        payment: {
            retryAttempts: 3,
            cooldown: 300, // 5 minutes
            alternativeMethods: ["paypal", "giftcard"]
        },
        verification: {
            maxAttempts: 5,
            timeout: 600, // 10 minutes
            alternativeMethods: ["email", "sms"]
        },
        automation: {
            detectFailure: {
                selectors: [
                    ".error-message",
                    "#error-container",
                    ".alert-danger"
                ],
                text: [
                    "automation detected",
                    "suspicious activity",
                    "security check required"
                ]
            },
            recovery: {
                actions: [
                    "rotate_proxy",
                    "change_user_agent",
                    "clear_cookies"
                ],
                delay: 60 // 1 minute
            }
        }
    }
};
