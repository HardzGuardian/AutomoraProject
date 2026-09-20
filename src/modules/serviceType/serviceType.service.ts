import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { auditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../config/constants';
import {
  CreateServiceTypeInput,
  UpdateServiceTypeInput,
  ListServiceTypesQuery,
} from './serviceType.validator';
import { Prisma } from '@prisma/client';

export class ServiceTypeService {
  /**
   * Create a new service type.
   */
  async create(data: CreateServiceTypeInput, userId: string) {
    // Check for duplicate name
    const existing = await prisma.serviceType.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw ApiError.conflict('Service type with this name already exists');
    }

    const serviceType = await prisma.serviceType.create({
      data: {
        name: data.name,
        description: data.description,
        estimatedDuration: data.estimatedDuration,
        basePrice: data.basePrice,
      },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.SERVICE_TYPE_CREATED,
      entity: AUDIT_ENTITIES.SERVICE_TYPE,
      entityId: serviceType.id,
      metadata: { name: serviceType.name },
    });

    return serviceType;
  }

  /**
   * List service types with pagination and filters.
   */
  async list(query: ListServiceTypesQuery) {
    const { page, limit, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceTypeWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [serviceTypes, total] = await Promise.all([
      prisma.serviceType.findMany({
        where,
        include: {
          _count: {
            select: { contracts: true },
          },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.serviceType.count({ where }),
    ]);

    return {
      serviceTypes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get service type by ID.
   */
  async getById(id: string) {
    const serviceType = await prisma.serviceType.findUnique({
      where: { id },
      include: {
        _count: {
          select: { contracts: true },
        },
      },
    });

    if (!serviceType) {
      throw ApiError.notFound('Service type not found');
    }

    return serviceType;
  }

  /**
   * Update service type.
   */
  async update(id: string, data: UpdateServiceTypeInput, userId: string) {
    const existing = await prisma.serviceType.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('Service type not found');
    }

    // Check for duplicate name if changing
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.serviceType.findUnique({
        where: { name: data.name },
      });
      if (duplicate) {
        throw ApiError.conflict('Service type with this name already exists');
      }
    }

    const serviceType = await prisma.serviceType.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        estimatedDuration: data.estimatedDuration,
        basePrice: data.basePrice,
        isActive: data.isActive,
      },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.SERVICE_TYPE_UPDATED,
      entity: AUDIT_ENTITIES.SERVICE_TYPE,
      entityId: id,
      metadata: { changes: data },
    });

    return serviceType;
  }

  /**
   * Delete service type.
   */
  async delete(id: string, userId: string) {
    const existing = await prisma.serviceType.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('Service type not found');
    }

    // Check if service type is in use
    const contractCount = await prisma.contract.count({
      where: { serviceTypeId: id, deletedAt: null },
    });

    if (contractCount > 0) {
      throw ApiError.badRequest(
        'Cannot delete service type that is in use by contracts. Deactivate it instead.'
      );
    }

    await prisma.serviceType.delete({
      where: { id },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.SERVICE_TYPE_DELETED,
      entity: AUDIT_ENTITIES.SERVICE_TYPE,
      entityId: id,
      metadata: { name: existing.name },
    });
  }
}

export const serviceTypeService = new ServiceTypeService();
