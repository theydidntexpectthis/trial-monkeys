# Trial Junkies

A streamlined application for managing one-time trial accounts with Phantom wallet integration, powered by OpenUI, Bright Data, and RapidAPI services.

## Features

- **User Authentication**: Secure login through Phantom wallet integration
- **Trial Account Management**: Create and manage trial accounts for various services
- **Web Scraping**: Automated trial account creation using Bright Data
- **Identity Verification**: Email and phone verification through RapidAPI
- **CAPTCHA Solving**: Automated CAPTCHA handling for trial creation
- **Responsive Design**: Modern UI built with OpenUI components
- **Data Persistence**: MongoDB storage for user data and trial information

## Tech Stack

### Frontend
- HTML5 & CSS3
- Vanilla JavaScript
- OpenUI Components
- Phantom Wallet Integration

### Backend
- Node.js & Express
- MongoDB with Mongoose
- JWT Authentication
- Puppeteer for automation
- Bright Data for web scraping
- RapidAPI integrations

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Phantom Wallet browser extension
- Bright Data account
- RapidAPI subscription

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/trial-junkies.git
cd trial-junkies
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update the `.env` file with your credentials:
- MongoDB URI
- Bright Data credentials
- RapidAPI key
- JWT secret
- Other API configurations

5. Start the application:
```bash
npm start
```

## Configuration

### Environment Variables
- See `.env.example` for all required environment variables
- Ensure all API keys and credentials are properly set
- Configure rate limiting and security settings as needed

### API Services Setup

#### Bright Data
1. Sign up for a Bright Data account
2. Get your username and password
3. Configure proxy settings in `.env`

#### RapidAPI
1. Subscribe to required APIs:
   - Email verification
   - Phone verification
   - Identity generation
   - CAPTCHA solving
2. Add your RapidAPI key to `.env`

#### Phantom Wallet
1. Install Phantom wallet browser extension
2. Configure network settings (mainnet/testnet)

## Usage

1. **User Authentication**
   - Click "Connect Wallet" to authenticate with Phantom
   - Approve the connection request in Phantom wallet

2. **Creating Trial Accounts**
   - Browse available services
   - Click "Start Trial" on desired service
   - Wait for automated account creation

3. **Managing Trials**
   - View active trials in dashboard
   - Monitor trial expiration dates
   - Cancel trials as needed

4. **User Settings**
   - Configure notification preferences
   - Update profile information
   - Manage subscription settings

## API Endpoints

### Authentication
- `POST /api/auth/wallet/init` - Initialize wallet connection
- `POST /api/auth/wallet/authenticate` - Authenticate with wallet
- `POST /api/auth/logout` - Logout user

### Trial Management
- `GET /api/trials/services` - Get available services
- `GET /api/trials/user-trials` - Get user's active trials
- `POST /api/trials/create` - Create new trial account
- `PUT /api/trials/cancel/:trialId` - Cancel trial account

### User Management
- `PUT /api/auth/profile` - Update user profile
- `GET /api/auth/status` - Get current session status

## Development

### Project Structure
```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── middleware/      # Custom middleware
├── models/          # Database models
├── routes/          # API routes
├── utils/           # Utility functions
└── public/          # Frontend assets
    ├── css/
    ├── js/
    └── index.html
```

### Running Tests
```bash
npm test
```

### Development Mode
```bash
npm run dev
```

## Security Considerations

- All API keys should be kept secure
- Use environment variables for sensitive data
- Implement rate limiting for API endpoints
- Validate all user input
- Monitor for suspicious activity

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License

MIT License - See LICENSE file for details

## Support

For support, email support@trialjunkies.com or open an issue in the repository.
