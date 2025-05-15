// Authentication module for Trial Monkeys
const auth = {
    // Phantom Wallet Integration
    async connectPhantom() {
        try {
            const provider = window?.solana;
            if (!provider?.isPhantom) {
                alert('Phantom wallet is not installed! Please install it from phantom.app');
                return;
            }

            const response = await provider.connect();
            const publicKey = response.publicKey.toString();
            
            // Save wallet info and request backend authentication
            await this.authenticateWallet(publicKey);
            
            return publicKey;
        } catch (error) {
            console.error('Error connecting to Phantom wallet:', error);
            throw error;
        }
    },

    // Discord Integration
    async connectDiscord() {
        const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
        const REDIRECT_URI = `${window.location.origin}/auth/discord/callback`;
        const DISCORD_AUTH_URL = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20email`;
        
        // Open Discord auth in popup
        const width = 500;
        const height = 800;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        window.open(
            DISCORD_AUTH_URL,
            'Discord Login',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        // Listen for auth callback
        window.addEventListener('message', this.handleDiscordCallback.bind(this));
    },

    // Backend Authentication
    async authenticateWallet(publicKey) {
        try {
            const response = await fetch('/api/auth/wallet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ publicKey }),
            });

            if (!response.ok) throw new Error('Wallet authentication failed');

            const data = await response.json();
            localStorage.setItem('authToken', data.token);
            this.initializeUser(data.user);
        } catch (error) {
            console.error('Authentication error:', error);
            throw error;
        }
    },

    async handleDiscordCallback(event) {
        if (event.origin !== window.location.origin) return;
        
        try {
            const { code } = event.data;
            const response = await fetch('/api/auth/discord', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code }),
            });

            if (!response.ok) throw new Error('Discord authentication failed');

            const data = await response.json();
            localStorage.setItem('authToken', data.token);
            this.initializeUser(data.user);
        } catch (error) {
            console.error('Discord auth error:', error);
            throw error;
        }
    },

    // User Management
    initializeUser(user) {
        this.user = user;
        this.updateUI();
        // Emit auth success event
        window.dispatchEvent(new CustomEvent('authSuccess', { detail: user }));
    },

    updateUI() {
        // Update UI elements based on auth state
        const loginSection = document.getElementById('login-section');
        const dashboardSection = document.getElementById('dashboard-section');
        const walletAddress = document.getElementById('wallet-address');

        if (this.user) {
            loginSection.classList.add('hidden');
            dashboardSection.classList.remove('hidden');
            if (walletAddress) {
                walletAddress.textContent = this.user.walletAddress.slice(0, 6) + '...' + this.user.walletAddress.slice(-4);
            }
        } else {
            loginSection.classList.remove('hidden');
            dashboardSection.classList.add('hidden');
        }
    },

    // Event Listeners
    init() {
        const connectWalletBtn = document.getElementById('connect-wallet');
        const connectDiscordBtn = document.getElementById('connect-discord');
        const logoutBtn = document.getElementById('logout-btn');

        connectWalletBtn?.addEventListener('click', () => this.connectPhantom());
        connectDiscordBtn?.addEventListener('click', () => this.connectDiscord());
        logoutBtn?.addEventListener('click', () => this.logout());

        // Check for existing session
        const token = localStorage.getItem('authToken');
        if (token) {
            this.validateSession(token);
        }
    },

    async validateSession(token) {
        try {
            const response = await fetch('/api/auth/validate', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error('Invalid session');

            const data = await response.json();
            this.initializeUser(data.user);
        } catch (error) {
            localStorage.removeItem('authToken');
            this.logout();
        }
    },

    logout() {
        localStorage.removeItem('authToken');
        this.user = null;
        this.updateUI();
        window.location.reload();
    }
};

// Initialize auth module
document.addEventListener('DOMContentLoaded', () => auth.init());
