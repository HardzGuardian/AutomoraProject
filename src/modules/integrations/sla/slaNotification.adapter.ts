import {
  SlaBreachNotification,
  SlaBreachNotificationGateway,
} from '../../notification/slaBreach.types';
import { NotificationService, notificationService } from '../../notification/notification.service';

/**
 * Notification gateway for the SLA monitor job. Pass `slaNotificationGateway`
 * to `SlaMonitorJob` when the SLA module is merged; SLA alerts will still not
 * fire until ticket SLA persistence is implemented.
 */
export class SlaNotificationAdapter implements SlaBreachNotificationGateway {
  constructor(private readonly notifications: NotificationService) {}

  async send(notification: SlaBreachNotification): Promise<void> {
    await this.notifications.sendSlaBreach(notification);
  }
}

export const slaNotificationGateway: SlaBreachNotificationGateway =
  new SlaNotificationAdapter(notificationService);
