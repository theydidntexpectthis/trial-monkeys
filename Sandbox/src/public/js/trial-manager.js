// Trial and Subscription Management for Trial Monkeys
const trialManager = {
    // Configuration
    SUBSCRIPTION_TIERS: {
        SINGLE: { price: 5, trials: 1, duration: 14 },
        POWER: { price: 20, trials: 5, duration: 30 },
        ENTERPRISE: { price: 50, trials: 10, duration: 60 }
    },

    // Trial Generation
    async generateTrial(url) {
        try {
            if (!url) throw new Error('URL is required');
            if (!this.validateUrl(url)) throw new Error('Invalid URL');

            this.showLoadingState();
            
            const response = await fetch('/api/trials/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ serviceUrl: url })
            });

            if (!response.ok) throw new Error('Trial generation failed');

            const trial = await response.json();
            this.displayTrialSuccess(trial);
            return trial;
        } catch (error) {
            this.handleError(error);
            throw error;
        } finally {
            this.hideLoadingState();
        }
    },

    // URL Validation
    validateUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },

    // Subscription Management
    async purchaseSubscription(tier) {
        try {
            const tierConfig = this.SUBSCRIPTION_TIERS[tier.toUpperCase()];
            if (!tierConfig) throw new Error('Invalid subscription tier');

            this.showLoadingState();

            // Initiate payment transaction
            const payment = await this.processPayment(tierConfig.price);
            
            // Update subscription
            const response = await fetch('/api/subscription/upgrade', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    tier,
                    paymentId: payment.id
                })
            });

            if (!response.ok) throw new Error('Subscription upgrade failed');

            const subscription = await response.json();
            this.displaySubscriptionSuccess(subscription);
            return subscription;
        } catch (error) {
            this.handleError(error);
            throw error;
        } finally {
            this.hideLoadingState();
        }
    },

    // Payment Processing
    async processPayment(amount) {
        const provider = window?.solana;
        if (!provider?.isPhantom) {
            throw new Error('Phantom wallet not connected');
        }

        // Process $MONK token payment
        // Implementation depends on your specific token setup
        return { id: 'payment_id', status: 'success' };
    },

    // UI Management
    showLoadingState() {
        const button = document.querySelector('#generate-trial');
        if (button) {
            button.disabled = true;
            button.innerHTML = 'Generating... 🔄';
        }
    },

    hideLoadingState() {
        const button = document.querySelector('#generate-trial');
        if (button) {
            button.disabled = false;
            button.innerHTML = 'Generate Trial 🚀';
        }
    },

    displayTrialSuccess(trial) {
        // Add trial to active trials grid
        const grid = document.querySelector('#active-trials-grid');
        if (!grid) return;

        const trialElement = document.createElement('div');
        trialElement.className = 'card trial-card';
        trialElement.innerHTML = `
            <div class="header">
                <h3 class="title">${trial.serviceName}</h3>
                <span class="duration">${trial.daysRemaining} days left</span>
            </div>
            <p class="description">${trial.serviceUrl}</p>
            <div class="trial-actions">
                <button onclick="window.open('${trial.loginUrl}')" class="btn-primary">Access Trial</button>
                <button onclick="trialManager.extendTrial('${trial.id}')" class="btn-secondary">Extend</button>
            </div>
        `;

        grid.prepend(trialElement);
    },

    displaySubscriptionSuccess(subscription) {
        // Update UI to reflect new subscription
        const oldTier = document.querySelector('.subscription-badge');
        if (oldTier) {
            oldTier.textContent = subscription.tier;
            oldTier.className = `subscription-badge ${subscription.tier.toLowerCase()}`;
        }

        // Show success message
        this.showNotification('Subscription upgraded successfully! 🎉');
    },

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    },

    handleError(error) {
        console.error('Trial Manager Error:', error);
        this.showNotification(error.message, 'error');
    },

    // Event Handlers
    async handleUrlSubmit(event) {
        event.preventDefault();
        const urlInput = document.querySelector('#service-url');
        if (!urlInput?.value) return;

        try {
            await this.generateTrial(urlInput.value);
            urlInput.value = '';
        } catch (error) {
            // Error already handled in generateTrial
        }
    },

    // Initialization
    init() {
        // Set up event listeners
        const generateButton = document.querySelector('#generate-trial');
        const subscriptionButtons = document.querySelectorAll('.trial-card button');

        generateButton?.addEventListener('click', (e) => this.handleUrlSubmit(e));
        
        subscriptionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tier = e.target.closest('.trial-card').querySelector('h3').textContent;
                this.purchaseSubscription(tier);
            });
        });

        // Initialize tooltips
        this.initializeTooltips();
    },

    initializeTooltips() {
        const tooltips = document.querySelectorAll('[data-tooltip]');
        tooltips.forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                const tooltip = document.createElement('div');
                tooltip.className = 'tooltip';
                tooltip.textContent = e.target.dataset.tooltip;
                document.body.appendChild(tooltip);

                const rect = e.target.getBoundingClientRect();
                tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
                tooltip.style.left = `${rect.left + (rect.width/2) - (tooltip.offsetWidth/2)}px`;
            });

            element.addEventListener('mouseleave', () => {
                document.querySelector('.tooltip')?.remove();
            });
        });
    }
};

// Initialize trial manager
document.addEventListener('DOMContentLoaded', () => trialManager.init());
