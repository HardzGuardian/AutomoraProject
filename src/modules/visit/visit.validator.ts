import { z } from 'zod';

export const visitStatusSchema = z.enum([
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
]);

export const visitIdParamSchema = z.object({
  id: z.string().uuid('Invalid visit ID'),
});

export const listVisitsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    status: visitStatusSchema.optional(),
    technicianId: z.string().uuid('Invalid technician ID').optional(),
    contractId: z.string().uuid('Invalid contract ID').optional(),
    assetId: z.string().uuid('Invalid asset ID').optional(),
    from: z
      .string()
      .datetime({ message: 'Invalid from date' })
      .transform((value) => new Date(value))
      .optional(),
    to: z
      .string()
      .datetime({ message: 'Invalid to date' })
      .transform((value) => new Date(value))
      .optional(),
  })
  .refine(
    (query) => !query.from || !query.to || query.from <= query.to,
    {
      message: 'From date must be before or equal to to date',
      path: ['from'],
    }
  );

export const completeVisitSchema = z.object({
  completionNotes: z
    .string()
    .max(2000, 'Completion notes must be less than 2000 characters')
    .trim()
    .optional(),
});

export const rescheduleVisitSchema = z
  .object({
    scheduledStart: z
      .string()
      .datetime({ message: 'Invalid scheduled start date' })
      .transform((value) => new Date(value)),
    scheduledEnd: z
      .string()
      .datetime({ message: 'Invalid scheduled end date' })
      .transform((value) => new Date(value)),
    reason: z
      .string()
      .min(1, 'Reschedule reason is required')
      .max(500, 'Reschedule reason must be less than 500 characters')
      .trim(),
  })
  .refine((data) => data.scheduledEnd > data.scheduledStart, {
    message: 'Scheduled end must be after scheduled start',
    path: ['scheduledEnd'],
  });

export type VisitStatus = z.infer<typeof visitStatusSchema>;
export type ListVisitsQuery = z.infer<typeof listVisitsQuerySchema>;
export type CompleteVisitInput = z.infer<typeof completeVisitSchema>;
export type RescheduleVisitInput = z.infer<typeof rescheduleVisitSchema>;
