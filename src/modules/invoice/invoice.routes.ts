import { Router } from 'express';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { invoiceController } from './invoice.controller';
import {
  createInvoiceSchema,
  invoiceIdParamSchema,
  listInvoicesQuerySchema,
  updateInvoiceSchema,
} from './invoice.validator';

const router = Router();
const financialRoles = ['ADMIN', 'MANAGER', 'SALES'] as const;

router.get(
  '/',
  auth,
  role([...financialRoles]),
  validate(listInvoicesQuerySchema, 'query'),
  asyncHandler(invoiceController.list)
);

router.post(
  '/',
  auth,
  role([...financialRoles]),
  validate(createInvoiceSchema),
  asyncHandler(invoiceController.create)
);

router.get(
  '/:id/pdf',
  auth,
  role([...financialRoles]),
  validate(invoiceIdParamSchema, 'params'),
  asyncHandler(invoiceController.pdf)
);

router.patch(
  '/:id/overdue',
  auth,
  role([...financialRoles]),
  validate(invoiceIdParamSchema, 'params'),
  asyncHandler(invoiceController.markOverdue)
);

router.patch(
  '/:id',
  auth,
  role([...financialRoles]),
  validate(invoiceIdParamSchema, 'params'),
  validate(updateInvoiceSchema),
  asyncHandler(invoiceController.update)
);

router.get(
  '/:id',
  auth,
  role([...financialRoles]),
  validate(invoiceIdParamSchema, 'params'),
  asyncHandler(invoiceController.getById)
);

export default router;