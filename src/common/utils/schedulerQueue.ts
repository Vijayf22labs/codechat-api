import type { ObjectId } from "mongodb";
import { Plugins, Queue, Scheduler, Worker } from "node-resque";
import { env } from "./envConfig";
import { deliverMessage } from "./scheduler";
import { notifySlack } from "./slack";
const queues = ["messageQueue"];

const Redis = require("ioredis");

let redisClient: any;
try {
  const redisConfig = {
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keepAlive: 30000,
    connectTimeout: 10000,
    commandTimeout: 5000,
    retryDelayOnClusterDown: 300,
  };
  console.log("Creating Redis client with URL:", env.REDIS_URL);  
  
  redisClient = new Redis(env.REDIS_URL, redisConfig);
  
  redisClient.on('error', (error: any) => {
    console.error('Redis connection error:', error);
  });
  
  redisClient.on('ready', () => {
    console.log('Redis connection established');
  });
  
} catch (error) {
  console.error('Failed to create Redis client:', error);
  throw error;
}

const connection = { redis: redisClient };

const jobs = {
  scheduleMessage: {
    plugins: ["QueueLock"],
    perform: async (id: ObjectId, version: any) => {
      try {
        console.log(`Processing scheduled message: ID=${id}, Version=${version}`);
        await deliverMessage(id, version);
        console.log(`Successfully processed message: ID=${id}`);
        return "Success";
      } catch (error) {
        console.error("Error in job perform:", error);
        return "Error";
      }
    },
  },
};
export async function startQueueSceduler() {
  try {
    console.log('Starting queue scheduler...');
    
    await redisClient.ping();
    console.log('Redis ping successful');
    
    const queue = new Queue({ connection }, jobs);
    await queue.connect();
    
    try {
      await queue.cleanOldWorkers(10000);
    } catch (cleanupError) {
      console.warn('Worker cleanup warning:', cleanupError);
    }
    
    const workerName = `worker-${process.env.NODE_ENV || 'dev'}-${Date.now()}`;
    const worker = new Worker({ connection, queues, name: workerName }, jobs);
    
    worker.on('error', (error: any) => {
      console.error('Worker error:', error);
    });
    
    worker.on('success', (queue: any, job: any, result: any) => {
      console.log(`Job completed successfully: ${JSON.stringify(job)}, Result: ${result}`);
    });
    
    worker.on('failure', (queue: any, job: any, failure: any) => {
      console.error(`Job failed: ${job}, Failure: ${failure}`);
    });
    
    await worker.connect();
    worker.start();

    const schedulerName = `scheduler-${process.env.NODE_ENV || 'dev'}-${Date.now()}`;
    const scheduler = new Scheduler({ connection, name: schedulerName });
    
    scheduler.on('error', (error: any) => {
      console.warn('Scheduler warning:', error);
    });
    
    scheduler.on('transferredJob', (timestamp: any, job: any) => {
      console.log(`Scheduler transferred job at ${timestamp}: ${JSON.stringify(job)}`);
    });
    
    await scheduler.connect();
    scheduler.start();
    
    console.log('Queue scheduler initialized successfully');
    
    process.on('SIGTERM', async () => {
      await worker.end();
      await scheduler.end();
      await queue.end();
      await redisClient.quit();
    });
    
    process.on('SIGINT', async () => {
      await worker.end();
      await scheduler.end();
      await queue.end();
      await redisClient.quit();
    });
    
  } catch (error) {
    console.error('Failed to start queue scheduler:', error);
    console.error('Queue scheduler disabled. App will continue without background job processing.');
  }
}

// Add message to queue for scheduled delivery
export async function addMessageToQueue(id: any, version: any, schedule_at: any) {
  try {
    console.log(`Adding message to queue: ID=${id}, Version=${version}, ScheduleAt=${schedule_at}`);
    
    const queue = new Queue({ connection }, jobs);
    await queue.connect();
    await redisClient.ping();
    
    // Ensure schedule_at is a valid Date object
    const scheduleTime = new Date(schedule_at);
    console.log(`Parsed schedule time: ${scheduleTime.toISOString()}`);
    console.log(`Current time: ${new Date().toISOString()}`);
    
    if (scheduleTime <= new Date()) {
      console.warn(`Schedule time is in the past! Scheduling for immediate execution.`);
    }
    
    // Convert to timestamp (milliseconds) for node-resque
    const timestamp = scheduleTime.getTime();
    await queue.enqueueAt(timestamp, "messageQueue", "scheduleMessage", [id, version]);
    console.log(`Message successfully added to queue: ${id}`);
    
    await queue.end();
  } catch (error) {
    console.error("Queue error:", error);
    await notifySlack(`Exception During Scheduling: Message ID ${id} - Error: ${error}`);
  }
}
