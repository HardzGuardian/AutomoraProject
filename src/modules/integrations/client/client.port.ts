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
  /**
   * Batch lookup keyed by client id. Used by reports and list endpoints so
   * Person 4 never needs a direct join against the Person 2 owned `clients`
   * table and never issues an N+1 query.
   */
  getByIds(ids: string[]): Promise<Map<string, ClientSnapshot>>;
  /** Count of non-deleted clients, for the Person 4 dashboard. */
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
 * Read-only compatibility port for the Person 2 client domain. It is kept
 * outside Person 4 business logic so the owning client service can replace it.
 *
 * Person 4 services must depend on `ClientReadPort` and must never query
 * `prisma.client` directly. This adapter is the single sanctioned place where
 * a Person 2 table is read on the Person 4 branch.
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
