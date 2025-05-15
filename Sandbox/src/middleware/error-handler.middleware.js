const config = require('../config/config');
const NotificationService = require('../services/notification.service');
const MonitorService = require('../services/monitor.service');

class ErrorHandlerMiddleware {
    constructor() {
        this.errorTypes = {
            ValidationError: 400,
            AuthenticationError: 401,
            AuthorizationError: 403,
            NotFoundError: 404,
            RateLimitError: 429,
            DatabaseError: 503,
            ServiceError: 503
        };
    }

    // Main error handler middleware
    handleError = async (err, req, res, next) => {
        try {
            // Log error
            await this.logError(err, req);

            // Get error details
            const errorDetails = this.getErrorDetails(err);

            // Send notification if critical
            if (this.isCriticalError(err)) {
                await this.notifyCriticalError(err, req);
            }

            // Monitor error patterns
            await this.monitorError(err, req);

            // Send response
            res.status(errorDetails.status).json({
                success: false,
                error: {
                    message: errorDetails.message,
                    code: errorDetails.code,
                    ...(config.env === 'development' && { stack: err.stack })
                }
            });
        } catch (handlingError) {
            console.error('Error in error handler:', handlingError);
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    };

    // Handle 404 errors
    handle404 = (req, res, next) => {
        const error = new Error('Resource not found');
        error.name = 'NotFoundError';
        error.code = 'RESOURCE_NOT_FOUND';
        next(error);
    };

    // Handle validation errors
    handleValidation = (err, req, res, next) => {
        if (Array.isArray(err)) {
            const validationErrors = err.map(error => ({
                field: error.param,
                message: error.msg
            }));

            res.status(400).json({
                success: false,
                error: {
                    message: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: validationErrors
                }
            });
        } else {
            next(err);
        }
    };

    // Get error details
    getErrorDetails(err) {
        const errorName = err.name || 'Error';
        const status = this.errorTypes[errorName] || 500;
        
        return {
            status,
            message: err.message || 'An unexpected error occurred',
            code: err.code || this.getErrorCode(errorName)
        };
    }

    // Get error code
    getErrorCode(errorName) {
        return errorName
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            .toUpperCase();
    }

    // Check if error is critical
    isCriticalError(err) {
        return (
            err.name === 'DatabaseError' ||
            err.name === 'ServiceError' ||
            err.critical ||
            err.fatal
        );
    }

    // Log error
    async logError(err, req) {
        const errorLog = {
            timestamp: new Date(),
            error: {
                name: err.name,
                message: err.message,
                stack: err.stack,
                code: err.code
            },
            request: {
                method: req.method,
                url: req.url,
                params: req.params,
                query: req.query,
                body: this.sanitizeRequestBody(req.body),
                headers: this.sanitizeHeaders(req.headers)
            },
            user: req.user ? {
                id: req.user.userId,
                role: req.user.role
            } : null
        };

        // Log to configured logging service
        console.error('Error:', errorLog);

        // Store error log
        await this.storeErrorLog(errorLog);
    }

    // Store error log
    async storeErrorLog(errorLog) {
        try {
            // Implementation would depend on your logging storage solution
            // Example: Store in database or send to logging service
        } catch (error) {
            console.error('Failed to store error log:', error);
        }
    }

    // Notify about critical error
    async notifyCriticalError(err, req) {
        try {
            // Notify system administrators
            await NotificationService.notifyAdmins({
                type: 'critical_error',
                title: 'Critical System Error',
                message: err.message,
                details: {
                    errorName: err.name,
                    endpoint: req.url,
                    timestamp: new Date()
                }
            });

            // Update system status
            await MonitorService.updateSystemStatus({
                component: this.getAffectedComponent(err),
                status: 'error',
                message: 'System experiencing issues'
            });
        } catch (error) {
            console.error('Failed to notify about critical error:', error);
        }
    }

    // Monitor error patterns
    async monitorError(err, req) {
        try {
            await MonitorService.trackError({
                name: err.name,
                code: err.code,
                endpoint: req.url,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Failed to monitor error:', error);
        }
    }

    // Get affected system component
    getAffectedComponent(err) {
        const componentMap = {
            DatabaseError: 'database',
            AuthenticationError: 'auth',
            ServiceError: 'service',
            ValidationError: 'api'
        };

        return componentMap[err.name] || 'system';
    }

    // Sanitize request body
    sanitizeRequestBody(body) {
        if (!body) return null;

        const sanitized = { ...body };
        const sensitiveFields = ['password', 'token', 'secret', 'key'];

        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    // Sanitize headers
    sanitizeHeaders(headers) {
        if (!headers) return null;

        const sanitized = { ...headers };
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

        sensitiveHeaders.forEach(header => {
            if (sanitized[header]) {
                sanitized[header] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    // Custom error classes
    static ValidationError = class ValidationError extends Error {
        constructor(message, details) {
            super(message);
            this.name = 'ValidationError';
            this.details = details;
        }
    };

    static AuthenticationError = class AuthenticationError extends Error {
        constructor(message) {
            super(message);
            this.name = 'AuthenticationError';
        }
    };

    static AuthorizationError = class AuthorizationError extends Error {
        constructor(message) {
            super(message);
            this.name = 'AuthorizationError';
        }
    };

    static NotFoundError = class NotFoundError extends Error {
        constructor(message) {
            super(message);
            this.name = 'NotFoundError';
        }
    };

    static ServiceError = class ServiceError extends Error {
        constructor(message, service) {
            super(message);
            this.name = 'ServiceError';
            this.service = service;
        }
    };
}

module.exports = new ErrorHandlerMiddleware();
