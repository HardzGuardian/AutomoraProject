import { Router } from 'express';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { ticketController } from './ticket.controller';
import {
  assignTicketSchema,
  createTicketSchema,
  listTicketMessagesQuerySchema,
  listTicketsQuerySchema,
  ticketIdParamSchema,
  ticketMessageSchema,
  updateTicketStatusSchema,
} from './ticket.validator';

const router = Router();

/**
 * Person 3 route integration shell.
 * This router is intentionally not registered in src/app.ts until the
 * Person 1 Ticket/TicketMessage models and production adapters are available.
 */

/** POST /tickets */
router.post(
  '/',
  auth,
  role(['ADMIN', 'MANAGER']),
  validate(createTicketSchema),
  asyncHandler(ticketController.create)
);

/** GET /tickets */
router.get(
  '/',
  auth,
  role(['ADMIN', 'MANAGER', 'TECHNICIAN']),
  validate(listTicketsQuerySchema, 'query'),
  asyncHandler(ticketController.list)
);

/** GET /tickets/:id */
router.get(
  '/:id',
  auth,
  role(['ADMIN', 'MANAGER', 'TECHNICIAN']),
  validate(ticketIdParamSchema, 'params'),
  asyncHandler(ticketController.getById)
);

/** PATCH /tickets/:id/assign */
router.patch(
  '/:id/assign',
  auth,
  role(['ADMIN', 'MANAGER']),
  validate(ticketIdParamSchema, 'params'),
  validate(assignTicketSchema),
  asyncHandler(ticketController.assign)
);

/** PATCH /tickets/:id/status */
router.patch(
  '/:id/status',
  auth,
  role(['ADMIN', 'MANAGER', 'TECHNICIAN']),
  validate(ticketIdParamSchema, 'params'),
  validate(updateTicketStatusSchema),
  asyncHandler(ticketController.updateStatus)
);

/** POST /tickets/:id/messages */
router.post(
  '/:id/messages',
  auth,
  role(['ADMIN', 'MANAGER', 'TECHNICIAN']),
  validate(ticketIdParamSchema, 'params'),
  validate(ticketMessageSchema),
  asyncHandler(ticketController.addMessage)
);

/** GET /tickets/:id/messages */
router.get(
  '/:id/messages',
  auth,
  role(['ADMIN', 'MANAGER', 'TECHNICIAN']),
  validate(ticketIdParamSchema, 'params'),
  validate(listTicketMessagesQuerySchema, 'query'),
  asyncHandler(ticketController.listMessages)
);

export default router;
