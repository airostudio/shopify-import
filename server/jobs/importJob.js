const Queue = require('bull');
const redis = require('redis');

class ImportJob {
  constructor() {
    // Initialize Redis client
    this.redisClient = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    });

    // Create job queue
    this.queue = new Queue('import-jobs', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      }
    });

    this.setupJobProcessors();
  }

  /**
   * Setup job processors
   */
  setupJobProcessors() {
    // Process CSV import jobs
    this.queue.process('csv-import', async (job) => {
      const { filePath, shopifyConfig, clientId } = job.data;

      // Job processing logic would go here
      // This is called by Bull queue worker

      return {
        success: true,
        jobId: job.id
      };
    });

    // Process WooCommerce import jobs
    this.queue.process('woocommerce-import', async (job) => {
      const { wooConfig, shopifyConfig, clientId } = job.data;

      // Job processing logic would go here

      return {
        success: true,
        jobId: job.id
      };
    });

    // Job event listeners
    this.queue.on('completed', (job, result) => {
      console.log(`Job ${job.id} completed:`, result);
    });

    this.queue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err);
    });

    this.queue.on('progress', (job, progress) => {
      console.log(`Job ${job.id} progress: ${progress}%`);
    });
  }

  /**
   * Add CSV import job to queue
   */
  async addCSVImportJob(filePath, shopifyConfig, clientId) {
    const job = await this.queue.add('csv-import', {
      filePath,
      shopifyConfig,
      clientId
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });

    return job;
  }

  /**
   * Add WooCommerce import job to queue
   */
  async addWooCommerceImportJob(wooConfig, shopifyConfig, clientId) {
    const job = await this.queue.add('woocommerce-import', {
      wooConfig,
      shopifyConfig,
      clientId
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });

    return job;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId) {
    const job = await this.queue.getJob(jobId);

    if (!job) {
      return null;
    }

    return {
      id: job.id,
      state: await job.getState(),
      progress: job.progress(),
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason
    };
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId) {
    const job = await this.queue.getJob(jobId);

    if (job) {
      await job.remove();
      return true;
    }

    return false;
  }

  /**
   * Get queue stats
   */
  async getQueueStats() {
    const waiting = await this.queue.getWaitingCount();
    const active = await this.queue.getActiveCount();
    const completed = await this.queue.getCompletedCount();
    const failed = await this.queue.getFailedCount();

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active + completed + failed
    };
  }

  /**
   * Clean old jobs
   */
  async cleanOldJobs(gracePeriod = 24 * 60 * 60 * 1000) {
    // Clean completed jobs older than grace period (default 24 hours)
    await this.queue.clean(gracePeriod, 'completed');
    await this.queue.clean(gracePeriod, 'failed');
  }
}

module.exports = ImportJob;
