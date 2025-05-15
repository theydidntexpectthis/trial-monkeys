/**
 * Industry-Specific Services Configuration
 * Defines automation patterns and requirements for each service category
 */

module.exports = {
    // Software & Development Tools
    development: {
        name: "Development Tools",
        icon: "💻",
        services: [
            {
                name: "JetBrains Suite",
                url: "jetbrains.com",
                logo: "jetbrains.com?token=pk_RDgtA8q6SmeobLWwPgJEwg",
                duration: 30,
                price: 249.99,
                automationSteps: [
                    { type: "navigate", url: "/purchase/products" },
                    { type: "click", selector: "#trial-button" },
                    { type: "fillForm", data: ["email", "password", "name"] },
                    { type: "submit", selector: "#signup-form" }
                ]
            },
            {
                name: "GitHub Pro",
                url: "github.com",
                logo: "github.com?token=pk_RDgtA8q6SmeobLWwPgJEwg",
                duration: 14,
                price: 99.99,
                automationSteps: [
                    { type: "navigate", url: "/pricing" },
                    { type: "click", selector: ".try-pro-button" },
                    { type: "oauth", provider: "github" }
                ]
            }
            // Add more development tools...
        ]
    },

    // Creative & Design
    creative: {
        name: "Creative Suites",
        icon: "🎨",
        services: [
            {
                name: "Adobe Creative Cloud",
                url: "adobe.com",
                logo: "adobe.com?token=pk_RDgtA8q6SmeobLWwPgJEwg",
                duration: 7,
                price: 79.99,
                automationSteps: [
                    { type: "navigate", url: "/creativecloud/plans" },
                    { type: "click", selector: "#free-trial-button" },
                    { type: "fillForm", data: ["email", "password", "card"] },
                    { type: "handleCaptcha", type: "recaptcha" }
                ]
            }
            // Add more creative tools...
        ]
    },

    // Business & Productivity
    productivity: {
        name: "Business Tools",
        icon: "💼",
        services: [
            {
                name: "Microsoft 365",
                url: "microsoft.com",
                logo: "microsoft.com?token=pk_RDgtA8q6SmeobLWwPgJEwg",
                duration: 30,
                price: 99.99,
                automationSteps: [
                    { type: "navigate", url: "/microsoft-365/business/free-trial" },
                    { type: "fillForm", data: ["email", "phone", "company"] },
                    { type: "verifyEmail", provider: "outlook" }
                ]
            }
            // Add more productivity tools...
        ]
    },

    // Education & Learning
    education: {
        name: "Educational Platforms",
        icon: "📚",
        services: [
            {
                name: "Coursera Plus",
                url: "coursera.org",
                logo: "coursera.org?token=pk_RDgtA8q6SmeobLWwPgJEwg",
                duration: 7,
                price: 59.99,
                automationSteps: [
                    { type: "navigate", url: "/plus-trial" },
                    { type: "oauth", provider: "google" },
                    { type: "payment", method: "card" }
                ]
            }
            // Add more education platforms...
        ]
    },

    // Security & VPN
    security: {
        name: "Security Tools",
        icon: "🔒",
        services: [
            {
                name: "NordVPN",
                url: "nordvpn.com",
                logo: "nordvpn.com?token=pk_RDgtA8q6SmeobLWwPgJEwg",
                duration: 30,
                price: 11.99,
                automationSteps: [
                    { type: "navigate", url: "/pricing" },
                    { type: "selectPlan", plan: "premium" },
                    { type: "payment", method: "card" }
                ]
            }
            // Add more security tools...
        ]
    },

    // Automation Requirements
    requirements: {
        browser: {
            profiles: {
                default: {
                    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124",
                    viewport: { width: 1920, height: 1080 }
                },
                mobile: {
                    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6) AppleWebKit/605.1.15",
                    viewport: { width: 375, height: 812 }
                }
            }
        },
        automation: {
            timeouts: {
                navigation: 30000,
                element: 5000,
                script: 10000
            },
            retries: {
                attempts: 3,
                delay: 1000
            }
        },
        proxy: {
            required: true,
            types: ["residential", "datacenter"],
            rotation: {
                enabled: true,
                interval: 600 // 10 minutes
            }
        }
    },

    // Form Generation Patterns
    formPatterns: {
        email: {
            format: "trial_{random}@trialmonkeys.com",
            domains: ["gmail.com", "outlook.com", "yahoo.com"]
        },
        password: {
            pattern: "Trial{random}!{year}",
            length: { min: 8, max: 16 }
        },
        phone: {
            format: "+1{random10}",
            countries: ["US", "CA", "UK"]
        }
    },

    // Success Indicators
    successPatterns: {
        urls: ["/dashboard", "/account", "/welcome"],
        elements: [".dashboard", ".account-info", ".welcome-message"],
        text: ["successful", "welcome", "getting started"]
    },

    // Error Patterns
    errorPatterns: {
        captcha: ["captcha", "verify human", "not a robot"],
        blocked: ["blocked", "suspicious", "too many attempts"],
        payment: ["payment failed", "card declined", "invalid card"]
    }
};
