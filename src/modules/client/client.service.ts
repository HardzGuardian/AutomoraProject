import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { auditService } from '../audit/audit.service';
import { PAGINATION, AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../config/constants';
import {
  CreateClientInput,
  UpdateClientInput,
  ListClientsQuery,
  CreateContactInput,
  UpdateContactInput,
  CreateSiteInput,
  UpdateSiteInput,
} from './client.validator';
import { Prisma, UserRole } from '@prisma/client';

export class ClientService {
  // ===========================================
  // CLIENT CRUD
  // ===========================================

  /**
   * Create a new client.
   */
  async create(data: CreateClientInput, userId: string) {
    const client = await prisma.client.create({
      data: {
        companyName: data.companyName,
        industry: data.industry,
        category: data.category as any,
        taxId: data.taxId,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        phone: data.phone,
        email: data.email,
        notes: data.notes,
        assignedToId: data.assignedToId,
      },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.CLIENT_CREATED,
      entity: AUDIT_ENTITIES.CLIENT,
      entityId: client.id,
      metadata: { companyName: client.companyName, category: client.category },
    });

    return client;
  }

  /**
   * List clients with pagination and filters.
   */
  async list(query: ListClientsQuery, userRole: UserRole, userId: string) {
    const { page, limit, search, category, isActive, assignedToId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ClientWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { taxId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category as any;
    }

    if (isActive !== undefined) {
      // All clients are active by default (no isActive field on Client model)
      // This filter is available for future use
    }

    // UNRESOLVED DECISION: Sales access scoping
    // If SALES role should only see assigned clients, uncomment:
    // if (userRole === 'SALES') {
    //   where.assignedToId = userId;
    // }
    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          contacts: {
            where: { isPrimary: true },
            select: { id: true, name: true, phone: true, email: true },
            take: 1,
          },
          _count: {
            select: { contracts: true, sites: true, assets: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.client.count({ where }),
    ]);

    return {
      clients,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get client by ID with related data.
   */
  async getById(id: string) {
    const client = await prisma.client.findFirst({
      where: { id, deletedAt: null },
      include: {
        contacts: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        sites: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { contracts: true, assets: true },
        },
      },
    });

    if (!client) {
      throw ApiError.notFound('Client not found');
    }

    return client;
  }

  /**
   * Update client.
   */
  async update(id: string, data: UpdateClientInput, userId: string) {
    const existing = await prisma.client.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw ApiError.notFound('Client not found');
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...data,
        category: data.category as any,
      },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.CLIENT_UPDATED,
      entity: AUDIT_ENTITIES.CLIENT,
      entityId: id,
      metadata: { changes: data },
    });

    return client;
  }

  /**
   * Soft delete client.
   */
  async delete(id: string, userId: string) {
    const existing = await prisma.client.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw ApiError.notFound('Client not found');
    }

    // Check for active contracts
    const activeContracts = await prisma.contract.count({
      where: {
        clientId: id,
        status: { in: ['ACTIVE', 'EXPIRING_SOON'] },
      },
    });

    if (activeContracts > 0) {
      throw ApiError.badRequest(
        'Cannot delete client with active contracts. Cancel contracts first.'
      );
    }

    await prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.CLIENT_DELETED,
      entity: AUDIT_ENTITIES.CLIENT,
      entityId: id,
      metadata: { companyName: existing.companyName },
    });
  }

  // ===========================================
  // CLIENT HISTORY
  // ===========================================

  /**
   * Get client history timeline.
   * Aggregates contracts, and placeholders for visits/invoices/tickets
   * from other domains.
   */
  async getHistory(clientId: string) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
    });

    if (!client) {
      throw ApiError.notFound('Client not found');
    }

    // Get contracts
    const contracts = await prisma.contract.findMany({
      where: { clientId },
      select: {
        id: true,
        contractNumber: true,
        status: true,
        startDate: true,
        endDate: true,
        value: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Note: Visits, invoices, tickets belong to other team members
    // Use service interfaces when available
    // For now, return contracts as the primary history

    return {
      client: {
        id: client.id,
        companyName: client.companyName,
      },
      contracts,
      // These would come from other services when available:
      // visits: [],
      // invoices: [],
      // tickets: [],
    };
  }

  // ===========================================
  // CONTACTS
  // ===========================================

  /**
   * Create a contact for a client.
   */
  async createContact(data: CreateContactInput, userId: string) {
    // Verify client exists
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, deletedAt: null },
    });

    if (!client) {
      throw ApiError.notFound('Client not found');
    }

    // If marking as primary, unset other primary contacts
    if (data.isPrimary) {
      await prisma.clientContact.updateMany({
        where: { clientId: data.clientId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.clientContact.create({
      data: {
        clientId: data.clientId,
        name: data.name,
        role: data.role,
        phone: data.phone,
        email: data.email,
        isPrimary: data.isPrimary ?? false,
      },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.CONTACT_CREATED,
      entity: AUDIT_ENTITIES.CLIENT_CONTACT,
      entityId: contact.id,
      metadata: { clientId: data.clientId, name: contact.name },
    });

    return contact;
  }

  /**
   * Get contact by ID.
   */
  async getContactById(id: string) {
    const contact = await prisma.clientContact.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, companyName: true },
        },
      },
    });

    if (!contact) {
      throw ApiError.notFound('Contact not found');
    }

    return contact;
  }

  /**
   * Update contact.
   */
  async updateContact(id: string, data: UpdateContactInput, userId: string) {
    const existing = await prisma.clientContact.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('Contact not found');
    }

    // If marking as primary, unset other primary contacts for the same client
    if (data.isPrimary) {
      await prisma.clientContact.updateMany({
        where: {
          clientId: existing.clientId,
          isPrimary: true,
          id: { not: id },
        },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.clientContact.update({
      where: { id },
      data,
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.CONTACT_UPDATED,
      entity: AUDIT_ENTITIES.CLIENT_CONTACT,
      entityId: id,
      metadata: { changes: data },
    });

    return contact;
  }

  /**
   * Delete contact.
   */
  async deleteContact(id: string, userId: string) {
    const existing = await prisma.clientContact.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('Contact not found');
    }

    await prisma.clientContact.delete({
      where: { id },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.CONTACT_DELETED,
      entity: AUDIT_ENTITIES.CLIENT_CONTACT,
      entityId: id,
      metadata: { clientId: existing.clientId, name: existing.name },
    });
  }

  // ===========================================
  // SITES
  // ===========================================

  /**
   * Create a site for a client.
   */
  async createSite(data: CreateSiteInput, userId: string) {
    // Verify client exists
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, deletedAt: null },
    });

    if (!client) {
      throw ApiError.notFound('Client not found');
    }

    const site = await prisma.clientSite.create({
      data: {
        clientId: data.clientId,
        siteName: data.siteName,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        phone: data.phone,
        notes: data.notes,
      },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.SITE_CREATED,
      entity: AUDIT_ENTITIES.CLIENT_SITE,
      entityId: site.id,
      metadata: { clientId: data.clientId, siteName: site.siteName },
    });

    return site;
  }

  /**
   * Get site by ID with assets.
   */
  async getSiteById(id: string) {
    const site = await prisma.clientSite.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, companyName: true },
        },
        assets: {
          include: {
            asset: {
              select: {
                id: true,
                serialNumber: true,
                model: true,
                manufacturer: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!site) {
      throw ApiError.notFound('Site not found');
    }

    return site;
  }

  /**
   * Get assets for a site.
   */
  async getSiteAssets(siteId: string) {
    const site = await prisma.clientSite.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw ApiError.notFound('Site not found');
    }

    const assetSites = await prisma.assetSite.findMany({
      where: { siteId },
      include: {
        asset: true,
      },
    });

    return assetSites.map((as) => as.asset);
  }

  /**
   * Update site.
   */
  async updateSite(id: string, data: UpdateSiteInput, userId: string) {
    const existing = await prisma.clientSite.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('Site not found');
    }

    const site = await prisma.clientSite.update({
      where: { id },
      data,
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.SITE_UPDATED,
      entity: AUDIT_ENTITIES.CLIENT_SITE,
      entityId: id,
      metadata: { changes: data },
    });

    return site;
  }

  /**
   * Delete site.
   */
  async deleteSite(id: string, userId: string) {
    const existing = await prisma.clientSite.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('Site not found');
    }

    // Check if site has linked assets
    const assetCount = await prisma.assetSite.count({
      where: { siteId: id },
    });

    if (assetCount > 0) {
      throw ApiError.badRequest(
        'Cannot delete site with linked assets. Unlink assets first.'
      );
    }

    await prisma.clientSite.delete({
      where: { id },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.SITE_DELETED,
      entity: AUDIT_ENTITIES.CLIENT_SITE,
      entityId: id,
      metadata: { clientId: existing.clientId, siteName: existing.siteName },
    });
  }

  // ===========================================
  // CLIENT PORTAL SCOPING
  // ===========================================

  /**
   * Verify that a client ID belongs to the authenticated client portal user.
   * For CLIENT portal users only.
   */
  async verifyClientOwnership(clientId: string, userId: string, userRole: string) {
    // Admin and Manager can access any client
    if (userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'SALES') {
      return;
    }

    // For CLIENT portal users: verify the user is associated with this client
    // This assumes CLIENT role users have a linked clientId or we check via contacts
    // UNRESOLVED DECISION: How are client portal users linked to Client records?
    // For now, CUSTOMER role users cannot access client management
    if (userRole === 'CUSTOMER') {
      throw ApiError.forbidden('Customer users cannot access client management');
    }
  }
}

export const clientService = new ClientService();
