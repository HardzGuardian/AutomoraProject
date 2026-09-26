import { env } from '../../../config/env';
import {
  NotificationChannelName,
  NotificationInput,
  NotificationSendResult,
} from '../notification.types';
import { InAppNotificationProvider } from './inApp.provider';
import { DevelopmentEmailProvider } from './email.provider';
import { DevelopmentSmsProvider } from './sms.provider';
import { DevelopmentWhatsAppProvider } from './whatsapp.provider';

export interface NotificationProvider {
  readonly channel: NotificationChannelName;
  readonly name: string;
  send(input: NotificationInput): Promise<NotificationSendResult>;
}

export type NotificationProviderMap = Partial<
  Record<NotificationChannelName, NotificationProvider>
>;

export function providerFor(
  channel: NotificationChannelName,
  providers: NotificationProviderMap
): NotificationProvider | undefined {
  return providers[channel];
}

// The development providers do not deliver anything; they report SKIPPED
// until a real email/SMS transport is wired in.
export function buildDefaultProviders(): NotificationProviderMap {
  return {
    EMAIL: new DevelopmentEmailProvider(env.NOTIFICATION_FROM_EMAIL),
    SMS: new DevelopmentSmsProvider(env.NOTIFICATION_FROM_PHONE),
    WHATSAPP: new DevelopmentWhatsAppProvider(env.NOTIFICATION_FROM_PHONE),
    IN_APP: new InAppNotificationProvider(),
  };
}
