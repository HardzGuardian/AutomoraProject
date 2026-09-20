/**
 * Shared test utilities and mock data
 */
import { PrismaClient } from '@prisma/client';

// Mock Prisma for unit tests
export const mockPrisma = {
  client: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  clientContact: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  clientSite: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  asset: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  assetSite: {
    findMany: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  contract: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  contractAsset: {
    findUnique: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
  },
  contractDocument: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  contractSLA: {
    findUnique: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  serviceType: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  renewal: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  renewalFollowUp: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  reminderLog: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  uploadedFile: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

// Mock audit service
export const mockAuditService = {
  log: jest.fn(),
  logSimple: jest.fn(),
};

// Test data factories
export const createMockClient = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  companyName: 'Test Corp',
  industry: 'Technology',
  category: 'CORPORATE',
  taxId: 'GST123456',
  address: '123 Test Street',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  phone: '+911234567890',
  email: 'contact@testcorp.com',
  notes: null,
  assignedToId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

export const createMockContract = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440001',
  contractNumber: 'AMC-2024-001',
  clientId: '550e8400-e29b-41d4-a716-446655440000',
  type: 'COMPREHENSIVE',
  status: 'DRAFT',
  serviceTypeId: null,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  renewalDate: new Date('2024-12-01'),
  value: 100000,
  paymentTerms: 'Annual',
  billingFrequency: 'ANNUAL',
  includedVisits: 12,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

export const createMockAsset = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440002',
  serialNumber: 'SN-001',
  model: 'AC-Unit-X1',
  manufacturer: 'CoolTech',
  description: 'Air conditioning unit',
  installDate: new Date('2024-01-15'),
  warrantyExpiry: new Date('2025-01-15'),
  isActive: true,
  notes: null,
  clientId: '550e8400-e29b-41d4-a716-446655440000',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

export const createMockServiceType = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440003',
  name: 'Annual Maintenance',
  description: 'Full annual maintenance contract',
  estimatedDuration: 60,
  basePrice: 5000,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockRenewal = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440004',
  contractId: '550e8400-e29b-41d4-a716-446655440001',
  status: 'PENDING',
  quotesSent: 0,
  lastContactDate: null,
  outcomeNotes: null,
  renewedValue: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Mock Express request/response/next
export const createMockReq = (overrides: any = {}) => ({
  params: {},
  query: {},
  body: {},
  user: {
    id: '550e8400-e29b-41d4-a716-446655440099',
    email: 'admin@test.com',
    role: 'ADMIN',
  },
  ip: '127.0.0.1',
  headers: { 'user-agent': 'test' },
  ...overrides,
});

export const createMockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

export const createMockNext = () => jest.fn();
