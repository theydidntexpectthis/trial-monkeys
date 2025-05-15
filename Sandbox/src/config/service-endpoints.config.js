/**
 * Service Endpoints and Automation Patterns Configuration
 * Defines endpoints and automation steps for each supported service
 */

module.exports = {
    streaming: {
        netflix: {
            name: "Netflix",
            url: "netflix.com",
            endpoints: {
                signup: "/signup",
                login: "/login",
                account: "/youraccount",
                plans: "/signup/planform",
                payment: "/signup/payment"
            },
            automationSteps: [
                { type: "navigate", url: "/signup" },
                { type: "input", selector: "#id_email", value: "{email}" },
                { type: "input", selector: "#id_password", value: "{password}" },
                { type: "click", selector: ".submit-button" },
                { type: "wait", selector: ".planGrid" },
                { type: "click", selector: "[data-plan='premium']" },
                { type: "fillCard", selectors: {
                    number: "#id_creditCardNumber",
                    expiry: "#id_creditExpirationMonth",
                    cvv: "#id_creditCardSecurityCode"
                }}
            ]
        },
        disney: {
            name: "Disney+",
            url: "disneyplus.com",
            endpoints: {
                signup: "/sign-up",
                login: "/login",
                select: "/select-offer"
            },
            automationSteps: [
                { type: "navigate", url: "/sign-up" },
                { type: "click", selector: ".trial-button" },
                { type: "input", selector: "#email", value: "{email}" },
                { type: "input", selector: "#password", value: "{password}" },
                { type: "fillCard", selectors: {
                    number: "#cc-number",
                    expiry: "#cc-expiry",
                    cvv: "#cc-cvv"
                }}
            ]
        }
    },

    productivity: {
        adobe: {
            name: "Adobe Creative Cloud",
            url: "adobe.com",
            endpoints: {
                signup: "/creativecloud/start-for-free",
                plans: "/creativecloud/plans",
                payment: "/store/checkout"
            },
            automationSteps: [
                { type: "navigate", url: "/creativecloud/start-for-free" },
                { type: "input", selector: "#EmailPage-EmailField", value: "{email}" },
                { type: "click", selector: "#EmailPage-ContinueButton" },
                { type: "input", selector: "#password", value: "{password}" },
                { type: "handleCaptcha", type: "recaptcha" }
            ]
        },
        office365: {
            name: "Microsoft 365",
            url: "microsoft.com",
            endpoints: {
                signup: "/microsoft-365/try",
                business: "/microsoft-365/business/try",
                enterprise: "/microsoft-365/enterprise/try"
            },
            automationSteps: [
                { type: "navigate", url: "/microsoft-365/try" },
                { type: "input", selector: "#email", value: "{email}" },
                { type: "verifyEmail", provider: "outlook" },
                { type: "fillForm", selectors: {
                    company: "#CompanyName",
                    phone: "#PhoneNumber",
                    country: "#Country"
                }}
            ]
        }
    },

    development: {
        github: {
            name: "GitHub Pro",
            url: "github.com",
            endpoints: {
                signup: "/join",
                upgrade: "/settings/billing/upgrade",
                payment: "/settings/billing/payment"
            },
            automationSteps: [
                { type: "navigate", url: "/join" },
                { type: "input", selector: "#email", value: "{email}" },
                { type: "input", selector: "#password", value: "{password}" },
                { type: "handleCaptcha", type: "recaptcha" }
            ]
        },
        jetbrains: {
            name: "JetBrains Suite",
            url: "jetbrains.com",
            endpoints: {
                signup: "/store/try",
                products: "/store/products",
                checkout: "/store/checkout"
            },
            automationSteps: [
                { type: "navigate", url: "/store/try" },
                { type: "click", selector: ".all-products-button" },
                { type: "input", selector: "#email", value: "{email}" },
                { type: "fillForm", selectors: {
                    name: "#name",
                    company: "#company",
                    phone: "#phone"
                }}
            ]
        }
    },

    protection: {
        nordvpn: {
            name: "NordVPN",
            url: "nordvpn.com",
            endpoints: {
                signup: "/signup",
                pricing: "/pricing",
                checkout: "/checkout"
            },
            automationSteps: [
                { type: "navigate", url: "/signup" },
                { type: "selectPlan", selector: ".premium-plan" },
                { type: "input", selector: "#email", value: "{email}" },
                { type: "fillCard", selectors: {
                    number: "#card-number",
                    expiry: "#card-expiry",
                    cvv: "#card-cvc"
                }}
            ]
        }
    },

    // Common automation patterns
    patterns: {
        emailVerification: {
            outlook: {
                domain: "@outlook.com",
                checkInterval: 5000,
                maxAttempts: 6
            },
            gmail: {
                domain: "@gmail.com",
                checkInterval: 5000,
                maxAttempts: 6
            }
        },
        captcha: {
            recaptcha: {
                frameSelector: "iframe[src*='recaptcha']",
                checkboxSelector: ".recaptcha-checkbox-border"
            },
            hcaptcha: {
                frameSelector: "iframe[src*='hcaptcha']",
                checkboxSelector: "#checkbox"
            }
        },
        paymentForms: {
            standardForm: {
                number: "input[name*='card'][name*='number']",
                expiry: "input[name*='expir']",
                cvv: "input[name*='cvv'], input[name*='cvc']"
            },
            stripeForm: {
                number: "#card-number iframe",
                expiry: "#card-expiry iframe",
                cvv: "#card-cvc iframe"
            }
        }
    },

    // Error patterns to handle
    errorPatterns: {
        captchaDetection: [
            "verify you are human",
            "complete the security check",
            "prove you're not a robot"
        ],
        paymentFailure: [
            "payment failed",
            "card declined",
            "invalid card"
        ],
        rateLimiting: [
            "too many attempts",
            "try again later",
            "temporary block"
        ]
    },

    // Success indicators
    successPatterns: {
        urls: [
            "/dashboard",
            "/account",
            "/welcome",
            "/home"
        ],
        elements: [
            ".dashboard-welcome",
            ".account-panel",
            "#user-profile"
        ],
        text: [
            "welcome aboard",
            "getting started",
            "trial activated"
        ]
    }
};
