const BrowserAutomationService = require('./browser-automation.service');
const RAGAgentService = require('./rag-agent.service');
const VirtualCardService = require('./virtual-card.service');
const config = require('../config/entertainment.config');
const bundles = require('../config/bundles.config');

class EntertainmentAutomationService {
    constructor() {
        this.browser = BrowserAutomationService;
        this.ragAgent = RAGAgentService;
        this.virtualCards = VirtualCardService;
    }

    async generateEntertainmentTrial(service, options = {}) {
        try {
            // Get optimal strategy from RAG agent
            const strategy = await this.ragAgent.suggestStrategy({
                serviceType: 'entertainment',
                serviceName: service.name,
                requirements: service.requirements
            });

            // Setup virtual card if needed
            const paymentMethod = await this.setupPaymentMethod(service);

            // Execute trial generation
            const trial = await this.executeTrialGeneration(service, strategy, paymentMethod, options);

            // Learn from execution
            await this.ragAgent.learnFromExecution({
                strategy,
                outcome: trial.status === 'active' ? 'success' : 'failure',
                executionDetails: trial
            });

            return trial;
        } catch (error) {
            console.error('Entertainment trial generation error:', error);
            throw error;
        }
    }

    async generateBundle(bundleType) {
        const bundle = bundles[`${bundleType}Bundle`];
        if (!bundle) throw new Error('Invalid bundle type');

        const trials = [];
        for (const service of bundle.services) {
            try {
                const trial = await this.generateEntertainmentTrial(service, {
                    bundleContext: true,
                    priority: 'high'
                });
                trials.push(trial);
            } catch (error) {
                console.error(`Bundle service error (${service.name}):`, error);
            }
        }

        return {
            bundleId: Date.now(),
            bundleType,
            trials,
            successRate: trials.filter(t => t.status === 'active').length / trials.length
        };
    }

    async executeTrialGeneration(service, strategy, paymentMethod, options) {
        const browser = await this.browser.getBrowser();
        const page = await browser.newPage();

        try {
            // Configure browser for entertainment services
            await this.configureEntertainmentBrowser(page, service);

            // Execute automation steps
            const result = await this.executeAutomationSteps(page, service, strategy, paymentMethod);

            // Verify trial activation
            const isActive = await this.verifyTrialActivation(page, service);

            return {
                serviceName: service.name,
                status: isActive ? 'active' : 'failed',
                credentials: result.credentials,
                expiryDate: this.calculateExpiryDate(service.duration),
                paymentMethod: paymentMethod.id
            };
        } finally {
            await page.close();
        }
    }

    async configureEntertainmentBrowser(page, service) {
        // Set custom user agent for streaming services
        await page.setUserAgent(config.browserProfiles[service.name].userAgent);

        // Configure viewport for media playback
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1
        });

        // Bypass common streaming service detections
        await page.evaluateOnNewDocument(() => {
            window.navigator.webdriver = false;
            window.navigator.mediaDevices = true;
            window.navigator.maxTouchPoints = 0;
        });
    }

    async executeAutomationSteps(page, service, strategy, paymentMethod) {
        const steps = strategy.steps || config.services[service.name].automationSteps;
        const credentials = this.generateServiceCredentials(service);

        for (const step of steps) {
            await this.executeStep(page, step, {
                credentials,
                paymentMethod,
                service
            });
        }

        return { credentials };
    }

    async executeStep(page, step, context) {
        const { credentials, paymentMethod, service } = context;

        switch (step.type) {
            case 'input':
                await page.type(step.selector, this.resolveValue(step.value, { credentials, paymentMethod }));
                break;
            case 'click':
                await page.click(step.selector);
                break;
            case 'select':
                await page.select(step.selector, step.value);
                break;
            case 'wait':
                await page.waitForSelector(step.selector, { timeout: 10000 });
                break;
            case 'captcha':
                await this.handleCaptcha(page, service);
                break;
        }

        // Add random delay between steps
        await page.waitForTimeout(Math.random() * 1000 + 500);
    }

    async setupPaymentMethod(service) {
        if (!service.requirements.paymentMethod) return null;

        return await this.virtualCards.generateCard({
            amount: service.price || 1,
            merchant: service.name,
            duration: service.duration
        });
    }

    async verifyTrialActivation(page, service) {
        const successIndicators = config.successIndicators[service.name];
        
        try {
            // Check for success URLs
            const currentUrl = page.url();
            if (successIndicators.urls.some(url => currentUrl.includes(url))) {
                return true;
            }

            // Check for success elements
            for (const selector of successIndicators.elements) {
                const element = await page.$(selector);
                if (element) return true;
            }

            return false;
        } catch (error) {
            console.error('Trial verification error:', error);
            return false;
        }
    }

    generateServiceCredentials(service) {
        return {
            email: this.generateTrialEmail(service.name),
            password: this.generateSecurePassword(),
            username: this.generateUsername()
        };
    }

    generateTrialEmail(serviceName) {
        const username = `trial.${Date.now()}.${Math.random().toString(36).substring(7)}`;
        return `${username}@trialmonkeys.com`;
    }

    generateSecurePassword() {
        return `Trial${Date.now()}!${Math.random().toString(36).substring(7)}`;
    }

    generateUsername() {
        return `TrialUser${Date.now().toString().substring(9)}`;
    }

    resolveValue(template, context) {
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            if (key.startsWith('card_')) {
                return context.paymentMethod[key.replace('card_', '')];
            }
            return context.credentials[key] || match;
        });
    }

    calculateExpiryDate(duration) {
        const date = new Date();
        date.setDate(date.getDate() + duration);
        return date;
    }
}

module.exports = new EntertainmentAutomationService();
