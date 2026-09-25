import prisma from '../../../config/db';

export interface TechnicianContactSnapshot {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
}

export interface TechnicianContactPort {
  getById(id: string): Promise<TechnicianContactSnapshot | null>;
  getEmailFor(id: string): Promise<string | null>;
}

/**
 * Read-only port for notifying an assigned technician.
 *
 * The technician record is a Person 1 foundation `User` row. Person 4 never
 * queries it directly from a service — only from this adapter, matching the
 * rule applied to the Person 2 client/contract ports.
 */
export class PrismaTechnicianContactAdapter implements TechnicianContactPort {
  async getById(id: string): Promise<TechnicianContactSnapshot | null> {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) return null;
    return { ...user, phone: null };
  }

  async getEmailFor(id: string): Promise<string | null> {
    if (!id) return null;
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null, isActive: true },
      select: { email: true },
    });
    return user?.email ?? null;
  }
}

export const technicianContactPort: TechnicianContactPort =
  new PrismaTechnicianContactAdapter();
