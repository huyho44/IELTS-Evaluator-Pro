import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { NotifierService } from './notifier.service.js';

const POLL_MS = 5 * 60 * 1000;

// Polls for assignments due within 24 hours. Runs wherever the grading worker
// runs (GRADING_WORKER_ENABLED); dedupe keys make concurrent workers safe.
@Injectable()
export class DeadlineWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private readonly logger = new Logger(DeadlineWorker.name);
  constructor(private readonly notifier: NotifierService) {}

  onModuleInit() {
    if (
      process.env.GRADING_WORKER_ENABLED === 'false' ||
      process.env.NODE_ENV === 'test'
    )
      return;
    const poll = () => void this.tick();
    setTimeout(poll, 10_000).unref();
    this.timer = setInterval(poll, POLL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      const sent = await this.notifier.deadlineSoon();
      if (sent) this.logger.log(`Sent ${sent} DEADLINE_SOON notification(s)`);
    } catch (error) {
      this.logger.error(
        `Deadline poll failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.busy = false;
    }
  }
}
