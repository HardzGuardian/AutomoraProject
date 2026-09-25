import { logger } from '../../../utils/logger';
import {
  NotificationInput,
  NotificationSendResult,
} from '../notification.types';
import { NotificationProvider } from './notification.provider';

export class DevelopmentSmsProvider implements NotificationProvider {
  readonly channel = 'SMS' as const;
  readonly name = 'development-sms';

  constructor(private readonly from?: string) {}

  async send(input: NotificationInput): Promise<NotificationSendResult> {
    logger.info('Development SMS provider skipped delivery', {
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

export const smsProvider = new DevelopmentSmsProvider();
