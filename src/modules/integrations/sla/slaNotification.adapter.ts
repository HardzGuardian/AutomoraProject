import {
  SlaBreachNotification,
  SlaBreachNotificationGateway,
} from '../../notification/slaBreach.types';
import { NotificationService, notificationService } from '../../notification/notification.service';

/**
 * Person 4 implementation of Person 3's `SlaNotificationGateway`.
 *
 * Person 3's `SlaMonitorJob` is constructed with a throwing
 * `PendingSlaNotificationGateway` (origin/Amar:src/jobs/slaMonitor.job.ts).
 * Adopting this adapter is a one-line change on the Person 3 side:
 *
 *   import { slaNotificationGateway } from '../modules/integrations/sla/slaNotification.adapter';
 *   export const slaMonitorJob = new SlaMonitorJob(slaService, slaNotificationGateway);
 *
 * Person 4 does not make that edit — `slaMonitor.job.ts` is a Person 3 file.
 *
 * IMPORTANT: this adapter alone does not make SLA monitoring work. Person 3's
 * `PendingSlaRepository.findBreachCandidates()` still throws before any
 * gateway call is made. That gate belongs to Person 1 (ticket SLA persistence)
 * and must not be worked around from the Person 4 side.
 */
export class SlaNotificationAdapter implements SlaBreachNotificationGateway {
  constructor(private readonly notifications: NotificationService) {}

  async send(notification: SlaBreachNotification): Promise<void> {
    await this.notifications.sendSlaBreach(notification);
  }
}

export const slaNotificationGateway: SlaBreachNotificationGateway =
  new SlaNotificationAdapter(notificationService);
