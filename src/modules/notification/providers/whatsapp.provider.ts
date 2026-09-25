import { logger } from '../../../utils/logger';
import {
  NotificationInput,
  NotificationSendResult,
} from '../notification.types';
import { NotificationProvider } from './notification.provider';

export class DevelopmentWhatsAppProvider implements NotificationProvider {
  readonly channel = 'WHATSAPP' as const;
  readonly name = 'development-whatsapp';

  constructor(private readonly from?: string) {}

  async send(input: NotificationInput): Promise<NotificationSendResult> {
    logger.info('Development WhatsApp provider skipped delivery', {
      eventKey: input.eventKey,
      recipient: input.recipient,
      from: this.from,
    });

    return {
      status: 'SKIPPED',
      provider: this.name,
    };
  }
}

export const whatsappProvider = new DevelopmentWhatsAppProvider();
