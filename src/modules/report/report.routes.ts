import { Router } from 'express';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { reportController } from './report.controller';
import { reportPeriodSchema } from './report.validator';

const router = Router();
const financeReportRoles = ['ADMIN', 'MANAGER', 'SALES'] as const;
const managerRoles = ['ADMIN', 'MANAGER'] as const;

router.get('/revenue-by-client', auth, role([...financeReportRoles]), validate(reportPeriodSchema, 'query'), asyncHandler(reportController.revenueByClient));
router.get('/revenue-by-contract', auth, role([...financeReportRoles]), validate(reportPeriodSchema, 'query'), asyncHandler(reportController.revenueByContract));
router.get('/revenue-by-period', auth, role([...financeReportRoles]), validate(reportPeriodSchema, 'query'), asyncHandler(reportController.revenueByPeriod));
router.get('/revenue-by-branch', auth, role([...managerRoles]), validate(reportPeriodSchema, 'query'), asyncHandler(reportController.revenueByBranch));
router.get('/technician-performance', auth, role([...managerRoles]), validate(reportPeriodSchema, 'query'), asyncHandler(reportController.technicianPerformance));
router.get('/operational', auth, role([...managerRoles]), validate(reportPeriodSchema, 'query'), asyncHandler(reportController.operational));

router.get('/export/pdf/:type', auth, role([...financeReportRoles]), validate(reportPeriodSchema, 'query'), asyncHandler(reportController.exportPdf));
router.get('/export/excel/:type', auth, role([...financeReportRoles]), validate(reportPeriodSchema, 'query'), asyncHandler(reportController.exportExcel));

export default router;