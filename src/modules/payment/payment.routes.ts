import { Router } from 'express';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { paymentController } from './payment.controller';
import {
  gatewayPaymentSchema,
  listPaymentsQuerySchema,
  paymentIdParamSchema,
  recordPaymentSchema,
} from './payment.validator';

const router = Router();
const financialRoles = ['ADMIN', 'MANAGER', 'SALES'] as const;

router.post(
  '/webhooks/gateway',
  asyncHandler(paymentController.webhook)
);

router.get(
  '/',
  auth,
  role([...financialRoles]),
  validate(listPaymentsQuerySchema, 'query'),
  asyncHandler(paymentController.list)
);

router.post(
  '/',
  auth,
  role([...financialRoles]),
  validate(recordPaymentSchema),
  asyncHandler(paymentController.record)
);

router.post(
  '/gateway/create',
  auth,
  role([...financialRoles]),
  validate(gatewayPaymentSchema),
  asyncHandler(paymentController.createGatewayPayment)
);

router.get(
  '/:id',
  auth,
  role([...financialRoles]),
  validate(paymentIdParamSchema, 'params'),
  asyncHandler(paymentController.getById)
);

router.delete(
  '/:id',
  auth,
  role([...financialRoles]),
  validate(paymentIdParamSchema, 'params'),
  asyncHandler(paymentController.cancel)
);

export default router;

