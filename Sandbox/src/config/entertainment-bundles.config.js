/**
 * Entertainment Bundles Configuration
 * Defines bundles, pricing, and service combinations for entertainment trials
 */

module.exports = {
    // Premium Streaming Bundle
    streamingPremium: {
        name: "Ultimate Streaming Bundle",
        icon: "🎬",
        price: {
            amount: 25,
            currency: "MONK",
            savings: "60%"
        },
        services: [
            {
                name: "Netflix Premium",
                features: ["4K Streaming", "4 Screens", "Downloads"],
                duration: 30,
                requirements: {
                    captcha: true,
                    payment: true,
                    email: true
                }
            },
            {
                name: "Disney+",
                features: ["4K HDR", "4 Devices", "Downloads"],
                duration: 30,
                requirements: {
                    payment: true,
                    email: true
                }
            },
            {
                name: "HBO Max",
                features: ["4K HDR", "3 Devices", "Warner Content"],
                duration: 30,
                requirements: {
                    payment: true,
                    email: true
                }
            },
            {
                name: "Spotify Premium",
                features: ["Ad-free", "Offline Mode", "High Quality"],
                duration: 30,
                requirements: {
                    payment: true,
                    email: true
                }
            }
        ],
        features: [
            "One-click activation",
            "Auto-renewal protection",
            "Priority support",
            "Virtual card per service"
        ],
        automationPriority: "high",
        concurrentGeneration: true
    },

    // Gaming Bundle
    gamingPremium: {
        name: "Ultimate Gaming Bundle",
        icon: "🎮",
        price: {
            amount: 20,
            currency: "MONK",
            savings: "45%"
        },
        services: [
            {
                name: "Xbox Game Pass Ultimate",
                features: ["100+ Games", "Xbox Live Gold", "EA Play"],
                duration: 14,
                requirements: {
                    payment: true,
                    microsoft: true
                }
            },
            {
                name: "PlayStation Now",
                features: ["700+ Games", "PS4/PS5 Games", "Cloud Gaming"],
                duration: 14,
                requirements: {
                    payment: true,
                    psn: true
                }
            },
            {
                name: "EA Play Pro",
                features: ["New Releases", "Full Games", "Early Access"],
                duration: 14,
                requirements: {
                    payment: true,
                    email: true
                }
            }
        ],
        features: [
            "Cross-platform access",
            "Auto-renewal protection",
            "Account security"
        ],
        automationPriority: "medium",
        concurrentGeneration: false
    },

    // Music Bundle
    musicPremium: {
        name: "Ultimate Music Bundle",
        icon: "🎵",
        price: {
            amount: 15,
            currency: "MONK",
            savings: "50%"
        },
        services: [
            {
                name: "Spotify Premium",
                features: ["Ad-free", "Offline Mode", "High Quality"],
                duration: 30,
                requirements: {
                    payment: true,
                    email: true
                }
            },
            {
                name: "Apple Music",
                features: ["90M Songs", "Lossless", "Spatial Audio"],
                duration: 30,
                requirements: {
                    payment: true,
                    apple: true
                }
            },
            {
                name: "Tidal HiFi",
                features: ["HiFi Quality", "Videos", "Exclusive Content"],
                duration: 30,
                requirements: {
                    payment: true,
                    email: true
                }
            }
        ],
        features: [
            "High-quality streaming",
            "Cross-platform support",
            "Offline access"
        ],
        automationPriority: "medium",
        concurrentGeneration: true
    },

    // Bundle Generation Rules
    generationRules: {
        maxConcurrent: 3,
        delayBetween: 5000, // 5 seconds
        retryAttempts: 3,
        priorities: {
            high: {
                maxRetries: 5,
                timeoutMultiplier: 2
            },
            medium: {
                maxRetries: 3,
                timeoutMultiplier: 1.5
            },
            low: {
                maxRetries: 2,
                timeoutMultiplier: 1
            }
        }
    },

    // Success Criteria
    successCriteria: {
        minimumServices: 0.75, // 75% of services must succeed
        requiredServices: ["Netflix Premium", "Spotify Premium"], // Must succeed
        timeoutMinutes: 15
    },

    // Bundle Protection
    protection: {
        virtualCards: {
            perService: true,
            preAuthAmount: 1.00,
            monthlyLimit: 100.00
        },
        accounts: {
            uniqueEmails: true,
            uniquePasswords: true,
            rotationDays: 30
        },
        automation: {
            profileRotation: true,
            proxyRotation: true,
            userAgentRotation: true
        }
    },

    // Notification Templates
    notifications: {
        bundleCreated: {
            title: "🎉 Bundle Generated Successfully!",
            message: "Your {bundleName} has been generated with {serviceCount} services."
        },
        trialExpiring: {
            title: "⚠️ Trial Expiring Soon",
            message: "Your {serviceName} trial will expire in {daysLeft} days."
        },
        bundleError: {
            title: "❌ Bundle Generation Issue",
            message: "There was an issue with {serviceName}. Support has been notified."
        }
    },

    // Analytics Configuration
    analytics: {
        trackMetrics: [
            "generation_time",
            "success_rate",
            "error_rate",
            "money_saved"
        ],
        aggregation: {
            timeframe: "daily",
            retention: 90 // days
        }
    }
};
