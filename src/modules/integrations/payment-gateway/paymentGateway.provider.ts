import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../../../config/env';

export interface GatewayPaymentInput {
  invoiceId: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface GatewayPaymentResult {
  status: 'CREATED' | 'SKIPPED' | 'FAILED';
  provider: string;
  externalId: string | null;
  redirectUrl?: string | null;
  message?: string;
}

export interface GatewayWebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface PaymentGatewayProvider {
  readonly name: string;
  createPayment(input: GatewayPaymentInput): Promise<GatewayPaymentResult>;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  parseWebhookEvent(rawBody: Buffer): GatewayWebhookEvent;
}

// Verifies and parses webhooks but never calls a real gateway. Replace when a provider is chosen.
export class UnconfiguredPaymentGatewayProvider implements PaymentGatewayProvider {
  readonly name = env.PAYMENT_GATEWAY_NAME;

  async createPayment(_input: GatewayPaymentInput): Promise<GatewayPaymentResult> {
    return {
      status: 'SKIPPED',
      provider: this.name,
      externalId: null,
      message: 'External payment gateway is not configured',
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const secret = env.PAYMENT_GATEWAY_WEBHOOK_SECRET;
    if (!secret || !signature) return false;

    const supplied = signature.startsWith('sha256=')
      ? signature.slice('sha256='.length)
      : signature;
    const expected = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const suppliedBuffer = Buffer.from(supplied, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (suppliedBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(suppliedBuffer, expectedBuffer);
  }

  parseWebhookEvent(rawBody: Buffer): GatewayWebhookEvent {
    const parsed: unknown = JSON.parse(rawBody.toString('utf8'));
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Webhook payload must be an object');
    }

    const payload = parsed as Record<string, unknown>;
    const data = payload.data;
    if (
      typeof payload.id !== 'string' ||
      typeof payload.type !== 'string' ||
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      throw new Error('Webhook payload is missing id, type, or data');
    }

    return {
      id: payload.id,
      type: payload.type,
      data: data as Record<string, unknown>,
    };
  }
}

export const paymentGatewayProvider: PaymentGatewayProvider =
  new UnconfiguredPaymentGatewayProvider();
