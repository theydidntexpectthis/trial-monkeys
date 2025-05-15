# Troubleshooting Guide for Trial Bot Explorer

## Common Issues and Solutions

### Authentication Issues

#### Phantom Wallet Connection Failed
**Symptoms:**
- "Phantom wallet not found" error
- Connection dialog doesn't appear
- Connection times out

**Solutions:**
1. Ensure Phantom wallet extension is installed and up to date
2. Check if you're on a supported browser (Chrome, Firefox, Brave)
3. Verify you're on the correct network (Mainnet/Testnet)
4. Clear browser cache and reload

```javascript
// Debug Phantom connection
const debugPhantomConnection = async () => {
    if (!window.solana) {
        console.error('Phantom not installed');
        return;
    }
    
    try {
        const response = await window.solana.connect();
        console.log('Connection successful:', response);
    } catch (error) {
        console.error('Connection error:', error);
    }
};
```

### Bot Creation Issues

#### Bot Creation Fails
**Symptoms:**
- Error during bot creation
- Bot status remains "initializing"
- Configuration validation errors

**Solutions:**
1. Verify all required fields are provided
2. Check subscription limits
3. Ensure valid service configuration
4. Verify proxy settings if enabled

```javascript
// Verify bot configuration
const verifyBotConfig = (config) => {
    const requiredFields = ['name', 'serviceType', 'config'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
        console.error('Missing required fields:', missingFields);
        return false;
    }
    return true;
};
```

### Trial Creation Issues

#### Trial Creation Timeout
**Symptoms:**
- Trial creation process hangs
- Timeout errors
- Proxy connection issues

**Solutions:**
1. Check proxy health status
2. Verify service availability
3. Review rate limiting settings
4. Check network connectivity

```javascript
// Check proxy health
const checkProxyHealth = async (proxyConfig) => {
    try {
        const response = await fetch('https://api.ipify.org?format=json', {
            proxy: proxyConfig
        });
        return response.ok;
    } catch (error) {
        console.error('Proxy health check failed:', error);
        return false;
    }
};
```

#### CAPTCHA Resolution Fails
**Symptoms:**
- CAPTCHA solving timeouts
- Invalid CAPTCHA solutions
- Service unavailable errors

**Solutions:**
1. Verify CAPTCHA service API key
2. Check service balance
3. Try alternative CAPTCHA service
4. Verify correct CAPTCHA type detection

### Monitoring Issues

#### Real-time Updates Not Working
**Symptoms:**
- Dashboard not updating
- WebSocket disconnections
- Stale data

**Solutions:**
1. Check WebSocket connection
2. Verify authentication token
3. Clear browser cache
4. Check network connectivity

```javascript
// Debug WebSocket connection
const debugWebSocket = () => {
    const ws = window.wsHandler;
    
    console.log('WebSocket state:', {
        readyState: ws.ws.readyState,
        reconnectAttempts: ws.reconnectAttempts,
        lastPong: ws.lastPong
    });
};
```

### Performance Issues

#### Slow Response Times
**Symptoms:**
- Dashboard loading slowly
- API requests timing out
- High resource usage

**Solutions:**
1. Check database indexes
2. Verify Redis connection
3. Monitor system resources
4. Review caching implementation

```javascript
// Check system health
const checkSystemHealth = async () => {
    const metrics = await fetch('/api/system/health');
    const data = await metrics.json();
    
    console.log('System health:', {
        cpu: data.cpu,
        memory: data.memory,
        disk: data.disk,
        redis: data.redis
    });
};
```

### Database Issues

#### Connection Errors
**Symptoms:**
- Database timeout errors
- Connection pool exhausted
- Query performance issues

**Solutions:**
1. Check database connection string
2. Verify database credentials
3. Monitor connection pool
4. Review query optimization

```javascript
// Monitor database connections
const monitorDbConnections = async () => {
    const metrics = await mongoose.connection.db.admin().serverStatus();
    console.log('Database connections:', {
        current: metrics.connections.current,
        available: metrics.connections.available,
        active: metrics.connections.active
    });
};
```

### Redis Issues

#### Cache Misses
**Symptoms:**
- High cache miss rate
- Increased database load
- Inconsistent data

**Solutions:**
1. Verify Redis connection
2. Check cache invalidation logic
3. Monitor cache hit rate
4. Review cache TTL settings

```javascript
// Monitor cache performance
const monitorCache = async () => {
    const metrics = await redis.info();
    console.log('Cache metrics:', {
        hitRate: metrics.keyspace_hits / (metrics.keyspace_hits + metrics.keyspace_misses),
        usedMemory: metrics.used_memory_human,
        connectedClients: metrics.connected_clients
    });
};
```

## Diagnostics

### System Health Check
Run the following diagnostic commands to check system health:

```bash
# Check service status
npm run diagnose

# Verify database connection
npm run check-db

# Test proxy connectivity
npm run test-proxy

# Validate Redis connection
npm run check-redis
```

### Log Analysis
Important log locations:
- Application logs: `/var/log/trial-bot/app.log`
- Error logs: `/var/log/trial-bot/error.log`
- Access logs: `/var/log/trial-bot/access.log`
- Bot logs: `/var/log/trial-bot/bots/`

### Monitoring Tools
Available monitoring endpoints:
- `/api/health`: System health status
- `/api/metrics`: Performance metrics
- `/api/status`: Service status
- `/api/debug`: Debug information (development only)

## Common Error Codes

### API Error Codes
- `AUTH001`: Authentication failed
- `AUTH002`: Invalid token
- `BOT001`: Bot creation failed
- `BOT002`: Invalid bot configuration
- `TRIAL001`: Trial creation failed
- `TRIAL002`: Service unavailable
- `PROXY001`: Proxy connection failed
- `CAPTCHA001`: CAPTCHA resolution failed

### HTTP Status Codes
- `400`: Bad Request - Invalid input
- `401`: Unauthorized - Authentication required
- `403`: Forbidden - Insufficient permissions
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - System error
- `503`: Service Unavailable - Maintenance mode

## Support Channels

### Getting Help
1. Check this troubleshooting guide
2. Review system documentation
3. Check GitHub issues
4. Contact support team

### Reporting Issues
When reporting issues, include:
1. Error message and code
2. Steps to reproduce
3. System configuration
4. Relevant logs
5. Screenshots if applicable

## Best Practices

### Preventive Measures
1. Regular system updates
2. Monitor resource usage
3. Implement proper error handling
4. Regular backup procedures
5. Performance optimization

### Maintenance
1. Regular log rotation
2. Database optimization
3. Cache management
4. Security updates
5. Configuration reviews

## Updates and Patches
Keep your system up to date:
```bash
# Update dependencies
npm update

# Apply security patches
npm audit fix

# Update system configuration
npm run update-config
```

## Additional Resources
- [API Documentation](/docs/API.md)
- [Integration Guide](/docs/INTEGRATION.md)
- [Security Guidelines](/docs/SECURITY.md)
- [GitHub Issues](https://github.com/your-repo/issues)
