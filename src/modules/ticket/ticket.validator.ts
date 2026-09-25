import { z } from 'zod';

export const ticketStatusSchema = z.enum([
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
]);

export const ticketIdParamSchema = z.object({
  id: z.string().uuid('Invalid ticket ID'),
});

export const createTicketSchema = z.object({
  title: z
    .string()
    .min(1, 'Ticket title is required')
    .max(200, 'Ticket title must be less than 200 characters')
    .trim(),
  description: z
    .string()
    .min(1, 'Ticket description is required')
    .max(5000, 'Ticket description must be less than 5000 characters')
    .trim(),
  assignedTechnicianId: z.string().uuid('Invalid assigned technician ID'),
  contractId: z.string().uuid('Invalid contract ID').optional(),
  assetId: z.string().uuid('Invalid asset ID').optional(),
});

export const listTicketsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: ticketStatusSchema.optional(),
  assignedTechnicianId: z.string().uuid('Invalid technician ID').optional(),
  contractId: z.string().uuid('Invalid contract ID').optional(),
});

export const assignTicketSchema = z.object({
  technicianId: z.string().uuid('Invalid technician ID'),
});

export const updateTicketStatusSchema = z.object({
  status: ticketStatusSchema,
});

export const ticketMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Message is required')
    .max(5000, 'Message must be less than 5000 characters')
    .trim(),
});

export const listTicketMessagesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;
export type TicketMessageInput = z.infer<typeof ticketMessageSchema>;
export type ListTicketMessagesQuery = z.infer<
  typeof listTicketMessagesQuerySchema
>;
