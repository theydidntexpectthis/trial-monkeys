// Bundle Generator UI Controller
class BundleGenerator {
    constructor() {
        this.modal = document.getElementById('generationModal');
        this.progressBar = document.querySelector('.progress-bar .progress');
        this.statusMessage = document.querySelector('.status-message');
        this.serviceStatus = document.querySelector('.service-status');
        this.steps = document.querySelectorAll('.step');
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Bundle generation buttons
        document.querySelectorAll('.generate-bundle-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const bundleType = e.target.closest('.bundle-section').classList.contains('gaming-bundle')
                    ? 'gaming'
                    : 'entertainment';
                this.startBundleGeneration(bundleType);
            });
        });

        // Service card hover animations
        document.querySelectorAll('.service-card').forEach(card => {
            card.addEventListener('mouseenter', () => this.animateServiceCard(card));
            card.addEventListener('mouseleave', () => this.resetServiceCard(card));
        });

        // Success rate hover effects
        document.querySelectorAll('.success-rate').forEach(rate => {
            rate.addEventListener('mouseenter', () => this.showSuccessDetails(rate));
        });
    }

    async startBundleGeneration(bundleType) {
        try {
            this.showModal();
            await this.simulateLoading();

            // Step 1: Prepare Resources
            await this.updateProgress(1, 'Preparing necessary resources...');
            await this.prepareResources(bundleType);

            // Step 2: Generate Trials
            await this.updateProgress(2, 'Generating trials...');
            const trials = await this.generateTrials(bundleType);

            // Step 3: Setup Protection
            await this.updateProgress(3, 'Setting up protection measures...');
            await this.setupProtection(trials);

            // Complete
            await this.completeGeneration(trials);

        } catch (error) {
            this.handleError(error);
        }
    }

    async prepareResources(bundleType) {
        const services = this.getServicesForBundle(bundleType);
        
        for (const service of services) {
            await this.updateServiceStatus(service, 'preparing');
            await this.simulateLoading(1000);
            await this.updateServiceStatus(service, 'ready');
        }
    }

    async generateTrials(bundleType) {
        const services = this.getServicesForBundle(bundleType);
        const trials = [];

        for (const service of services) {
            await this.updateServiceStatus(service, 'generating');
            
            try {
                const trial = await this.generateTrial(service);
                trials.push(trial);
                await this.updateServiceStatus(service, 'success');
            } catch (error) {
                await this.updateServiceStatus(service, 'error', error.message);
                throw error;
            }
        }

        return trials;
    }

    async generateTrial(service) {
        // API call to generate trial
        const response = await fetch('/api/trials/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ service: service.name })
        });

        if (!response.ok) {
            throw new Error(`Failed to generate trial for ${service.name}`);
        }

        return response.json();
    }

    async setupProtection(trials) {
        for (const trial of trials) {
            await this.updateServiceStatus(trial.service, 'protecting');
            await this.simulateLoading(800);
            await this.updateServiceStatus(trial.service, 'protected');
        }
    }

    async completeGeneration(trials) {
        this.progressBar.style.width = '100%';
        this.statusMessage.textContent = 'Bundle generation complete! 🎉';
        
        // Create success message
        const message = this.createSuccessMessage(trials);
        this.serviceStatus.innerHTML = message;

        // Add completion class for animations
        this.modal.classList.add('complete');

        // Auto-close after delay
        setTimeout(() => {
            this.hideModal();
            this.redirectToDashboard(trials);
        }, 5000);
    }

    createSuccessMessage(trials) {
        return trials.map(trial => `
            <div class="success-item">
                <img src="https://img.logo.dev/${trial.service.toLowerCase()}.com" 
                     alt="${trial.service}" 
                     class="service-logo">
                <div class="trial-details">
                    <h4>${trial.service}</h4>
                    <p>Active until: ${new Date(trial.expiryDate).toLocaleDateString()}</p>
                    <div class="credentials">
                        <code>Email: ${trial.credentials.email}</code>
                        <code>Password: ${trial.credentials.password}</code>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // UI Update Methods
    async updateProgress(step, message) {
        // Update steps
        this.steps.forEach((s, index) => {
            if (index < step) s.classList.add('complete');
            else if (index === step - 1) s.classList.add('active');
            else s.classList.remove('active', 'complete');
        });

        // Update progress bar
        this.progressBar.style.width = `${(step / 3) * 100}%`;
        this.statusMessage.textContent = message;

        // Add animation
        this.statusMessage.classList.add('pulse');
        await this.simulateLoading(500);
        this.statusMessage.classList.remove('pulse');
    }

    async updateServiceStatus(service, status, message = '') {
        const statusElement = document.createElement('div');
        statusElement.className = `service-status-item ${status}`;
        statusElement.innerHTML = `
            <img src="https://img.logo.dev/${service.toLowerCase()}.com" 
                 alt="${service}" 
                 class="service-logo">
            <span class="status-text">
                ${this.getStatusMessage(status, service)}
                ${message ? `<small>${message}</small>` : ''}
            </span>
            ${this.getStatusIcon(status)}
        `;

        // Replace existing status or append
        const existing = this.serviceStatus.querySelector(`[data-service="${service}"]`);
        if (existing) existing.replaceWith(statusElement);
        else this.serviceStatus.appendChild(statusElement);

        // Animate entry
        statusElement.style.opacity = '0';
        await this.simulateLoading(100);
        statusElement.style.opacity = '1';
    }

    getStatusMessage(status, service) {
        const messages = {
            preparing: `Preparing ${service} trial...`,
            ready: `${service} ready for generation`,
            generating: `Generating ${service} trial...`,
            success: `${service} trial generated successfully!`,
            error: `Failed to generate ${service} trial`,
            protecting: `Setting up protection for ${service}...`,
            protected: `${service} protection active`
        };
        return messages[status] || status;
    }

    getStatusIcon(status) {
        const icons = {
            preparing: '⚙️',
            ready: '✅',
            generating: '🔄',
            success: '🎉',
            error: '❌',
            protecting: '🛡️',
            protected: '✨'
        };
        return `<span class="status-icon">${icons[status] || '❓'}</span>`;
    }

    // UI Animation Methods
    animateServiceCard(card) {
        card.style.transform = 'translateY(-5px)';
        card.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
    }

    resetServiceCard(card) {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    }

    showSuccessDetails(rate) {
        const percent = rate.querySelector('.progress').style.width;
        rate.setAttribute('data-tooltip', `Success rate: ${percent}`);
    }

    // Modal Methods
    showModal() {
        this.modal.style.display = 'flex';
        this.modal.style.opacity = '0';
        setTimeout(() => this.modal.style.opacity = '1', 10);
    }

    hideModal() {
        this.modal.style.opacity = '0';
        setTimeout(() => this.modal.style.display = 'none', 300);
    }

    // Helper Methods
    getServicesForBundle(bundleType) {
        return bundleType === 'gaming' 
            ? ['Xbox Game Pass', 'PlayStation Now']
            : ['Netflix', 'Disney+', 'Spotify'];
    }

    simulateLoading(duration = 1000) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    redirectToDashboard(trials) {
        window.location.href = `/dashboard?trials=${trials.map(t => t.id).join(',')}`;
    }

    handleError(error) {
        this.statusMessage.textContent = `Error: ${error.message}`;
        this.statusMessage.classList.add('error');
        this.modal.classList.add('error');

        setTimeout(() => {
            this.hideModal();
            this.modal.classList.remove('error');
            this.statusMessage.classList.remove('error');
        }, 3000);
    }
}

// Initialize Bundle Generator
document.addEventListener('DOMContentLoaded', () => {
    window.bundleGenerator = new BundleGenerator();
});
