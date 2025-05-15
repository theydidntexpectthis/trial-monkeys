module.exports = {
    // Test environment configuration
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
    
    // Test file patterns
    testMatch: [
        '**/tests/**/*.e2e.js',
        '**/tests/**/*.integration.js'
    ],
    
    // Coverage configuration
    collectCoverage: true,
    coverageDirectory: 'coverage/e2e',
    coverageReporters: ['text', 'lcov', 'html'],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/tests/**',
        '!src/config/**',
        '!src/public/**'
    ],
    
    // Timeout configuration
    testTimeout: 30000,
    
    // Global test configuration
    globals: {
        E2E_TEST: true
    },
    
    // Module path mapping
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1'
    },
    
    // Test environment variables
    testEnvironmentOptions: {
        NODE_ENV: 'test',
        MONGODB_URI: 'mongodb://localhost:27018/trial-junkies-test',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6380',
        JWT_SECRET: 'test_secret',
        DISCORD_CLIENT_ID: 'test_discord_id',
        SOLANA_NETWORK: 'devnet',
        MONK_TOKEN_ADDRESS: 'test_token_address'
    },
    
    // Reporter configuration
    reporters: [
        'default',
        [
            'jest-html-reporter',
            {
                pageTitle: 'Trial Monkeys E2E Test Report',
                outputPath: './reports/e2e-test-report.html',
                includeFailureMsg: true,
                includeSuiteFailure: true
            }
        ]
    ],
    
    // Verbose output
    verbose: true
};
