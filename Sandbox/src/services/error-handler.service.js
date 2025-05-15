const LoggingService = require('./logging.service');
const WebSocketService = require('./websocket.service');

class ErrorHandlerService {
    constructor() {
        this.logger = LoggingService;
        this.websocket = WebSocketService;

        // Standard error types
        this.errorTypes = {
            VALIDATION: 'ValidationError',
            AUTHENTICATION: 'AuthenticationError',
            AUTHORIZATION: 'AuthorizationError',
            SUBSCRIPTION: 'SubscriptionError',
            PAYMENT: 'PaymentError',
            TRIAL: 'TrialError',
            REFERRAL: 'ReferralError',
            API: 'APIError',
            DATABASE: 'DatabaseError',
            SYSTEM: 'SystemError'
        };

        // HTTP status code mappings
        this.statusCodes = {
            ValidationError: 400,
            AuthenticationError: 401,
            AuthorizationError: 403,
            SubscriptionError: 402,
            PaymentError: 402,
            TrialError: 400,
            ReferralError: 400,
            APIError: 500,
            DatabaseError: 500,
            SystemError: 500,
            NotFoundError: 404
        };
    }

    async handleError(error, req = null, res = null) {
        try {
            // Normalize error
            const normalizedError = this.normalizeError(error);

            // Log error
            await this.logError(normalizedError, req);

            // Track error metrics
            await this.trackErrorMetrics(normalizedError);

            // Notify admins if critical
            if (this.isCriticalError(normalizedError)) {
                await this.notifyAdmins(normalizedError);
            }

            // Send response if HTTP request
            if (res) {
                this.sendErrorResponse(res, normalizedError);
            }

            return normalizedError;
        } catch (handlingError) {
            console.error('Error handler failure:', handlingError);
            // Fallback error response
            if (res) {
                res.status(500).json({
                    error: 'Internal Server Error',
                    message: 'An unexpected error occurred'
                });
            }
        }
    }

    normalizeError(error) {
        // Convert to standard error format
        const normalized = {
            type: this.getErrorType(error),
            message: error.message || 'An unknown error occurred',
            code: error.code || 'UNKNOWN_ERROR',
            status: this.getStatusCode(error),
            timestamp: new Date(),
            stack: error.stack,
            data: error.data || {},
            source: error.source || 'server'
        };

        // Add request context if available
        if (error.context) {
            normalized.context = error.context;
        }

        return normalized;
    }

    getErrorType(error) {
        if (error.type && this.errorTypes[error.type]) {
            return error.type;
        }

        // Determine error type based on error properties
        if (error.name === 'ValidationError') return this.errorTypes.VALIDATION;
        if (error.name === 'JsonWebTokenError') return this.errorTypes.AUTHENTICATION;
        if (error.code === 'ECONNREFUSED') return this.errorTypes.API;
        
        return this.errorTypes.SYSTEM;
    }

    getStatusCode(error) {
        // Get status code based on error type
        return this.statusCodes[error.type] || 
               this.statusCodes[error.name] || 
               error.status || 
               500;
    }

    async logError(error, req) {
        const logContext = {
            error: {
                type: error.type,
                code: error.code,
                stack: error.stack
            },
            request: req ? {
                method: req.method,
                path: req.path,
                params: req.params,
                query: req.query,
                body: this.sanitizeRequestBody(req.body),
                userId: req.user?.id,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            } : null
        };

        await this.logger.logError(error, logContext);
    }

    async trackErrorMetrics(error) {
        const period = this.getCurrentPeriod();
        const multi = this.logger.redis.multi();

        // Track error type
        multi.hincrby(`errors:types:${period}`, error.type, 1);

        // Track error code
        multi.hincrby(`errors:codes:${period}`, error.code, 1);

        // Track error source
        multi.hincrby(`errors:sources:${period}`, error.source, 1);

        await multi.exec();
    }

    async notifyAdmins(error) {
        const notification = {
            type: 'error_alert',
            severity: this.getErrorSeverity(error),
            error: {
                type: error.type,
                message: error.message,
                code: error.code,
                timestamp: error.timestamp
            }
        };

        await this.websocket.broadcastToAdmins(notification);
    }

    sendErrorResponse(res, error) {
        const response = {
            error: error.type,
            message: error.message,
            code: error.code,
            timestamp: error.timestamp
        };

        // Add additional data for non-production environments
        if (process.env.NODE_ENV !== 'production') {
            response.stack = error.stack;
            response.data = error.data;
        }

        res.status(error.status).json(response);
    }

    isCriticalError(error) {
        // Define critical error conditions
        const criticalTypes = [
            this.errorTypes.SYSTEM,
            this.errorTypes.DATABASE,
            this.errorTypes.API
        ];

        return criticalTypes.includes(error.type) || 
               error.status >= 500 ||
               error.code?.startsWith('CRITICAL_');
    }

    getErrorSeverity(error) {
        if (this.isCriticalError(error)) return 'critical';
        if (error.status >= 500) return 'high';
        if (error.status >= 400) return 'medium';
        return 'low';
    }

    sanitizeRequestBody(body) {
        if (!body) return null;

        // Create a copy to avoid modifying original
        const sanitized = { ...body };

        // Remove sensitive fields
        const sensitiveFields = ['password', 'token', 'secret', 'card'];
        sensitiveFields.forEach(field => {
            if (sanitized[field]) sanitized[field] = '[REDACTED]';
        });

        return sanitized;
    }

    getCurrentPeriod() {
        return Math.floor(Date.now() / (60 * 60 * 1000)); // 1-hour periods
    }

    // Custom error creators
    createValidationError(message, data = {}) {
        return {
            type: this.errorTypes.VALIDATION,
            message,
            code: 'VALIDATION_ERROR',
            data
        };
    }

    createAuthenticationError(message = 'Authentication required') {
        return {
            type: this.errorTypes.AUTHENTICATION,
            message,
            code: 'AUTHENTICATION_ERROR'
        };
    }

    createAuthorizationError(message = 'Insufficient permissions') {
        return {
            type: this.errorTypes.AUTHORIZATION,
            message,
            code: 'AUTHORIZATION_ERROR'
        };
    }

    createSubscriptionError(message, code = 'SUBSCRIPTION_ERROR') {
        return {
            type: this.errorTypes.SUBSCRIPTION,
            message,
            code
        };
    }

    createPaymentError(message, code = 'PAYMENT_ERROR') {
        return {
            type: this.errorTypes.PAYMENT,
            message,
            code
        };
    }

    createTrialError(message, code = 'TRIAL_ERROR') {
        return {
            type: this.errorTypes.TRIAL,
            message,
            code
        };
    }

    createAPIError(message, code = 'API_ERROR') {
        return {
            type: this.errorTypes.API,
            message,
            code
        };
    }
}

module.exports = new ErrorHandlerService();
