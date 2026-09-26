import { logger } from '../../../utils/logger';
import {
  NotificationInput,
  NotificationSendResult,
} from '../notification.types';
import { NotificationProvider } from './notification.provider';

// There is no separate inbox table: the NotificationLog row written for every
// attempt is the in-app notification, so SENT is accurate here.
export class InAppNotificationProvider implements NotificationProvider {
  readonly channel = 'IN_APP' as const;
  readonly name = 'in-app-log';

  async send(input: NotificationInput): Promise<NotificationSendResult> {
    logger.info('In-app notification recorded', {
      eventKey: input.eventKey,
      recipient: input.recipient,
    });

    return {
      status: 'SENT',
      provider: this.name,
    };
  }
}

export const inAppProvider = new InAppNotificationProvider();
