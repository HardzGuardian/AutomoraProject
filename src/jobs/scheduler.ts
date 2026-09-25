import { logger } from '../utils/logger';

export interface BackgroundJob {
  start(): void;
  stop?(): void;
}

export class Scheduler {
  private started = false;

  constructor(private readonly jobs: BackgroundJob[]) {}

  start(): void {
    if (this.started) {
      logger.warn('Scheduler already started, skipping');
      return;
    }

    for (const job of this.jobs) {
      try {
        job.start();
      } catch (error) {
        logger.error('Failed to start background job', error);
      }
    }
    this.started = true;
  }

  stop(): void {
    for (const job of this.jobs) {
      if (job.stop) job.stop();
    }
    this.started = false;
  }
}