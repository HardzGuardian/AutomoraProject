import prisma from '../../../config/db';

export interface ContractClientSnapshot {
  id: string;
  companyName: string;
  email: string | null;
  phone: string | null;
}

export interface ContractSnapshot {
  id: string;
  contractNumber: string;
  clientId: string;
  status: 'DRAFT' | 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'CANCELLED';
  value: number | null;
  paymentTerms: string | null;
  billingFrequency: string | null;
  startDate: Date;
  endDate: Date;
  client: ContractClientSnapshot;
}

export interface ContractReadPort {
  getById(id: string): Promise<ContractSnapshot | null>;
  /**
   * Batch lookup keyed by contract id. Used by reports so Person 4 never needs
   * a direct join against the Person 2 owned `contracts` table and never
   * issues an N+1 query.
   */
  getByIds(ids: string[]): Promise<Map<string, ContractSnapshot>>;
  /** Count contracts currently in the given status, for the Person 4 dashboard. */
  countByStatus(status: ContractSnapshot['status']): Promise<number>;
}

const CONTRACT_SELECT = {
  id: true,
  contractNumber: true,
  clientId: true,
  status: true,
  value: true,
  paymentTerms: true,
  billingFrequency: true,
  startDate: true,
  endDate: true,
  client: {
    select: {
      id: true,
      companyName: true,
      email: true,
      phone: true,
    },
  },
} as const;

/**
 * Read-only compatibility port for the Person 2 contract domain. The Person 4
 * branch does not contain Person 2's service module; this adapter is kept
 * outside Person 4 business logic and can be replaced by the owning
 * contractService when that branch is integrated.
 *
 * Person 4 services must depend on `ContractReadPort` and must never query
 * `prisma.contract` directly. This adapter is the single sanctioned place
 * where a Person 2 table is read on the Person 4 branch.
 */
export class PrismaContractReadAdapter implements ContractReadPort {
  async getById(id: string): Promise<ContractSnapshot | null> {
    const contract = await prisma.contract.findFirst({
      where: { id, deletedAt: null },
      select: CONTRACT_SELECT,
    });

    return contract;
  }

  async getByIds(ids: string[]): Promise<Map<string, ContractSnapshot>> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    const result = new Map<string, ContractSnapshot>();
    if (unique.length === 0) return result;

    const contracts = await prisma.contract.findMany({
      where: { id: { in: unique }, deletedAt: null },
      select: CONTRACT_SELECT,
    });

    for (const contract of contracts) {
      result.set(contract.id, contract);
    }
    return result;
  }

  async countByStatus(status: ContractSnapshot['status']): Promise<number> {
    return prisma.contract.count({ where: { deletedAt: null, status } });
  }
}

export const contractReadPort: ContractReadPort = new PrismaContractReadAdapter();
