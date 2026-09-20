import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { auditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../config/constants';
import {
  CreateAssetInput,
  UpdateAssetInput,
  ListAssetsQuery,
} from './asset.validator';
import { Prisma } from '@prisma/client';

export class AssetService {
  /**
   * Create a new asset.
   */
  async create(data: CreateAssetInput, userId: string) {
    // Check for duplicate serial number
    const existing = await prisma.asset.findUnique({
      where: { serialNumber: data.serialNumber },
    });

    if (existing) {
      throw ApiError.conflict('Asset with this serial number already exists');
    }

    // Verify client if provided
    if (data.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: data.clientId, deletedAt: null },
      });
      if (!client) {
        throw ApiError.notFound('Client not found');
      }
    }

    const asset = await prisma.asset.create({
      data: {
        serialNumber: data.serialNumber,
        model: data.model,
        manufacturer: data.manufacturer,
        description: data.description,
        installDate: data.installDate,
        warrantyExpiry: data.warrantyExpiry,
        clientId: data.clientId,
        notes: data.notes,
      },
    });

    // Link to sites if provided
    if (data.siteIds && data.siteIds.length > 0) {
      // Verify sites exist
      const sites = await prisma.clientSite.findMany({
        where: { id: { in: data.siteIds } },
      });

      if (sites.length !== data.siteIds.length) {
        throw ApiError.badRequest('One or more site IDs are invalid');
      }

      await prisma.assetSite.createMany({
        data: data.siteIds.map((siteId) => ({
          assetId: asset.id,
          siteId,
        })),
      });
    }

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.ASSET_CREATED,
      entity: AUDIT_ENTITIES.ASSET,
      entityId: asset.id,
      metadata: { serialNumber: asset.serialNumber, model: asset.model },
    });

    return asset;
  }

  /**
   * List assets with pagination and filters.
   */
  async list(query: ListAssetsQuery) {
    const { page, limit, search, clientId, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AssetWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          client: {
            select: { id: true, companyName: true },
          },
          sites: {
            include: {
              site: {
                select: { id: true, siteName: true, city: true },
              },
            },
          },
          _count: {
            select: { contracts: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.asset.count({ where }),
    ]);

    return {
      assets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get asset by ID.
   */
  async getById(id: string) {
    const asset = await prisma.asset.findFirst({
      where: { id, deletedAt: null },
      include: {
        client: {
          select: { id: true, companyName: true },
        },
        sites: {
          include: {
            site: true,
          },
        },
        contracts: {
          include: {
            contract: {
              select: {
                id: true,
                contractNumber: true,
                status: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
      },
    });

    if (!asset) {
      throw ApiError.notFound('Asset not found');
    }

    return asset;
  }

  /**
   * Update asset.
   */
  async update(id: string, data: UpdateAssetInput, userId: string) {
    const existing = await prisma.asset.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw ApiError.notFound('Asset not found');
    }

    // Check for duplicate serial number if changing
    if (data.serialNumber && data.serialNumber !== existing.serialNumber) {
      const duplicate = await prisma.asset.findUnique({
        where: { serialNumber: data.serialNumber },
      });
      if (duplicate) {
        throw ApiError.conflict('Asset with this serial number already exists');
      }
    }

    // Verify client if changing
    if (data.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: data.clientId, deletedAt: null },
      });
      if (!client) {
        throw ApiError.notFound('Client not found');
      }
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        serialNumber: data.serialNumber,
        model: data.model,
        manufacturer: data.manufacturer,
        description: data.description,
        installDate: data.installDate,
        warrantyExpiry: data.warrantyExpiry,
        clientId: data.clientId,
        isActive: data.isActive,
        notes: data.notes,
      },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.ASSET_UPDATED,
      entity: AUDIT_ENTITIES.ASSET,
      entityId: id,
      metadata: { changes: data },
    });

    return asset;
  }

  /**
   * Link asset to contract.
   */
  async linkToContract(contractId: string, assetId: string, userId: string) {
    // Verify contract exists
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
    });
    if (!contract) {
      throw ApiError.notFound('Contract not found');
    }

    // Verify asset exists
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, deletedAt: null },
    });
    if (!asset) {
      throw ApiError.notFound('Asset not found');
    }

    // Check for duplicate link
    const existingLink = await prisma.contractAsset.findUnique({
      where: {
        contractId_assetId: { contractId, assetId },
      },
    });

    if (existingLink) {
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
  async unlinkFromContract(contractId: string, assetId: string, userId: string) {
    const existingLink = await prisma.contractAsset.findUnique({
      where: {
        contractId_assetId: { contractId, assetId },
      },
    });

    if (!existingLink) {
      throw ApiError.notFound('Asset is not linked to this contract');
    }

    await prisma.contractAsset.delete({
      where: {
        contractId_assetId: { contractId, assetId },
      },
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

  /**
   * Get asset service history.
   * This is primarily a read operation.
   * Visits/tickets from other domains would be accessed via service interfaces.
   */
  async getServiceHistory(assetId: string) {
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, deletedAt: null },
    });

    if (!asset) {
      throw ApiError.notFound('Asset not found');
    }

    // Get contracts this asset has been part of
    const contractAssets = await prisma.contractAsset.findMany({
      where: { assetId },
      include: {
        contract: {
          select: {
            id: true,
            contractNumber: true,
            status: true,
            startDate: true,
            endDate: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      asset: {
        id: asset.id,
        serialNumber: asset.serialNumber,
        model: asset.model,
        manufacturer: asset.manufacturer,
      },
      contracts: contractAssets.map((ca) => ca.contract),
      // Visits and tickets would come from Person 3's services
      // Use service interfaces when available
    };
  }
}

export const assetService = new AssetService();
