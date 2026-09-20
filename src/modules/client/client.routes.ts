import { Router } from 'express';
import { clientController } from './client.controller';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  createClientSchema,
  updateClientSchema,
  listClientsQuerySchema,
  clientIdParamSchema,
  createContactSchema,
  updateContactSchema,
  contactIdParamSchema,
  createSiteSchema,
  updateSiteSchema,
  siteIdParamSchema,
} from './client.validator';

const router = Router();

// ===========================================
// CLIENT ROUTES
// ===========================================

/**
 * @route   POST /clients
 * @desc    Create a new client
 * @access  Admin, Manager, Sales
 */
router.post(
  '/',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(createClientSchema),
  asyncHandler(clientController.create)
);

/**
 * @route   GET /clients
 * @desc    List clients with pagination and filters
 * @access  Admin, Manager, Sales
 */
router.get(
  '/',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(listClientsQuerySchema, 'query'),
  asyncHandler(clientController.list)
);

/**
 * @route   GET /clients/:id
 * @desc    Get client by ID
 * @access  Admin, Manager, Sales
 */
router.get(
  '/:id',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(clientIdParamSchema, 'params'),
  asyncHandler(clientController.getById)
);

/**
 * @route   PATCH /clients/:id
 * @desc    Update client
 * @access  Admin, Manager, Sales
 */
router.patch(
  '/:id',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(clientIdParamSchema, 'params'),
  validate(updateClientSchema),
  asyncHandler(clientController.update)
);

/**
 * @route   DELETE /clients/:id
 * @desc    Delete client (soft delete)
 * @access  Admin, Manager
 */
router.delete(
  '/:id',
  auth,
  role(['ADMIN', 'MANAGER']),
  validate(clientIdParamSchema, 'params'),
  asyncHandler(clientController.delete)
);

/**
 * @route   GET /clients/:id/history
 * @desc    Get client history timeline
 * @access  Admin, Manager, Sales
 */
router.get(
  '/:id/history',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(clientIdParamSchema, 'params'),
  asyncHandler(clientController.getHistory)
);

// ===========================================
// CONTACT ROUTES (nested under /clients for clarity, but also accessible directly)
// ===========================================

/**
 * @route   POST /contacts
 * @desc    Create a contact for a client
 * @access  Admin, Manager, Sales
 */
router.post(
  '/contacts',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(createContactSchema),
  asyncHandler(clientController.createContact)
);

/**
 * @route   GET /contacts/:id
 * @desc    Get contact by ID
 * @access  Admin, Manager, Sales
 */
router.get(
  '/contacts/:id',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(contactIdParamSchema, 'params'),
  asyncHandler(clientController.getContactById)
);

/**
 * @route   PATCH /contacts/:id
 * @desc    Update contact
 * @access  Admin, Manager, Sales
 */
router.patch(
  '/contacts/:id',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(contactIdParamSchema, 'params'),
  validate(updateContactSchema),
  asyncHandler(clientController.updateContact)
);

/**
 * @route   DELETE /contacts/:id
 * @desc    Delete contact
 * @access  Admin, Manager
 */
router.delete(
  '/contacts/:id',
  auth,
  role(['ADMIN', 'MANAGER']),
  validate(contactIdParamSchema, 'params'),
  asyncHandler(clientController.deleteContact)
);

// ===========================================
// SITE ROUTES
// ===========================================

/**
 * @route   POST /sites
 * @desc    Create a site for a client
 * @access  Admin, Manager, Sales
 */
router.post(
  '/sites',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(createSiteSchema),
  asyncHandler(clientController.createSite)
);

/**
 * @route   GET /sites/:id
 * @desc    Get site by ID
 * @access  Admin, Manager, Sales
 */
router.get(
  '/sites/:id',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(siteIdParamSchema, 'params'),
  asyncHandler(clientController.getSiteById)
);

/**
 * @route   GET /sites/:id/assets
 * @desc    Get assets for a site
 * @access  Admin, Manager, Sales
 */
router.get(
  '/sites/:id/assets',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(siteIdParamSchema, 'params'),
  asyncHandler(clientController.getSiteAssets)
);

/**
 * @route   PATCH /sites/:id
 * @desc    Update site
 * @access  Admin, Manager, Sales
 */
router.patch(
  '/sites/:id',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(siteIdParamSchema, 'params'),
  validate(updateSiteSchema),
  asyncHandler(clientController.updateSite)
);

/**
 * @route   DELETE /sites/:id
 * @desc    Delete site
 * @access  Admin, Manager
 */
router.delete(
  '/sites/:id',
  auth,
  role(['ADMIN', 'MANAGER']),
  validate(siteIdParamSchema, 'params'),
  asyncHandler(clientController.deleteSite)
);

export default router;
