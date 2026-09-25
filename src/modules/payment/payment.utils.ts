import { Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';

export interface PaymentApplication {
  paidAmount: Prisma.Decimal;
  balanceAmount: Prisma.Decimal;
  status: 'PAID' | 'PARTIALLY_PAID';
}

export function calculatePaymentApplication(
  currentPaidAmount: Prisma.Decimal,
  totalAmount: Prisma.Decimal,
  amount: Prisma.Decimal
): PaymentApplication {
  if (amount.lte(0)) throw ApiError.badRequest('Payment amount must be positive');
  const currentBalance = new Prisma.Decimal(totalAmount).minus(currentPaidAmount);
  if (amount.gt(currentBalance)) {
    throw ApiError.badRequest('Payment cannot exceed the invoice balance');
  }

  const paidAmount = new Prisma.Decimal(currentPaidAmount).plus(amount);
  const balanceAmount = new Prisma.Decimal(totalAmount).minus(paidAmount);
  return {
    paidAmount,
    balanceAmount,
    status: balanceAmount.isZero() ? 'PAID' : 'PARTIALLY_PAID',
  };
}