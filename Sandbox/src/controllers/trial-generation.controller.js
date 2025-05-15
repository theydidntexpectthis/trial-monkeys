const UserSubscriptionService = require('../services/user-subscription.service');
const AutomationProfilesService = require('../services/automation-profiles.service');
const ProxyManagerService = require('../services/proxy-manager.service');
const EmailVerificationService = require('../services/email-verification.service');
const VirtualPaymentService = require('../services/virtual-payment.service');
const CaptchaAutomationService = require('../services/captcha-automation.service');
const NotificationsService = require('../services/user-notifications.service');
const serviceEndpoints = require('../config/service-endpoints.config');

class TrialGenerationController {
    async generateTrial(req, res) {
        try {
            const { service, options } = req.body;
            const userId = req.user.id;

            // Check subscription and eligibility
            await this.verifyEligibility(userId, service);

            // Initialize resources
            const resources = await this.initializeResources(service);

            // Generate trial
            const trial = await this.executeTrialGeneration(service, resources, options);

            // Update user stats and send notifications
            await this.handleSuccessfulGeneration(userId, trial);

            res.json({
                success: true,
                trial: this.formatTrialResponse(trial)
            });
        } catch (error) {
            console.error('Trial generation error:', error);
            await this.handleGenerationError(req.user.id, error);
            res.status(500).json({ error: error.message });
        }
    }

    async verifyEligibility(userId, service) {
        // Check subscription status and trial limits
        await UserSubscriptionService.checkTrialEligibility(userId, service.name);
        
        // Verify service availability
        const serviceConfig = this.getServiceConfig(service.name);
        if (!serviceConfig) {
            throw new Error('Service not supported');
        }
    }

    async initializeResources(service) {
        try {
            // Initialize all required resources in parallel
            const [
                profile,
                proxy,
                email,
                paymentMethod
            ] = await Promise.all([
                AutomationProfilesService.createProfile(service),
                ProxyManagerService.getProxy(service),
                EmailVerificationService.generateTrialEmail(service),
                VirtualPaymentService.generateVirtualCard({ service })
            ]);

            return {
                profile,
                proxy,
                email,
                paymentMethod
            };
        } catch (error) {
            console.error('Resource initialization error:', error);
            throw new Error('Failed to initialize required resources');
        }
    }

    async executeTrialGeneration(service, resources, options) {
        const serviceConfig = this.getServiceConfig(service.name);
        const browser = await AutomationProfilesService.getBrowserProfile(resources.profile);

        try {
            const page = await browser.context.newPage();
            await page.setExtraHTTPHeaders({
                'User-Agent': resources.profile.userAgent
            });

            // Execute automation steps
            for (const step of serviceConfig.automationSteps) {
                await this.executeStep(page, step, resources);
            }

            // Verify trial activation
            const isActive = await this.verifyTrialActivation(page, serviceConfig);
            if (!isActive) {
                throw new Error('Trial activation verification failed');
            }

            return {
                serviceName: service.name,
                status: 'active',
                credentials: {
                    email: resources.email,
                    password: options.password || this.generatePassword()
                },
                paymentMethod: resources.paymentMethod.id,
                startDate: new Date(),
                expiryDate: this.calculateExpiryDate(serviceConfig.duration || 30)
            };
        } finally {
            await browser.context.close();
        }
    }

    async executeStep(page, step, resources) {
        try {
            switch (step.type) {
                case 'navigate':
                    await page.goto(this.resolveUrl(step.url));
                    break;

                case 'input':
                    await page.type(step.selector, this.resolveValue(step.value, resources));
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
                    await CaptchaAutomationService.solveCaptcha(page, step.type);
                    break;

                case 'fillCard':
                    await this.fillPaymentDetails(page, step.selectors, resources.paymentMethod);
                    break;
            }

            // Add random delay between steps
            await page.waitForTimeout(Math.random() * 1000 + 500);
        } catch (error) {
            console.error(`Step execution error (${step.type}):`, error);
            throw new Error(`Failed to execute ${step.type} step`);
        }
    }

    async fillPaymentDetails(page, selectors, paymentMethod) {
        await page.type(selectors.number, paymentMethod.number);
        await page.type(selectors.expiry, `${paymentMethod.expMonth}/${paymentMethod.expYear}`);
        await page.type(selectors.cvv, paymentMethod.cvv);
    }

    async verifyTrialActivation(page, serviceConfig) {
        const { successPatterns } = serviceConfig;

        // Check URL patterns
        const currentUrl = page.url();
        if (successPatterns.urls.some(pattern => currentUrl.includes(pattern))) {
            return true;
        }

        // Check element patterns
        for (const selector of successPatterns.elements) {
            if (await page.$(selector)) {
                return true;
            }
        }

        // Check text patterns
        const pageText = await page.content();
        return successPatterns.text.some(pattern => pageText.includes(pattern));
    }

    async handleSuccessfulGeneration(userId, trial) {
        await Promise.all([
            UserSubscriptionService.incrementTrialCount(userId),
            UserSubscriptionService.updateTrialStats(userId, {
                success: true,
                savings: this.calculateSavings(trial.serviceName)
            }),
            NotificationsService.sendNotification(userId, 'trial_created', trial)
        ]);
    }

    async handleGenerationError(userId, error) {
        await NotificationsService.sendNotification(userId, 'trial_failed', {
            error: error.message,
            timestamp: new Date()
        });
    }

    getServiceConfig(serviceName) {
        for (const category of Object.values(serviceEndpoints)) {
            if (category[serviceName]) {
                return category[serviceName];
            }
        }
        return null;
    }

    resolveUrl(url) {
        return url.startsWith('http') ? url : `https://${url}`;
    }

    resolveValue(template, resources) {
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            if (key === 'email') return resources.email;
            if (key === 'password') return resources.credentials?.password;
            if (key.startsWith('card_')) {
                return resources.paymentMethod[key.replace('card_', '')];
            }
            return match;
        });
    }

    generatePassword() {
        return `Trial${Date.now()}!${Math.random().toString(36).substring(7)}`;
    }

    calculateExpiryDate(days) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date;
    }

    calculateSavings(serviceName) {
        const serviceConfig = this.getServiceConfig(serviceName);
        return serviceConfig?.price || 0;
    }

    formatTrialResponse(trial) {
        return {
            id: `trial_${Date.now()}`,
            ...trial,
            serviceDetails: this.getServiceConfig(trial.serviceName),
            remainingDays: this.calculateRemainingDays(trial.expiryDate)
        };
    }

    calculateRemainingDays(expiryDate) {
        const expiry = new Date(expiryDate);
        const now = new Date();
        return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    }
}

module.exports = new TrialGenerationController();
