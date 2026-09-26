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
  getByIds(ids: string[]): Promise<Map<string, ContractSnapshot>>;
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
 * The only place outside the contract module allowed to read the contracts
 * table (enforced by tests/architecture.test.ts). Swap this for the contract
 * module's service once it is merged.
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
