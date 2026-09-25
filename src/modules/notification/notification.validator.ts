import { z } from 'zod';

export const sendNotificationSchema = z.object({
  eventKey: z.string().min(1).max(200),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP']),
  recipient: z.string().min(1).max(320),
  subject: z.string().max(300).optional(),
  message: z.string().min(1).max(10000),
  metadata: z.record(z.unknown()).optional(),
  relatedId: z.string().max(200).optional(),
});

export type SendNotificationRequest = z.infer<typeof sendNotificationSchema>;