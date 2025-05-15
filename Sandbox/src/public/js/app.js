// Main application class
class TrialJunkiesApp {
    constructor() {
        this.init();
        this.initializeEventListeners();
    }

    async init() {
        this.state = {
            user: null,
            activeTrials: [],
            availableServices: [],
            currentPanel: 'active-trials'
        };

        // Check if Phantom is installed
        if (this.isPhantomInstalled()) {
            await this.setupPhantomWallet();
        } else {
            this.showError('Phantom wallet is not installed. Please install it to continue.');
        }

        // Check for existing session
        const token = localStorage.getItem('authToken');
        if (token) {
            await this.validateSession(token);
        }
    }

    // Phantom Wallet Integration
    isPhantomInstalled() {
        return window.solana && window.solana.isPhantom;
    }

    async setupPhantomWallet() {
        try {
            const resp = await window.solana.connect();
            this.walletAddress = resp.publicKey.toString();
        } catch (error) {
            console.error('Phantom wallet connection failed:', error);
        }
    }

    // Authentication
    async validateSession(token) {
        try {
            const response = await fetch('/api/auth/status', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.state.user = data.user;
                this.showDashboard();
            } else {
                localStorage.removeItem('authToken');
                this.showLoginSection();
            }
        } catch (error) {
            console.error('Session validation failed:', error);
            this.showLoginSection();
        }
    }

    async authenticateWallet() {
        try {
            // Get nonce from server
            const nonceResponse = await fetch('/api/auth/wallet/init');
            const { nonce } = await nonceResponse.json();

            // Sign message with Phantom
            const encodedMessage = new TextEncoder().encode(nonce);
            const signedMessage = await window.solana.signMessage(encodedMessage, 'utf8');

            // Authenticate with server
            const authResponse = await fetch('/api/auth/wallet/authenticate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    publicKey: this.walletAddress,
                    signature: signedMessage.signature,
                    message: nonce
                })
            });

            const authData = await authResponse.json();
            if (authData.success) {
                localStorage.setItem('authToken', authData.token);
                this.state.user = authData.user;
                this.showDashboard();
            }
        } catch (error) {
            console.error('Authentication failed:', error);
            this.showError('Authentication failed. Please try again.');
        }
    }

    // Trial Management
    async fetchActiveTrials() {
        try {
            const response = await fetch('/api/trials/user-trials', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            this.state.activeTrials = data.trials;
            this.renderActiveTrials();
        } catch (error) {
            console.error('Failed to fetch active trials:', error);
        }
    }

    async fetchAvailableServices() {
        try {
            const response = await fetch('/api/trials/services', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            this.state.availableServices = data.services;
            this.renderAvailableServices();
        } catch (error) {
            console.error('Failed to fetch available services:', error);
        }
    }

    async createTrial(serviceId) {
        try {
            this.showTrialModal();
            this.updateTrialProgress(0);

            const response = await fetch('/api/trials/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ serviceId })
            });

            const data = await response.json();
            if (data.success) {
                this.updateTrialProgress(100);
                this.showSuccess('Trial account created successfully!');
                await this.fetchActiveTrials();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Failed to create trial:', error);
            this.showError('Failed to create trial account. Please try again.');
        } finally {
            setTimeout(() => this.hideTrialModal(), 2000);
        }
    }

    // UI Rendering
    renderActiveTrials() {
        const container = document.getElementById('active-trials-grid');
        container.innerHTML = '';

        this.state.activeTrials.forEach(trial => {
            const card = document.createElement('div');
            card.className = 'card fade-in';
            card.innerHTML = `
                <h3>${trial.serviceName}</h3>
                <p>Expires: ${new Date(trial.expiresAt).toLocaleDateString()}</p>
                <div class="flex justify-between items-center">
                    <span class="status ${trial.status}">${trial.status}</span>
                    <button class="btn-secondary" onclick="app.cancelTrial('${trial._id}')">
                        Cancel Trial
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    renderAvailableServices() {
        const container = document.getElementById('services-grid');
        container.innerHTML = '';

        this.state.availableServices.forEach(service => {
            const card = document.createElement('div');
            card.className = 'card fade-in';
            card.innerHTML = `
                <h3>${service.name}</h3>
                <p>${service.description}</p>
                <div class="flex justify-between items-center">
                    <span>Duration: ${service.trialDuration.value} ${service.trialDuration.unit}</span>
                    <button class="btn-primary" onclick="app.createTrial('${service._id}')">
                        Start Trial
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // Event Listeners
    initializeEventListeners() {
        // Navigation
        document.getElementById('active-trials-btn').addEventListener('click', () => this.showPanel('active-trials'));
        document.getElementById('available-services-btn').addEventListener('click', () => this.showPanel('available-services'));
        document.getElementById('settings-btn').addEventListener('click', () => this.showPanel('settings'));

        // Authentication
        document.getElementById('connect-wallet').addEventListener('click', () => this.authenticateWallet());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());

        // Settings
        document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());

        // Search and filters
        document.getElementById('search-services').addEventListener('input', (e) => this.filterServices(e.target.value));
        document.getElementById('category-filter').addEventListener('change', (e) => this.filterByCategory(e.target.value));
    }

    // UI Helpers
    showPanel(panelId) {
        const panels = ['active-trials', 'available-services', 'settings'];
        panels.forEach(panel => {
            document.getElementById(`${panel}-panel`).classList.toggle('hidden', panel !== panelId);
            document.getElementById(`${panel}-btn`).classList.toggle('active', panel === panelId);
        });

        if (panelId === 'available-services') {
            this.fetchAvailableServices();
        } else if (panelId === 'active-trials') {
            this.fetchActiveTrials();
        }
    }

    showDashboard() {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
        document.getElementById('wallet-address').textContent = `${this.walletAddress.slice(0, 6)}...${this.walletAddress.slice(-4)}`;
        this.fetchActiveTrials();
    }

    showLoginSection() {
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
    }

    showTrialModal() {
        document.getElementById('trial-modal').classList.remove('hidden');
    }

    hideTrialModal() {
        document.getElementById('trial-modal').classList.add('hidden');
    }

    updateTrialProgress(percent) {
        document.getElementById('trial-progress').style.setProperty('--progress', `${percent}%`);
    }

    showError(message) {
        const status = document.getElementById('trial-status');
        status.className = 'status-message error';
        status.textContent = message;
    }

    showSuccess(message) {
        const status = document.getElementById('trial-status');
        status.className = 'status-message success';
        status.textContent = message;
    }

    // Settings Management
    async saveSettings() {
        try {
            const settings = {
                username: document.getElementById('username-input').value,
                email: document.getElementById('email-input').value,
                preferences: {
                    theme: document.getElementById('theme-select').value,
                    notifications: {
                        email: document.getElementById('email-notifications').checked,
                        browser: document.getElementById('browser-notifications').checked
                    }
                }
            };

            const response = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(settings)
            });

            const data = await response.json();
            if (data.success) {
                this.showSuccess('Settings saved successfully!');
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showError('Failed to save settings. Please try again.');
        }
    }

    // Logout
    async logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            localStorage.removeItem('authToken');
            this.state.user = null;
            this.showLoginSection();
        }
    }
}

// Initialize application
const app = new TrialJunkiesApp();
window.app = app; // Make app accessible globally for event handlers
