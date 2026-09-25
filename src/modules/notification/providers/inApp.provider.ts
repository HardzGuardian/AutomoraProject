import { logger } from '../../../utils/logger';
import {
  NotificationInput,
  NotificationSendResult,
} from '../notification.types';
import { NotificationProvider } from './notification.provider';

/**
 * In-app notification channel.
 *
 * Person 4 has no separate in-app inbox table. The durable in-app record is the
 * `NotificationLog` row that `NotificationService.log()` persists for every
 * attempt, so reporting SENT here is truthful: nothing is dispatched to an
 * external service, and nothing is claimed to have been.
 *
 * This exists because `notification.validator.ts` already accepts `IN_APP`,
 * which previously had no registered provider and therefore always returned
 * FAILED / HTTP 502.
 */
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
