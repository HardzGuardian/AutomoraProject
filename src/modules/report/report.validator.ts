import { z } from 'zod';

export const reportPeriodSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ReportPeriodRequest = z.infer<typeof reportPeriodSchema>;