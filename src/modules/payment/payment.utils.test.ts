import { Prisma } from '@prisma/client';
import { calculatePaymentApplication } from './payment.utils';

describe('calculatePaymentApplication', () => {
  it('applies a partial payment and leaves a balance', () => {
    const result = calculatePaymentApplication(
      new Prisma.Decimal(0),
      new Prisma.Decimal(1000),
      new Prisma.Decimal(250)
    );

    expect(result.paidAmount.toNumber()).toBe(250);
    expect(result.balanceAmount.toNumber()).toBe(750);
    expect(result.status).toBe('PARTIALLY_PAID');
  });

  it('marks an invoice paid when the balance reaches zero', () => {
    const result = calculatePaymentApplication(
      new Prisma.Decimal(400),
      new Prisma.Decimal(1000),
      new Prisma.Decimal(600)
    );

    expect(result.balanceAmount.toNumber()).toBe(0);
    expect(result.status).toBe('PAID');
  });

  it('rejects over-application', () => {
    expect(() =>
      calculatePaymentApplication(
        new Prisma.Decimal(900),
        new Prisma.Decimal(1000),
        new Prisma.Decimal(200)
      )
    ).toThrow('Payment cannot exceed the invoice balance');
  });
});