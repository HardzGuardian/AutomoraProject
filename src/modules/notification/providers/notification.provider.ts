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

/**
 * Builds the provider map, wiring the existing `NOTIFICATION_FROM_EMAIL` and
 * `NOTIFICATION_FROM_PHONE` environment variables into the sender identity.
 *
 * These variables only supply the *identity* used for attribution. No external
 * transport is contacted and no delivery is simulated: without a configured
 * transport the development providers keep reporting SKIPPED, which is the
 * truthful outcome. Adding a real transport is a separate, explicit change.
 */
export function buildDefaultProviders(): NotificationProviderMap {
  return {
    EMAIL: new DevelopmentEmailProvider(env.NOTIFICATION_FROM_EMAIL),
    SMS: new DevelopmentSmsProvider(env.NOTIFICATION_FROM_PHONE),
    WHATSAPP: new DevelopmentWhatsAppProvider(env.NOTIFICATION_FROM_PHONE),
    IN_APP: new InAppNotificationProvider(),
  };
}
