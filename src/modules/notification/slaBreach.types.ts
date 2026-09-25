/**
 * Person 4 owned mirror of the Person 3 SLA breach notification contract.
 *
 * Person 3's `SlaMonitorJob` (origin/Amar:src/jobs/slaMonitor.job.ts) expects a
 * notification gateway shaped like:
 *
 *   interface SlaBreachNotification {
 *     ticketId: string;
 *     assignedTechnicianId: string;
 *     resolutionDeadline: Date;
 *     escalatedAt: Date;
 *   }
 *
 *   interface SlaNotificationGateway {
 *     send(notification: SlaBreachNotification): Promise<void>;
 *   }
 *
 * These types are declared here, on the Person 4 side, rather than imported
 * from the Person 3 job module. Reasons:
 *
 *  - the Person 3 job file does not exist on the Person 4 branch, so importing
 *    it would break a standalone build and test run;
 *  - Person 3 owns that file, so Person 4 must not depend on its internals.
 *
 * The shapes are field-for-field identical, so TypeScript's structural typing
 * makes the two `SlaBreachNotification` types mutually assignable and the
 * adapter in `src/modules/integrations/sla/slaNotification.adapter.ts`
 * satisfies Person 3's `SlaNotificationGateway` without Person 3 changing
 * anything.
 *
 * NOTE: swapping the adapter into Person 3's job does NOT make SLA monitoring
 * functional. Person 3's `PendingSlaRepository` still throws before any
 * gateway is invoked (origin/Amar:src/modules/sla/sla.service.ts). That gate is
 * Person 1's ticket SLA persistence.
 */
export interface SlaBreachNotification {
  ticketId: string;
  assignedTechnicianId: string;
  resolutionDeadline: Date;
  escalatedAt: Date;
}

export interface SlaBreachNotificationGateway {
  send(notification: SlaBreachNotification): Promise<void>;
}
