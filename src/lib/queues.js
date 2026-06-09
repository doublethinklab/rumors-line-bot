import Bull from 'bull';

const REDIS = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const groupEventQueue = new Bull('groupEventQueue', { redis: REDIS });
export const expiredGroupEventQueue = new Bull('expiredGroupEventQueue', { redis: REDIS });
export const scrapeQueue = new Bull('scrapeQueue', {
  redis: REDIS,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});
