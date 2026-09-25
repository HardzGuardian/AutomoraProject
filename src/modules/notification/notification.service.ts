import {
  NotificationChannel as PrismaNotificationChannel,
  NotificationStatus as PrismaNotificationStatus,
  Prisma,
} from '@prisma/client';
import prisma from '../../config/db';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../config/constants';
import { auditService } from '../audit/audit.service';
import { logger } from '../../utils/logger';
import {
  NotificationChannelName,
  NotificationInput,
  NotificationLogInput,
  NotificationSendResult,
  PaymentReminderInput,
  PaymentReminderResult,
  RenewalReminderInput,
} from './notification.types';
import {
  NotificationProviderMap,
  buildDefaultProviders,
  providerFor,
} from './providers/notification.provider';
import {
  TechnicianContactPort,
  technicianContactPort,
} from '../integrations/technician/technician.port';
import { SlaBreachNotification } from './slaBreach.types';

const defaultProviders: NotificationProviderMap = buildDefaultProviders();

export class NotificationService {
  constructor(
    private readonly providers: NotificationProviderMap = defaultProviders,
    private readonly technicians: TechnicianContactPort = technicianContactPort
  ) {}

  async send(input: NotificationInput): Promise<NotificationSendResult> {
    if (!input.recipient.trim()) {
      const skipped: NotificationSendResult = {
        status: 'SKIPPED',
        error: 'Recipient is missing',
      };
      await this.log({
        eventKey: input.eventKey,
        channel: input.channel,
        recipient: '',
        status: 'SKIPPED',
        errorMessage: skipped.error,
        metadata: input.metadata,
        relatedId: input.relatedId,
      });
      return skipped;
    }

    if (await this.wasSent(input.eventKey, input.channel, input.recipient)) {
      return {
        status: 'SKIPPED',
        duplicate: true,
      };
    }

    const provider = providerFor(input.channel, this.providers);
    if (!provider) {
      const failure: NotificationSendResult = {
        status: 'FAILED',
        error: `No provider configured for ${input.channel}`,
      };
      await this.log({
        eventKey: input.eventKey,
        channel: input.channel,
        recipient: input.recipient,
        status: 'FAILED',
        errorMessage: failure.error,
        metadata: input.metadata,
        relatedId: input.relatedId,
      });
      return failure;
    }

    let result: NotificationSendResult;
    try {
      result = await provider.send(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown provider error';
      result = {
        status: 'FAILED',
        provider: provider.name,
        error: message,
      };
    }

    await this.log({
      eventKey: input.eventKey,
      channel: input.channel,
      recipient: input.recipient,
      status: result.status,
      provider: result.provider ?? provider.name,
      errorMessage: result.error,
      metadata: input.metadata,
      relatedId: input.relatedId,
      sentAt: result.status === 'SENT' ? new Date() : undefined,
    });

    return result;
  }

  /**
   * Person 3 SLA breach notification.
   *
   * Deliberately a NEW sibling method rather than a change to the generic
   * `send()` signature: `send()` requires eventKey/channel/recipient/message,
   * none of which Person 3's payload carries, so overloading it would either
   * weaken the type for every existing caller or break at runtime.
   *
   * Returns `Promise<void>` so it satisfies Person 3's
   * `SlaNotificationGateway` contract. De-duplication, persistence and audit
   * are inherited by delegating to the existing `send()`.
   */
  async sendSlaBreach(params: SlaBreachNotification): Promise<void> {
    const recipient = await this.technicians.getEmailFor(
      params.assignedTechnicianId
    );

    if (!recipient) {
      logger.warn('SLA breach notification skipped: technician has no email', {
        ticketId: params.ticketId,
        assignedTechnicianId: params.assignedTechnicianId,
      });
      return;
    }

    await this.send({
      eventKey: `sla-breach:${params.ticketId}`,
      channel: 'EMAIL',
      recipient,
      subject: `SLA breached: ticket ${params.ticketId}`,
      message: [
        `Ticket ${params.ticketId} breached its resolution SLA.`,
        `Resolution deadline: ${params.resolutionDeadline.toISOString()}.`,
        `Escalated at: ${params.escalatedAt.toISOString()}.`,
      ].join(' '),
      relatedId: params.ticketId,
      metadata: {
        ticketId: params.ticketId,
        assignedTechnicianId: params.assignedTechnicianId,
        resolutionDeadline: params.resolutionDeadline.toISOString(),
        escalatedAt: params.escalatedAt.toISOString(),
      },
    });
  }

  async sendRenewalReminder(params: RenewalReminderInput): Promise<void> {
    const message = [
      `Contract ${params.contractNumber} for ${params.clientName}`,
      `expires on ${params.endDate.toISOString().slice(0, 10)}`,
      `(${params.daysUntilExpiry} days remaining; ${params.reminderType})`,
    ].join(' ');

    await this.send({
      eventKey: `renewal-reminder:${params.contractId}:${params.reminderType}`,
      channel: 'EMAIL',
      recipient: params.clientEmail,
      subject: `Contract renewal reminder: ${params.contractNumber}`,
      message,
      relatedId: params.contractId,
      metadata: {
        contractId: params.contractId,
        contractNumber: params.contractNumber,
        reminderType: params.reminderType,
        daysUntilExpiry: params.daysUntilExpiry,
      },
    });
  }

  async sendPaymentReminder(
    input: PaymentReminderInput
  ): Promise<PaymentReminderResult> {
    const channels = input.channels ?? this.defaultChannels(input);
    const result: PaymentReminderResult = {
      attempted: channels.length,
      sent: 0,
      skipped: 0,
      failed: 0,
      results: [],
    };

    if (channels.length === 0) {
      await this.log({
        eventKey: input.eventKey ?? `payment-reminder:${input.invoiceId}:overdue`,
        channel: 'IN_APP',
        recipient: '',
        status: 'SKIPPED',
        errorMessage: 'No notification recipient is available',
        relatedId: input.invoiceId,
        metadata: {
          invoiceNumber: input.invoiceNumber,
          amount: input.amount,
          dueDate: input.dueDate,
        },
      });
      result.skipped = 1;
      result.attempted = 1;
      return result;
    }

    for (const channel of channels) {
      const recipient = channel === 'EMAIL' ? input.email || '' : input.phone || '';
      const delivery = await this.send({
        eventKey: input.eventKey ?? `payment-reminder:${input.invoiceId}:overdue`,
        channel,
        recipient,
        subject: `Payment reminder: ${input.invoiceNumber}`,
        message: `Invoice ${input.invoiceNumber} for ${input.amount} is due on ${input.dueDate}.`,
        relatedId: input.invoiceId,
        metadata: {
          invoiceId: input.invoiceId,
          invoiceNumber: input.invoiceNumber,
          amount: input.amount,
          dueDate: input.dueDate,
        },
      });

      result.results.push(delivery);
      if (delivery.status === 'SENT') result.sent += 1;
      if (delivery.status === 'SKIPPED') result.skipped += 1;
      if (delivery.status === 'FAILED') result.failed += 1;
    }

    return result;
  }

  async wasSent(
    eventKey: string,
    channel?: NotificationChannelName,
    recipient?: string
  ): Promise<boolean> {
    const where: Prisma.NotificationLogWhereInput = {
      eventKey,
      status: {
        in: [PrismaNotificationStatus.SENT, PrismaNotificationStatus.SKIPPED],
      },
    };

    if (channel) where.channel = channel as PrismaNotificationChannel;
    if (recipient !== undefined) where.recipient = recipient;

    try {
      const existing = await prisma.notificationLog.findFirst({
        where,
        select: { id: true },
      });
      return Boolean(existing);
    } catch (error) {
      logger.warn('Unable to check notification deduplication state', error);
      return false;
    }
  }

  async log(input: NotificationLogInput): Promise<void> {
    // `NotificationLog` has a compound unique on (eventKey, channel, recipient).
    // A plain `create` therefore collides whenever the same event is retried
    // after a FAILED attempt, and the collision used to be swallowed — losing
    // the retry outcome. An upsert keeps exactly one row per de-duplication
    // key and always records the latest attempt.
    try {
      await prisma.notificationLog.upsert({
        where: {
          eventKey_channel_recipient: {
            eventKey: input.eventKey,
            channel: input.channel as PrismaNotificationChannel,
            recipient: input.recipient,
          },
        },
        create: {
          eventKey: input.eventKey,
          channel: input.channel as PrismaNotificationChannel,
          recipient: input.recipient,
          status: input.status as PrismaNotificationStatus,
          provider: input.provider,
          errorMessage: input.errorMessage,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
          relatedId: input.relatedId,
          sentAt: input.sentAt,
        },
        update: {
          status: input.status as PrismaNotificationStatus,
          provider: input.provider,
          errorMessage: input.errorMessage,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
          relatedId: input.relatedId,
          sentAt: input.sentAt,
        },
      });
    } catch (error) {
      logger.error(
        `Unable to persist notification log (eventKey=${input.eventKey}, channel=${input.channel}, recipient=${input.recipient}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    try {
      await auditService.logSimple({
        action:
          input.status === 'FAILED'
            ? AUDIT_ACTIONS.NOTIFICATION_FAILED
            : input.status === 'SKIPPED'
              ? AUDIT_ACTIONS.NOTIFICATION_SKIPPED
              : AUDIT_ACTIONS.NOTIFICATION_SENT,
        entity: AUDIT_ENTITIES.NOTIFICATION,
        metadata: {
          eventKey: input.eventKey,
          channel: input.channel,
          status: input.status,
          provider: input.provider,
          relatedId: input.relatedId,
        },
      });
    } catch (error) {
      logger.warn('Unable to audit notification attempt', error);
    }
  }

  private defaultChannels(input: PaymentReminderInput): NotificationChannelName[] {
    const channels: NotificationChannelName[] = [];
    if (input.email) channels.push('EMAIL');
    if (input.phone) {
      channels.push('SMS');
      channels.push('WHATSAPP');
    }
    return channels;
  }
}

export const notificationService = new NotificationService();
