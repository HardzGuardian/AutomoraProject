import { Request, Response, NextFunction } from 'express';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../config/constants';
import { ApiError } from '../../utils/ApiError';
import { ResponseHelper } from '../../utils/response';
import { auditService } from '../audit/audit.service';
import { exportExcel } from '../export/exportExcel';
import { exportPdf } from '../export/exportPdf';
import { reportService } from './report.service';
import { ReportActor, ReportPeriod, RevenueReport } from './report.types';

function actorFromRequest(req: Request): ReportActor {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  return req.user as ReportActor;
}

function periodFromRequest(req: Request): ReportPeriod {
  return req.query as ReportPeriod;
}

export class ReportController {
  async revenueByClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      ResponseHelper.success(res, await reportService.revenueByClient(periodFromRequest(req), actorFromRequest(req)));
    } catch (error) {
      next(error);
    }
  }

  async revenueByContract(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      ResponseHelper.success(res, await reportService.revenueByContract(periodFromRequest(req), actorFromRequest(req)));
    } catch (error) {
      next(error);
    }
  }

  async revenueByPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      ResponseHelper.success(res, await reportService.revenueByPeriod(periodFromRequest(req), actorFromRequest(req)));
    } catch (error) {
      next(error);
    }
  }

  async revenueByBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      ResponseHelper.success(res, await reportService.revenueByBranch(periodFromRequest(req), actorFromRequest(req)));
    } catch (error) {
      next(error);
    }
  }

  async technicianPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      ResponseHelper.success(res, await reportService.technicianPerformance(periodFromRequest(req), actorFromRequest(req)));
    } catch (error) {
      next(error);
    }
  }

  async operational(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      ResponseHelper.success(res, await reportService.operational(periodFromRequest(req), actorFromRequest(req)));
    } catch (error) {
      next(error);
    }
  }

  async exportPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const type = req.params.type;
      const actor = actorFromRequest(req);
      const report = await this.reportForType(type, periodFromRequest(req), actor);
      if (!report.available) throw ApiError.unprocessable(report.reason);
      const lines = report.rows.map((row) => `${row.label}: ${row.amount}`);
      const pdf = exportPdf({ title: `Report: ${type}`, lines });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${type}.pdf"`);
      res.send(pdf);
      await this.auditExport(actor, type, 'PDF');
    } catch (error) {
      next(error);
    }
  }

  async exportExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const type = req.params.type;
      const actor = actorFromRequest(req);
      const report = await this.reportForType(type, periodFromRequest(req), actor);
      if (!report.available) throw ApiError.unprocessable(report.reason);
      const file = exportExcel({
        sheetName: type,
        columns: ['ID', 'Label', 'Amount', 'Payment count'],
        rows: report.rows.map((row) => [row.id, row.label, row.amount, row.paymentCount]),
      });
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', `attachment; filename="${type}.xls"`);
      res.send(file);
      await this.auditExport(actor, type, 'EXCEL');
    } catch (error) {
      next(error);
    }
  }

  private async reportForType(
    type: string,
    period: ReportPeriod,
    actor: ReportActor
  ): Promise<RevenueReport | { available: false; reason: string; rows: [] }> {
    switch (type) {
      case 'revenue-by-client':
        return reportService.revenueByClient(period, actor);
      case 'revenue-by-contract':
        return reportService.revenueByContract(period, actor);
      case 'revenue-by-period':
        return reportService.revenueByPeriod(period, actor);
      case 'revenue-by-branch':
        return reportService.revenueByBranch(period, actor);
      case 'technician-performance':
        return reportService.technicianPerformance(period, actor);
      default:
        throw ApiError.notFound(`Unknown report type: ${type}`);
    }
  }

  private async auditExport(actor: ReportActor, type: string, format: string): Promise<void> {
    await auditService.log({
      userId: actor.id,
      action: AUDIT_ACTIONS.REPORT_EXPORTED,
      entity: AUDIT_ENTITIES.INVOICE,
      metadata: { reportType: type, format },
    });
  }
}

export const reportController = new ReportController();