const { chromium } = require('playwright');
const config = require('../config/industry-services.config');
const Redis = require('ioredis');

class AutomationProfilesService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.profiles = new Map();
        this.browserPool = new Map();
        this.requirements = config.requirements;
    }

    async createProfile(service) {
        const profileId = `profile_${Date.now()}`;
        const profile = {
            id: profileId,
            service: service.name,
            userAgent: this.generateUserAgent(service),
            fingerprint: await this.generateFingerprint(),
            cookies: new Map(),
            proxy: await this.assignProxy(service),
            created: new Date(),
            lastUsed: null,
            successRate: 100,
            attempts: 0
        };

        await this.saveProfile(profile);
        return profile;
    }

    async getBrowserProfile(service) {
        try {
            // Get or create profile
            let profile = await this.findServiceProfile(service);
            if (!profile) {
                profile = await this.createProfile(service);
            }

            // Launch browser with profile
            const browser = await this.launchBrowser(profile);
            const context = await this.setupContext(browser, profile);

            return {
                browser,
                context,
                profile
            };
        } catch (error) {
            console.error('Browser profile error:', error);
            throw error;
        }
    }

    async launchBrowser(profile) {
        const options = {
            ...this.requirements.browser.profiles.default,
            proxy: profile.proxy,
            userAgent: profile.userAgent,
            viewport: this.requirements.browser.profiles.default.viewport
        };

        const browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080'
            ]
        });

        this.browserPool.set(profile.id, browser);
        return browser;
    }

    async setupContext(browser, profile) {
        const context = await browser.newContext({
            userAgent: profile.userAgent,
            viewport: this.requirements.browser.profiles.default.viewport,
            deviceScaleFactor: 1,
            locale: 'en-US',
            timezoneId: 'America/New_York',
            permissions: ['geolocation'],
            geolocation: { latitude: 40.7128, longitude: -74.0060 },
            hasTouch: false,
            isMobile: false,
            colorScheme: 'dark'
        });

        // Set cookies if available
        if (profile.cookies.size > 0) {
            await context.addCookies(Array.from(profile.cookies.values()));
        }

        // Override fingerprint
        await context.addInitScript(function(fingerprint) {
            const overrides = {
                navigator: {
                    webdriver: false,
                    platform: fingerprint.platform,
                    languages: fingerprint.languages
                },
                screen: {
                    width: fingerprint.screen.width,
                    height: fingerprint.screen.height,
                    colorDepth: fingerprint.screen.colorDepth
                }
            };

            for (const [key, value] of Object.entries(overrides)) {
                Object.defineProperties(window[key], 
                    Object.getOwnPropertyDescriptors(value)
                );
            }
        }, profile.fingerprint);

        return context;
    }

    generateUserAgent(service) {
        const agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
        ];

        return agents[Math.floor(Math.random() * agents.length)];
    }

    async generateFingerprint() {
        return {
            platform: 'Win32',
            languages: ['en-US', 'en'],
            screen: {
                width: 1920,
                height: 1080,
                colorDepth: 24
            },
            timezone: 'America/New_York',
            webgl: {
                vendor: 'Google Inc. (Intel)',
                renderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)'
            }
        };
    }

    async assignProxy(service) {
        // Get proxy from pool based on service requirements
        const proxyConfig = this.requirements.proxy;
        
        if (!proxyConfig.required) return null;

        return {
            server: 'proxy.example.com',
            username: 'user',
            password: 'pass'
        };
    }

    async findServiceProfile(service) {
        const profiles = await this.redis.hgetall(`profiles:${service.name}`);
        if (!profiles) return null;

        // Find best performing profile
        return Object.values(profiles)
            .map(p => JSON.parse(p))
            .sort((a, b) => b.successRate - a.successRate)[0];
    }

    async saveProfile(profile) {
        await this.redis.hset(
            `profiles:${profile.service}`,
            profile.id,
            JSON.stringify(profile)
        );
    }

    async updateProfile(profile, success) {
        profile.attempts += 1;
        profile.lastUsed = new Date();
        profile.successRate = ((profile.successRate * (profile.attempts - 1) + (success ? 100 : 0)) / profile.attempts);

        await this.saveProfile(profile);
    }

    async rotateBrowser(profile) {
        const browser = this.browserPool.get(profile.id);
        if (browser) {
            await browser.close();
            this.browserPool.delete(profile.id);
        }

        // Create new profile with rotated fingerprint
        const newProfile = {
            ...profile,
            userAgent: this.generateUserAgent(profile.service),
            fingerprint: await this.generateFingerprint(),
            proxy: await this.assignProxy({ name: profile.service }),
            lastRotated: new Date()
        };

        await this.saveProfile(newProfile);
        return newProfile;
    }

    async cleanup() {
        // Close all browser instances
        for (const browser of this.browserPool.values()) {
            await browser.close();
        }
        this.browserPool.clear();

        // Clear profiles
        this.profiles.clear();
    }

    getProfileMetrics(profile) {
        return {
            id: profile.id,
            service: profile.service,
            successRate: profile.successRate,
            attempts: profile.attempts,
            lastUsed: profile.lastUsed,
            created: profile.created
        };
    }
}

module.exports = new AutomationProfilesService();
