const Twitter = require('twitter-api-v2');
const config = require('../config/services.config');
const TrialService = require('../models/trial-service.model');

class TwitterBotService {
    constructor() {
        this.client = new Twitter({
            appKey: process.env.TWITTER_API_KEY,
            appSecret: process.env.TWITTER_API_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_SECRET,
        });
        
        this.hashtags = ['#FreeTrial', '#ProductivityTools', '#SaaS', '#Tech'];
        this.monitoringInterval = 15 * 60 * 1000; // 15 minutes
    }

    async initialize() {
        await this.startMonitoring();
        await this.scheduleRegularUpdates();
    }

    async startMonitoring() {
        setInterval(async () => {
            try {
                await this.monitorTrialDeals();
            } catch (error) {
                console.error('Twitter monitoring error:', error);
            }
        }, this.monitoringInterval);
    }

    async monitorTrialDeals() {
        const rules = await this.client.v2.streamRules();
        if (!rules.data || !rules.data.length) {
            await this.client.v2.updateStreamRules({
                add: [
                    { value: 'free trial -is:retweet', tag: 'trials' },
                    { value: 'software promotion -is:retweet', tag: 'promotions' },
                    { value: 'saas deal -is:retweet', tag: 'deals' }
                ]
            });
        }

        const stream = await this.client.v2.searchStream({
            'tweet.fields': ['referenced_tweets', 'author_id', 'created_at', 'entities'],
            'expansions': ['author_id', 'referenced_tweets.id'],
            'user.fields': ['username', 'verified']
        });

        stream.on('data', async tweet => {
            await this.processTweet(tweet);
        });
    }

    async processTweet(tweet) {
        if (this.isRelevantTrial(tweet)) {
            const trialInfo = await this.extractTrialInfo(tweet);
            if (trialInfo) {
                await this.saveTrial(trialInfo);
                await this.notifyUsers(trialInfo);
                await this.postUpdate(trialInfo);
            }
        }
    }

    isRelevantTrial(tweet) {
        const keywords = ['free trial', 'promotion', 'discount', 'limited time'];
        const tweetText = tweet.text.toLowerCase();
        return keywords.some(keyword => tweetText.includes(keyword));
    }

    async extractTrialInfo(tweet) {
        const urls = tweet.entities?.urls;
        if (!urls?.length) return null;

        return {
            source: 'twitter',
            tweetId: tweet.id,
            text: tweet.text,
            author: tweet.author_id,
            url: urls[0].expanded_url,
            timestamp: tweet.created_at,
            type: this.determineTrialType(tweet.text)
        };
    }

    async saveTrial(trialInfo) {
        try {
            await TrialService.create({
                serviceName: this.extractServiceName(trialInfo.text),
                serviceUrl: trialInfo.url,
                source: {
                    platform: 'twitter',
                    postId: trialInfo.tweetId,
                    authorId: trialInfo.author
                },
                trialType: trialInfo.type,
                discoveredAt: new Date()
            });
        } catch (error) {
            console.error('Error saving trial:', error);
        }
    }

    async postUpdate(trialInfo) {
        const tweet = this.formatTrialTweet(trialInfo);
        try {
            await this.client.v2.tweet(tweet);
        } catch (error) {
            console.error('Error posting tweet:', error);
        }
    }

    formatTrialTweet(trialInfo) {
        const serviceName = this.extractServiceName(trialInfo.text);
        const hashtags = this.selectRelevantHashtags(trialInfo.type);
        
        return `🐒 New Trial Alert! 🚀\n\n${serviceName} is offering a free trial!\n\nTry it now: ${trialInfo.url}\n\n${hashtags.join(' ')} #TrialMonkeys`;
    }

    async scheduleRegularUpdates() {
        // Schedule daily stats update
        setInterval(async () => {
            const stats = await this.generateDailyStats();
            await this.postDailyUpdate(stats);
        }, 24 * 60 * 60 * 1000);
    }

    async generateDailyStats() {
        const today = new Date();
        const yesterday = new Date(today.setDate(today.getDate() - 1));

        return {
            newTrials: await TrialService.countDocuments({
                discoveredAt: { $gte: yesterday }
            }),
            activeServices: await TrialService.distinct('serviceName', {
                status: 'active'
            }).count(),
            popularCategories: await TrialService.aggregate([
                { $group: { _id: '$category', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 3 }
            ])
        };
    }

    async postDailyUpdate(stats) {
        const tweet = `📊 Daily Trial Stats 📈\n\n` +
            `🆕 ${stats.newTrials} new trials discovered\n` +
            `🎯 ${stats.activeServices} active services\n` +
            `🔥 Top categories:\n` +
            stats.popularCategories.map(cat => `   • ${cat._id}`).join('\n') +
            `\n\n#TrialMonkeys #SaaS #ProductivityTools`;

        try {
            await this.client.v2.tweet(tweet);
        } catch (error) {
            console.error('Error posting daily update:', error);
        }
    }

    determineTrialType(text) {
        const keywords = {
            software: ['software', 'app', 'application', 'platform'],
            streaming: ['streaming', 'video', 'music', 'media'],
            productivity: ['productivity', 'workflow', 'management'],
            education: ['course', 'learning', 'education', 'training']
        };

        const textLower = text.toLowerCase();
        return Object.entries(keywords).find(([_, words]) => 
            words.some(word => textLower.includes(word))
        )?.[0] || 'other';
    }

    extractServiceName(text) {
        // Use regex to find potential service names (capitalized words)
        const matches = text.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g);
        return matches?.[0] || 'Unknown Service';
    }

    selectRelevantHashtags(type) {
        const typeHashtags = {
            software: ['#SaaS', '#Software', '#Tech'],
            streaming: ['#Streaming', '#Entertainment', '#Digital'],
            productivity: ['#Productivity', '#WorkFlow', '#Business'],
            education: ['#Education', '#Learning', '#SkillUp']
        };

        return [...(typeHashtags[type] || []), '#FreeTrial'];
    }

    async notifyUsers(trialInfo) {
        // Implementation for user notifications
        // This could integrate with your notification service
        console.log('New trial discovered:', trialInfo);
    }
}

module.exports = new TwitterBotService();
