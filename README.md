# trial-monkeys
Modern application for managing one-time trial accounts with Phantom wallet integration.

## Quick Start with Docker

1. Install Docker and Docker Compose on your system
2. Clone this repository
3. Copy `.env.example` to `.env` and configure your environment variables
4. Run the application:

```bash
# Start all services
./docker-manage.sh start

# View logs
./docker-manage.sh logs

# Stop all services
./docker-manage.sh stop
```

## Architecture

The application runs in Docker containers:
- Node.js application server
- MongoDB database with authentication
- Redis for session management and caching

## Development Setup

1. Start services: `./docker-manage.sh start`
2. Access:
   - Web UI: http://localhost:3000
   - API: http://localhost:3000/api
   - Docs: http://localhost:3000/docs

## Features

- One-click trial account creation
- Phantom wallet integration
- Automated trial management
- Browser automation
- Proxy support via Bright Data
- Real-time monitoring
