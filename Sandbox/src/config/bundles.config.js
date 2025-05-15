/**
 * Trial Bundles Configuration
 * Defines entertainment and service packages with special pricing
 */

module.exports = {
    // Entertainment Premium Bundle
    entertainmentBundle: {
        name: "Entertainment Premium Pack",
        icon: "🎬",
        description: "All-in-one streaming and entertainment bundle",
        services: [
            {
                name: "Netflix Premium",
                duration: 30,
                features: ["4K Streaming", "4 Screens", "No Ads"]
            },
            {
                name: "Disney+ Premium",
                duration: 30,
                features: ["4K HDR", "4 Devices", "Downloads"]
            },
            {
                name: "Spotify Premium",
                duration: 30,
                features: ["Ad-free", "Offline Mode", "HD Quality"]
            },
            {
                name: "HBO Max",
                duration: 30,
                features: ["4K HDR", "3 Devices", "Warner Content"]
            }
        ],
        price: {
            amount: 25,
            currency: "MONK",
            savings: "60%"
        }
    },

    // Gaming Bundle
    gamingBundle: {
        name: "Gaming Master Pack",
        icon: "🎮",
        description: "Ultimate gaming services bundle",
        services: [
            {
                name: "Xbox Game Pass Ultimate",
                duration: 14,
                features: ["100+ Games", "Xbox Live Gold", "EA Play"]
            },
            {
                name: "PlayStation Now",
                duration: 14,
                features: ["700+ Games", "PS4/PS5 Games", "Cloud Gaming"]
            },
            {
                name: "Nintendo Switch Online",
                duration: 14,
                features: ["Classic Games", "Online Play", "Cloud Saves"]
            }
        ],
        price: {
            amount: 15,
            currency: "MONK",
            savings: "45%"
        }
    },

    // Productivity Bundle
    productivityBundle: {
        name: "Professional Tools Pack",
        icon: "💼",
        description: "Essential software for professionals",
        services: [
            {
                name: "Adobe Creative Cloud",
                duration: 14,
                features: ["All Apps", "100GB Storage", "Adobe Fonts"]
            },
            {
                name: "Microsoft 365",
                duration: 30,
                features: ["Office Apps", "1TB OneDrive", "Teams Premium"]
            },
            {
                name: "Notion Premium",
                duration: 30,
                features: ["Unlimited Storage", "API Access", "Version History"]
            }
        ],
        price: {
            amount: 20,
            currency: "MONK",
            savings: "50%"
        }
    },

    // Bundle Settings
    settings: {
        maxConcurrentTrials: 5,
        cooldownPeriod: 30,
        extensionOptions: [7, 14, 30],
        paymentMethods: ["MONK", "SOL"],
        restrictions: {
            regionLock: false,
            vpnRequired: true,
            deviceLimit: 4
        }
    },

    // Success Metrics
    metrics: {
        minSuccessRate: 0.85,
        maxAttempts: 3,
        monitoringInterval: 3600,
        alertThresholds: {
            successRate: 0.75,
            errorRate: 0.15,
            responseTime: 5000
        }
    }
};
