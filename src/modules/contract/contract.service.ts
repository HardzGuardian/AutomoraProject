import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { DateHelpers } from '../../utils/dateHelpers';
import { auditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, CONTRACT_STATUS } from '../../config/constants';
import {
  CreateContractInput,
  UpdateContractInput,
  ListContractsQuery,
  ContractDocumentInput,
  ContractSLAInput,
} from './contract.validator';
import { Prisma, ContractStatus } from '@prisma/client';
import { logger } from '../../utils/logger';

export class ContractService {
  // ===========================================
  // STATUS CALCULATION (Centralized)
  // ===========================================

  /**
   * Calculate contract status based on dates.
   * This is the SINGLE source of truth for status calculation.
   */
  calculateStatus(
    currentStatus: ContractStatus,
    startDate: Date,
    endDate: Date
  ): ContractStatus {
    // Cancelled contracts stay cancelled
    if (currentStatus === 'CANCELLED') {
      return 'CANCELLED';
    }

    const now = new Date();
    const nowUtc = DateHelpers.startOfDay(now);
    const endDateUtc = DateHelpers.startOfDay(endDate);
    const expiringSoonDate = DateHelpers.addDays(endDateUtc, -CONTRACT_STATUS.EXPIRING_SOON_DAYS);

    // If not yet started, keep as DRAFT (or ACTIVE if we want auto-activation)
    if (nowUtc < DateHelpers.startOfDay(startDate)) {
      return 'DRAFT';
    }

    // If expired
    if (nowUtc > endDateUtc) {
      return 'EXPIRED';
    }

    // If expiring soon (within 30 days of end)
    if (nowUtc >= expiringSoonDate) {
      return 'EXPIRING_SOON';
    }

    // If started and not expiring soon
    return 'ACTIVE';
  }

  /**
   * Calculate renewal date from end date.
   * Convention: renewalDate = endDate - 30 days
   */
  calculateRenewalDate(endDate: Date): Date {
    return DateHelpers.addDays(endDate, -30);
  }

  // ===========================================
  // CONTRACT CRUD
  // ===========================================

  /**
   * Create a new contract with related records.
   * Uses transaction for atomicity.
   */
  async create(data: CreateContractInput, userId: string) {
    // Validate client exists
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, deletedAt: null },
    });
    if (!client) {
      throw ApiError.notFound('Client not found');
    }

    // Check for duplicate contract number
    const existingContract = await prisma.contract.findUnique({
      where: { contractNumber: data.contractNumber },
    });
    if (existingContract) {
      throw ApiError.conflict('Contract number already exists');
    }

    // Validate service type if provided
    if (data.serviceTypeId) {
      const serviceType = await prisma.serviceType.findFirst({
        where: { id: data.serviceTypeId, isActive: true },
      });
      if (!serviceType) {
        throw ApiError.notFound('Service type not found or inactive');
      }
    }

    // Validate assets if provided
    if (data.assetIds && data.assetIds.length > 0) {
      const assets = await prisma.asset.findMany({
        where: { id: { in: data.assetIds }, deletedAt: null },
      });
      if (assets.length !== data.assetIds.length) {
        throw ApiError.badRequest('One or more asset IDs are invalid');
      }
    }

    // Calculate renewal date
    const renewalDate = this.calculateRenewalDate(data.endDate);

    // Create contract with related records in a transaction
    const contract = await prisma.$transaction(async (tx) => {
      // 1. Create the contract
      const newContract = await tx.contract.create({
        data: {
          contractNumber: data.contractNumber,
          clientId: data.clientId,
          type: data.type as any,
          status: 'DRAFT',
          serviceTypeId: data.serviceTypeId,
          startDate: data.startDate,
          endDate: data.endDate,
          renewalDate,
          value: data.value,
          paymentTerms: data.paymentTerms,
          billingFrequency: data.billingFrequency as any,
          includedVisits: data.includedVisits,
          notes: data.notes,
        },
      });

      // 2. Create contract-asset relationships
      if (data.assetIds && data.assetIds.length > 0) {
        await tx.contractAsset.createMany({
          data: data.assetIds.map((assetId) => ({
            contractId: newContract.id,
            assetId,
          })),
        });
      }

      // 3. Create SLA if provided
      if (data.sla) {
        await tx.contractSLA.create({
          data: {
            contractId: newContract.id,
            responseTimeHours: data.sla.responseTimeHours,
            resolutionTimeHours: data.sla.resolutionTimeHours,
            penaltyClause: data.sla.penaltyClause,
          },
        });
      }

      // 4. Create renewal record
      await tx.renewal.create({
        data: {
          contractId: newContract.id,
          status: 'PENDING',
        },
      });

      // 5. Audit log within transaction
      await auditService.log(
        {
          userId,
          action: AUDIT_ACTIONS.CONTRACT_CREATED,
          entity: AUDIT_ENTITIES.CONTRACT,
          entityId: newContract.id,
          metadata: {
            contractNumber: newContract.contractNumber,
            clientId: data.clientId,
            type: newContract.type,
            value: newContract.value,
          },
        },
        tx
      );

      return newContract;
    });

    // Return contract with relations
    return this.getById(contract.id);
  }

  /**
   * List contracts with pagination and filters.
   */
  async list(query: ListContractsQuery) {
    const { page, limit, search, clientId, status, type, expiringInDays } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ContractWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { contractNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { client: { companyName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (status) {
      where.status = status as any;
    }

    if (type) {
      where.type = type as any;
    }

    if (expiringInDays) {
      const targetDate = DateHelpers.addDays(new Date(), expiringInDays);
      where.AND = [
        { endDate: { gte: new Date() } },
        { endDate: { lte: targetDate } },
        { status: { not: 'CANCELLED' } },
      ];
    }

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          client: {
            select: { id: true, companyName: true },
          },
          serviceType: {
            select: { id: true, name: true },
          },
          _count: {
            select: { assets: true, documents: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contract.count({ where }),
    ]);

    return {
      contracts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get contract by ID with all relations.
   */
  async getById(id: string) {
    const contract = await prisma.contract.findFirst({
      where: { id, deletedAt: null },
      include: {
        client: {
          select: { id: true, companyName: true, email: true, phone: true },
        },
        serviceType: true,
        assets: {
          include: {
            asset: {
              select: {
                id: true,
                serialNumber: true,
                model: true,
                manufacturer: true,
                installDate: true,
                warrantyExpiry: true,
              },
            },
          },
        },
        documents: {
          include: {
            uploadedFile: {
              select: {
                id: true,
                originalName: true,
                filename: true,
                mimeType: true,
                size: true,
              },
            },
          },
        },
        sla: true,
        renewal: true,
      },
    });

    if (!contract) {
      throw ApiError.notFound('Contract not found');
    }

    return contract;
  }

  /**
   * Update contract.
   */
  async update(id: string, data: UpdateContractInput, userId: string) {
    const existing = await prisma.contract.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw ApiError.notFound('Contract not found');
    }

    // Prevent updates to cancelled contracts for most fields
    if (existing.status === 'CANCELLED') {
      throw ApiError.badRequest('Cannot update a cancelled contract');
    }

    // Validate service type if changing
    if (data.serviceTypeId) {
      const serviceType = await prisma.serviceType.findFirst({
        where: { id: data.serviceTypeId, isActive: true },
      });
      if (!serviceType) {
        throw ApiError.notFound('Service type not found or inactive');
      }
    }

    // If dates are changing, recalculate renewal date
    const newEndDate = data.endDate || existing.endDate;
    const renewalDate = this.calculateRenewalDate(newEndDate);

    const updateData: Prisma.ContractUpdateInput = {
      type: data.type as any,
      serviceTypeId: data.serviceTypeId,
      startDate: data.startDate,
      endDate: data.endDate,
      renewalDate,
      value: data.value,
      paymentTerms: data.paymentTerms,
      billingFrequency: data.billingFrequency as any,
      includedVisits: data.includedVisits,
      notes: data.notes,
    };

    // Recalculate status if dates changed
    if (data.startDate || data.endDate) {
      const newStartDate = data.startDate || existing.startDate;
      const newEndDateForStatus = data.endDate || existing.endDate;
      const newStatus = this.calculateStatus(
        existing.status,
        newStartDate,
        newEndDateForStatus
      );
      updateData.status = newStatus as any;
    }

    const contract = await prisma.contract.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.CONTRACT_UPDATED,
      entity: AUDIT_ENTITIES.CONTRACT,
      entityId: id,
      metadata: { changes: data },
    });

    return this.getById(id);
  }

  /**
   * Activate contract (DRAFT → ACTIVE).
   */
  async activate(id: string, userId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id, deletedAt: null },
    });

    if (!contract) {
      throw ApiError.notFound('Contract not found');
    }

    if (contract.status !== 'DRAFT') {
      throw ApiError.badRequest(
        `Cannot activate contract in ${contract.status} status. Only DRAFT contracts can be activated.`
      );
    }

    // Validate contract has required data
    if (!contract.startDate || !contract.endDate) {
      throw ApiError.badRequest('Contract must have start and end dates');
    }

    const newStatus = this.calculateStatus('ACTIVE', contract.startDate, contract.endDate);

    const updated = await prisma.contract.update({
      where: { id },
      data: { status: newStatus as any },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.CONTRACT_ACTIVATED,
      entity: AUDIT_ENTITIES.CONTRACT,
      entityId: id,
      metadata: { previousStatus: contract.status, newStatus },
    });

    // TODO: Call schedulingService.generateVisits(contract) — Person 3 dependency (STUBBED)
    // schedulingService.generateVisits(contract);

    return this.getById(id);
  }

  /**
   * Cancel contract.
   */
  async cancel(id: string, userId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id, deletedAt: null },
    });

    if (!contract) {
      throw ApiError.notFound('Contract not found');
    }

    if (contract.status === 'CANCELLED') {
      throw ApiError.badRequest('Contract is already cancelled');
    }

    if (contract.status === 'EXPIRED') {
      throw ApiError.badRequest('Cannot cancel an expired contract');
    }

    const updated = await prisma.contract.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.CONTRACT_CANCELLED,
      entity: AUDIT_ENTITIES.CONTRACT,
      entityId: id,
      metadata: { previousStatus: contract.status },
    });

    return this.getById(id);
  }

  /**
   * Get expiring contracts (for jobs and API).
   */
  async getExpiringContracts(days: number = 30) {
    const targetDate = DateHelpers.addDays(new Date(), days);
    const today = DateHelpers.startOfDay(new Date());

    const contracts = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: { not: 'CANCELLED' },
        endDate: {
          gte: today,
          lte: targetDate,
        },
      },
      include: {
        client: {
          select: { id: true, companyName: true, email: true },
        },
        renewal: true,
      },
      orderBy: { endDate: 'asc' },
    });

    return contracts;
  }

  // ===========================================
  // CONTRACT DOCUMENTS
  // ===========================================

  /**
   * Add document to contract.
   */
  async addDocument(
    contractId: string,
    data: ContractDocumentInput,
    userId: string
  ) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
    });
    if (!contract) {
      throw ApiError.notFound('Contract not found');
    }

    // Verify the uploaded file exists
    const uploadedFile = await prisma.uploadedFile.findUnique({
      where: { id: data.uploadedFileId },
    });
    if (!uploadedFile) {
      throw ApiError.notFound('Uploaded file not found');
    }

    const document = await prisma.contractDocument.create({
      data: {
        contractId,
        uploadedFileId: data.uploadedFileId,
        documentType: data.documentType as any,
        notes: data.notes,
      },
      include: {
        uploadedFile: true,
      },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.CONTRACT_DOCUMENT_ADDED,
      entity: AUDIT_ENTITIES.CONTRACT_DOCUMENT,
      entityId: document.id,
      metadata: {
        contractId,
        documentType: data.documentType,
        fileName: uploadedFile.originalName,
      },
    });

    return document;
  }

  /**
   * List documents for a contract.
   */
  async listDocuments(contractId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
    });
    if (!contract) {
      throw ApiError.notFound('Contract not found');
    }

    return prisma.contractDocument.findMany({
      where: { contractId },
      include: {
        uploadedFile: {
          select: {
            id: true,
            originalName: true,
            filename: true,
            mimeType: true,
            size: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Remove document from contract.
   */
  async removeDocument(contractId: string, docId: string, userId: string) {
    const document = await prisma.contractDocument.findFirst({
      where: { id: docId, contractId },
    });
    if (!document) {
      throw ApiError.notFound('Document not found');
    }

    await prisma.contractDocument.delete({
      where: { id: docId },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.CONTRACT_DOCUMENT_REMOVED,
      entity: AUDIT_ENTITIES.CONTRACT_DOCUMENT,
      entityId: docId,
      metadata: { contractId, documentType: document.documentType },
    });
  }

  // ===========================================
  // CONTRACT SLA
  // ===========================================

  /**
   * Get or update contract SLA.
   */
  async getSLA(contractId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
    });
    if (!contract) {
      throw ApiError.notFound('Contract not found');
    }

    return prisma.contractSLA.findUnique({
      where: { contractId },
    });
  }

  async upsertSLA(contractId: string, data: ContractSLAInput, userId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
    });
    if (!contract) {
      throw ApiError.notFound('Contract not found');
    }

    const sla = await prisma.contractSLA.upsert({
      where: { contractId },
      create: {
        contractId,
        responseTimeHours: data.responseTimeHours,
        resolutionTimeHours: data.resolutionTimeHours,
        penaltyClause: data.penaltyClause,
      },
      update: {
        responseTimeHours: data.responseTimeHours,
        resolutionTimeHours: data.resolutionTimeHours,
        penaltyClause: data.penaltyClause,
      },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.CONTRACT_SLA_UPDATED,
      entity: AUDIT_ENTITIES.CONTRACT_SLA,
      entityId: sla.id,
      metadata: { contractId },
    });

    return sla;
  }

  // ===========================================
  // CONTRACT ASSETS (additional routes)
  // ===========================================

  /**
   * Link asset to contract.
   */
  async linkAsset(contractId: string, assetId: string, userId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
    });
    if (!contract) {
      throw ApiError.notFound('Contract not found');
    }

    const asset = await prisma.asset.findFirst({
      where: { id: assetId, deletedAt: null },
    });
    if (!asset) {
      throw ApiError.notFound('Asset not found');
    }

    const existing = await prisma.contractAsset.findUnique({
      where: { contractId_assetId: { contractId, assetId } },
    });
    if (existing) {
      throw ApiError.conflict('Asset is already linked to this contract');
    }

    await prisma.contractAsset.create({
      data: { contractId, assetId },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.CONTRACT_ASSET_LINKED,
      entity: AUDIT_ENTITIES.CONTRACT_ASSET,
      entityId: contractId,
      metadata: { contractId, assetId, serialNumber: asset.serialNumber },
    });
  }

  /**
   * Unlink asset from contract.
   */
  async unlinkAsset(contractId: string, assetId: string, userId: string) {
    const existing = await prisma.contractAsset.findUnique({
      where: { contractId_assetId: { contractId, assetId } },
    });
    if (!existing) {
      throw ApiError.notFound('Asset is not linked to this contract');
    }

    await prisma.contractAsset.delete({
      where: { contractId_assetId: { contractId, assetId } },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.CONTRACT_ASSET_UNLINKED,
      entity: AUDIT_ENTITIES.CONTRACT_ASSET,
      entityId: contractId,
      metadata: { contractId, assetId },
    });
  }
}

export const contractService = new ContractService();
