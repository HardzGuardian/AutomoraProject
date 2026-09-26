import prisma from '../../../config/db';

export interface ClientSnapshot {
  id: string;
  companyName: string;
  email: string | null;
  phone: string | null;
  deletedAt: Date | null;
}

export interface ClientReadPort {
  getById(id: string): Promise<ClientSnapshot | null>;
  getByIds(ids: string[]): Promise<Map<string, ClientSnapshot>>;
  /** Excludes soft-deleted clients. */
  countActive(): Promise<number>;
}

const CLIENT_SELECT = {
  id: true,
  companyName: true,
  email: true,
  phone: true,
  deletedAt: true,
} as const;

/**
 * The only place outside the client module allowed to read the clients table
 * (enforced by tests/architecture.test.ts). Swap this for the client module's
 * service once it is merged.
 */
export class PrismaClientReadAdapter implements ClientReadPort {
  async getById(id: string): Promise<ClientSnapshot | null> {
    const client = await prisma.client.findFirst({
      where: { id, deletedAt: null },
      select: CLIENT_SELECT,
    });

    return client;
  }

  async getByIds(ids: string[]): Promise<Map<string, ClientSnapshot>> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    const result = new Map<string, ClientSnapshot>();
    if (unique.length === 0) return result;

    const clients = await prisma.client.findMany({
      where: { id: { in: unique }, deletedAt: null },
      select: CLIENT_SELECT,
    });

    for (const client of clients) {
      result.set(client.id, client);
    }
    return result;
  }

  async countActive(): Promise<number> {
    return prisma.client.count({ where: { deletedAt: null } });
  }
}

export const clientReadPort: ClientReadPort = new PrismaClientReadAdapter();
