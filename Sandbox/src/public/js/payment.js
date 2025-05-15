class PaymentManager {
    constructor() {
        this.initializeEventListeners();
    }

    // Initialize event listeners
    initializeEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-payment-button]')) {
                const serviceId = e.target.dataset.serviceId;
                const amount = e.target.dataset.amount;
                this.initiatePayment(serviceId, amount);
            }
        });

        // Initialize payment modal elements
        this.paymentModal = document.getElementById('payment-modal');
        this.paymentStatus = document.getElementById('payment-status');
        this.paymentAmount = document.getElementById('payment-amount');
        this.confirmPaymentBtn = document.getElementById('confirm-payment');
        this.cancelPaymentBtn = document.getElementById('cancel-payment');

        if (this.confirmPaymentBtn) {
            this.confirmPaymentBtn.addEventListener('click', () => this.confirmPayment());
        }

        if (this.cancelPaymentBtn) {
            this.cancelPaymentBtn.addEventListener('click', () => this.cancelPayment());
        }
    }

    // Show payment modal
    showPaymentModal(amount, serviceName) {
        this.paymentModal.classList.remove('hidden');
        this.paymentAmount.textContent = `${amount} SOL`;
        this.paymentStatus.textContent = `Confirm payment for ${serviceName}`;
    }

    // Hide payment modal
    hidePaymentModal() {
        this.paymentModal.classList.add('hidden');
        this.paymentStatus.textContent = '';
        this.currentTransaction = null;
    }

    // Initiate payment process
    async initiatePayment(serviceId, amount) {
        try {
            // Check if Phantom wallet is connected
            if (!window.solana || !window.solana.isPhantom) {
                throw new Error('Phantom wallet is not installed');
            }

            // Generate payment transaction
            const response = await fetch('/api/payments/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ serviceId })
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message);
            }

            // Store transaction details
            this.currentTransaction = {
                serviceId,
                transaction: data.transaction,
                paymentDetails: data.paymentDetails
            };

            // Show payment confirmation modal
            this.showPaymentModal(data.paymentDetails.amount, data.paymentDetails.service);

        } catch (error) {
            console.error('Payment initiation failed:', error);
            this.showError('Failed to initiate payment: ' + error.message);
        }
    }

    // Confirm and process payment
    async confirmPayment() {
        try {
            if (!this.currentTransaction) {
                throw new Error('No transaction pending');
            }

            this.updatePaymentStatus('Processing payment...');

            // Decode transaction
            const transaction = Transaction.from(
                Buffer.from(this.currentTransaction.transaction, 'base64')
            );

            // Sign transaction with Phantom
            const signed = await window.solana.signTransaction(transaction);
            
            // Send transaction
            const signature = await window.solana.send(signed);

            // Verify payment
            const verifyResponse = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    signature,
                    serviceId: this.currentTransaction.serviceId
                })
            });

            const verifyData = await verifyResponse.json();
            if (!verifyData.success) {
                throw new Error(verifyData.message);
            }

            // Show success and trigger trial creation
            this.updatePaymentStatus('Payment successful! Creating trial account...');
            this.hidePaymentModal();

            // Trigger trial account creation
            if (verifyData.nextStep === 'create_trial') {
                await app.createTrial(this.currentTransaction.serviceId);
            }

        } catch (error) {
            console.error('Payment confirmation failed:', error);
            this.updatePaymentStatus('Payment failed: ' + error.message, 'error');
        }
    }

    // Cancel payment
    cancelPayment() {
        this.hidePaymentModal();
        this.currentTransaction = null;
    }

    // Update payment status
    updatePaymentStatus(message, type = 'info') {
        this.paymentStatus.textContent = message;
        this.paymentStatus.className = `status-message ${type}`;
    }

    // Show error message
    showError(message) {
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-message fade-in';
        errorContainer.textContent = message;
        
        document.body.appendChild(errorContainer);
        
        setTimeout(() => {
            errorContainer.remove();
        }, 5000);
    }

    // Format currency amount
    formatAmount(amount, currency = 'SOL') {
        return `${parseFloat(amount).toFixed(4)} ${currency}`;
    }

    // Get transaction history
    async getTransactionHistory(filters = {}) {
        try {
            const queryParams = new URLSearchParams(filters);
            const response = await fetch(`/api/payments/history?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message);
            }

            return data.transactions;
        } catch (error) {
            console.error('Failed to fetch transaction history:', error);
            throw error;
        }
    }

    // Render transaction history
    async renderTransactionHistory(containerId) {
        try {
            const transactions = await this.getTransactionHistory();
            const container = document.getElementById(containerId);
            
            if (!container) return;

            container.innerHTML = transactions.map(transaction => `
                <div class="transaction-item ${transaction.status}">
                    <div class="transaction-details">
                        <span class="amount">${this.formatAmount(transaction.amount)}</span>
                        <span class="type">${transaction.type}</span>
                        <span class="status">${transaction.status}</span>
                    </div>
                    <div class="transaction-meta">
                        <span class="date">${new Date(transaction.timestamp).toLocaleDateString()}</span>
                        <span class="description">${transaction.description}</span>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Failed to render transaction history:', error);
            this.showError('Failed to load transaction history');
        }
    }

    // Get payment statistics
    async getPaymentStats() {
        try {
            const response = await fetch('/api/payments/stats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message);
            }

            return data.stats;
        } catch (error) {
            console.error('Failed to fetch payment stats:', error);
            throw error;
        }
    }
}

// Export payment manager
window.paymentManager = new PaymentManager();
