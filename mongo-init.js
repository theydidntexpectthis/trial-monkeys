db = db.getSiblingDB('trial-junkies');

// Create indexes
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "username": 1 }, { unique: true });
db.trialservices.createIndex({ "name": 1 }, { unique: true });
db.trialservices.createIndex({ "category": 1 });
db.bots.createIndex({ "name": 1 }, { unique: true });
db.botmanagements.createIndex({ "userId": 1 });
db.botmanagements.createIndex({ "botId": 1 });

// Create default categories if they don't exist
db.categories.insertMany([
    { name: 'streaming', description: 'Streaming services trials' },
    { name: 'software', description: 'Software application trials' },
    { name: 'gaming', description: 'Gaming service trials' },
    { name: 'education', description: 'Educational platform trials' },
    { name: 'other', description: 'Other types of trials' }
], { ordered: false });

// Create default roles
db.roles.insertMany([
    { name: 'user', description: 'Standard user role' },
    { name: 'admin', description: 'Administrative role' },
    { name: 'premium', description: 'Premium user role' }
], { ordered: false });
