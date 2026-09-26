// Must stay field-for-field identical to the SLA module's SlaBreachNotification
// and SlaNotificationGateway so the two are structurally interchangeable.
// Declared here to avoid importing from a module this branch does not contain.
export interface SlaBreachNotification {
  ticketId: string;
  assignedTechnicianId: string;
  resolutionDeadline: Date;
  escalatedAt: Date;
}

export interface SlaBreachNotificationGateway {
  send(notification: SlaBreachNotification): Promise<void>;
}
