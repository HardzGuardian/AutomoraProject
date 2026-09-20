import { Router } from 'express';
import { contractController } from './contract.controller';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  createContractSchema,
  updateContractSchema,
  listContractsQuerySchema,
  contractIdParamSchema,
  contractAssetLinkSchema,
  contractAssetUnlinkParamSchema,
  contractDocumentSchema,
  contractSLASchema,
  documentIdParamSchema,
} from './contract.validator';

const router = Router();

// ===========================================
// CONTRACT ROUTES
// ===========================================

/**
 * @route   POST /contracts
 * @desc    Create a new contract
 * @access  Admin, Manager, Sales
 */
router.post(
  '/',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(createContractSchema),
  asyncHandler(contractController.create)
);

/**
 * @route   GET /contracts
 * @desc    List contracts with pagination and filters
 * @access  Admin, Manager, Sales
 */
router.get(
  '/',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(listContractsQuerySchema, 'query'),
  asyncHandler(contractController.list)
);

/**
 * @route   GET /contracts/:id
 * @desc    Get contract by ID
 * @access  Admin, Manager, Sales
 */
router.get(
  '/:id',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(contractIdParamSchema, 'params'),
  asyncHandler(contractController.getById)
);

/**
 * @route   PATCH /contracts/:id
 * @desc    Update contract
 * @access  Admin, Manager, Sales
 */
router.patch(
  '/:id',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(contractIdParamSchema, 'params'),
  validate(updateContractSchema),
  asyncHandler(contractController.update)
);

/**
 * @route   PATCH /contracts/:id/activate
 * @desc    Activate contract (DRAFT → ACTIVE)
 * @access  Admin, Manager
 */
router.patch(
  '/:id/activate',
  auth,
  role(['ADMIN', 'MANAGER']),
  validate(contractIdParamSchema, 'params'),
  asyncHandler(contractController.activate)
);

/**
 * @route   PATCH /contracts/:id/cancel
 * @desc    Cancel contract
 * @access  Admin, Manager
 */
router.patch(
  '/:id/cancel',
  auth,
  role(['ADMIN', 'MANAGER']),
  validate(contractIdParamSchema, 'params'),
  asyncHandler(contractController.cancel)
);

// ===========================================
// CONTRACT ASSETS
// ===========================================

/**
 * @route   POST /contracts/:id/assets
 * @desc    Link asset to contract
 * @access  Admin, Manager, Sales
 */
router.post(
  '/:id/assets',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(contractIdParamSchema, 'params'),
  validate(contractAssetLinkSchema),
  asyncHandler(contractController.linkAsset)
);

/**
 * @route   DELETE /contracts/:id/assets/:assetId
 * @desc    Unlink asset from contract
 * @access  Admin, Manager, Sales
 */
router.delete(
  '/:id/assets/:assetId',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(contractAssetUnlinkParamSchema, 'params'),
  asyncHandler(contractController.unlinkAsset)
);

// ===========================================
// CONTRACT DOCUMENTS
// ===========================================

/**
 * @route   POST /contracts/:id/documents
 * @desc    Add document to contract
 * @access  Admin, Manager, Sales
 */
router.post(
  '/:id/documents',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(contractIdParamSchema, 'params'),
  validate(contractDocumentSchema),
  asyncHandler(contractController.addDocument)
);

/**
 * @route   GET /contracts/:id/documents
 * @desc    List contract documents
 * @access  Admin, Manager, Sales
 */
router.get(
  '/:id/documents',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(contractIdParamSchema, 'params'),
  asyncHandler(contractController.listDocuments)
);

/**
 * @route   DELETE /contracts/:id/documents/:docId
 * @desc    Remove document from contract
 * @access  Admin, Manager
 */
router.delete(
  '/:id/documents/:docId',
  auth,
  role(['ADMIN', 'MANAGER']),
  validate(documentIdParamSchema, 'params'),
  asyncHandler(contractController.removeDocument)
);

// ===========================================
// CONTRACT SLA
// ===========================================

/**
 * @route   GET /contracts/:id/sla
 * @desc    Get contract SLA
 * @access  Admin, Manager, Sales
 */
router.get(
  '/:id/sla',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(contractIdParamSchema, 'params'),
  asyncHandler(contractController.getSLA)
);

/**
 * @route   PUT /contracts/:id/sla
 * @desc    Create or update contract SLA
 * @access  Admin, Manager
 */
router.put(
  '/:id/sla',
  auth,
  role(['ADMIN', 'MANAGER']),
  validate(contractIdParamSchema, 'params'),
  validate(contractSLASchema),
  asyncHandler(contractController.upsertSLA)
);

export default router;
