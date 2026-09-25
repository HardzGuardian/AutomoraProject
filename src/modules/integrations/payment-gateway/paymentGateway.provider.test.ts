import { UnconfiguredPaymentGatewayProvider } from './paymentGateway.provider';

describe('UnconfiguredPaymentGatewayProvider', () => {
  const provider = new UnconfiguredPaymentGatewayProvider();

  it('does not pretend a gateway payment was created when unconfigured', async () => {
    const result = await provider.createPayment({
      invoiceId: 'invoice-1',
      invoiceNumber: 'INV-1',
      amount: '100',
      currency: 'INR',
    });

    expect(result.status).toBe('SKIPPED');
    expect(result.externalId).toBeNull();
  });

  it('parses a normalized webhook payload', () => {
    const event = provider.parseWebhookEvent(
      Buffer.from(
        JSON.stringify({ id: 'event-1', type: 'payment.succeeded', data: { paymentId: 'pay-1' } })
      )
    );

    expect(event).toEqual({
      id: 'event-1',
      type: 'payment.succeeded',
      data: { paymentId: 'pay-1' },
    });
  });
});