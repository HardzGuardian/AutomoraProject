import { logger } from '../../../utils/logger';
import {
  NotificationInput,
  NotificationSendResult,
} from '../notification.types';
import { NotificationProvider } from './notification.provider';

export class DevelopmentEmailProvider implements NotificationProvider {
  readonly channel = 'EMAIL' as const;
  readonly name = 'development-email';

  constructor(private readonly from?: string) {}

  async send(input: NotificationInput): Promise<NotificationSendResult> {
    logger.info('Development email provider skipped delivery', {
      eventKey: input.eventKey,
      recipient: input.recipient,
      from: this.from,
    });

    return {
      status: 'SKIPPED',
      provider: this.name,
    };
  }
}

export const emailProvider = new DevelopmentEmailProvider();
