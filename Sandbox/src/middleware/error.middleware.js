const config = require('../config/config');

class ErrorMiddleware {
    // Central error handling middleware
    handleError(err, req, res, next) {
        console.error('Error:', err);

        // Default error
        let error = {
            success: false,
            message: 'An unexpected error occurred',
            status: 500
        };

        // Customize error based on type
        if (err.name === 'ValidationError') {
            error = this.handleValidationError(err);
        } else if (err.name === 'MongoError' && err.code === 11000) {
            error = this.handleDuplicateKeyError(err);
        } else if (err.name === 'JsonWebTokenError') {
            error = this.handleJWTError(err);
        } else if (err.name === 'SolanaError') {
            error = this.handleSolanaError(err);
        } else if (err.name === 'AutomationError') {
            error = this.handleAutomationError(err);
        }

        // Add stack trace in development environment
        if (config.server.env === 'development') {
            error.stack = err.stack;
        }

        res.status(error.status).json(error);
    }

    // Handle mongoose validation errors
    handleValidationError(err) {
        const errors = Object.values(err.errors).map(error => error.message);
        return {
            success: false,
            message: 'Validation failed',
            errors,
            status: 400
        };
    }

    // Handle duplicate key errors
    handleDuplicateKeyError(err) {
        const field = Object.keys(err.keyValue)[0];
        return {
            success: false,
            message: `${field} already exists`,
            status: 409
        };
    }

    // Handle JWT errors
    handleJWTError(err) {
        return {
            success: false,
            message: config.errors.auth.invalidToken,
            status: 401
        };
    }

    // Handle Solana-specific errors
    handleSolanaError(err) {
        return {
            success: false,
            message: 'Blockchain operation failed',
            error: err.message,
            status: 400
        };
    }

    // Handle automation errors
    handleAutomationError(err) {
        return {
            success: false,
            message: 'Automation process failed',
            error: err.message,
            status: 500
        };
    }

    // Not found error handler
    handleNotFound(req, res) {
        res.status(404).json({
            success: false,
            message: `Cannot ${req.method} ${req.originalUrl}`
        });
    }

    // Async error wrapper
    asyncErrorHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    // Rate limit error handler
    handleRateLimit(req, res) {
        res.status(429).json({
            success: false,
            message: 'Too many requests, please try again later'
        });
    }

    // Request validation middleware
    validateRequest(schema) {
        return (req, res, next) => {
            const { error } = schema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid request data',
                    errors: error.details.map(detail => detail.message)
                });
            }
            next();
        };
    }

    // Log errors to external service or file
    logError(err, req) {
        // Implementation would depend on your logging service
        const errorLog = {
            timestamp: new Date(),
            error: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
            ip: req.ip,
            user: req.user ? req.user.userId : 'anonymous'
        };

        // Log to console in development
        if (config.server.env === 'development') {
            console.error('Error Log:', errorLog);
        }

        // Here you would typically send to your logging service
        // await LoggingService.log(errorLog);
    }
}

module.exports = new ErrorMiddleware();
