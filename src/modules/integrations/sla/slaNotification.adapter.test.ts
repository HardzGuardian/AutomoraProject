import { SlaNotificationAdapter } from './slaNotification.adapter';
import { SlaBreachNotification } from '../../notification/slaBreach.types';
import { NotificationService } from '../../notification/notification.service';

const breach: SlaBreachNotification = {
  ticketId: 'ticket-1',
  assignedTechnicianId: 'tech-1',
  resolutionDeadline: new Date('2026-05-01T10:00:00Z'),
  escalatedAt: new Date('2026-05-01T10:00:01Z'),
};

function harness() {
  const sendSlaBreach = jest.fn().mockResolvedValue(undefined);
  const adapter = new SlaNotificationAdapter(
    { sendSlaBreach } as unknown as NotificationService
  );
  return { adapter, sendSlaBreach };
}

describe('SlaNotificationAdapter', () => {
  it('satisfies the SLA notification gateway shape', () => {
    const { adapter } = harness();

    const gateway: {
      send(notification: SlaBreachNotification): Promise<void>;
    } = adapter;

    expect(typeof gateway.send).toBe('function');
    expect(gateway.send.length).toBe(1);
  });

  it('forwards the breach payload unchanged to sendSlaBreach', async () => {
    const { adapter, sendSlaBreach } = harness();

    await adapter.send(breach);

    expect(sendSlaBreach).toHaveBeenCalledTimes(1);
    expect(sendSlaBreach).toHaveBeenCalledWith({
      ticketId: 'ticket-1',
      assignedTechnicianId: 'tech-1',
      resolutionDeadline: new Date('2026-05-01T10:00:00Z'),
      escalatedAt: new Date('2026-05-01T10:00:01Z'),
    });
  });

  it('resolves to void so the SLA job can await it', async () => {
    const { adapter } = harness();
    await expect(adapter.send(breach)).resolves.toBeUndefined();
  });

  it('propagates a failure from the notification service', async () => {
    const sendSlaBreach = jest.fn().mockRejectedValue(new Error('send failed'));
    const adapter = new SlaNotificationAdapter(
      { sendSlaBreach } as unknown as NotificationService
    );

    await expect(adapter.send(breach)).rejects.toThrow('send failed');
  });

  it('can be driven concurrently for several tickets', async () => {
    const { adapter, sendSlaBreach } = harness();

    await Promise.all([
      adapter.send({ ...breach, ticketId: 'ticket-1' }),
      adapter.send({ ...breach, ticketId: 'ticket-2' }),
    ]);

    expect(sendSlaBreach).toHaveBeenCalledTimes(2);
  });
});
