import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ResponseHelper } from '../../utils/response';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../config/constants';
import { auditService } from '../audit/audit.service';
import { exportInvoicePdf } from '../export/exportPdf';
import { invoiceService } from './invoice.service';
import { InvoiceActor, ListInvoicesQuery } from './invoice.types';

function actorFromRequest(req: Request): InvoiceActor {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  return req.user as InvoiceActor;
}

export class InvoiceController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await invoiceService.list(req.query as unknown as ListInvoicesQuery, actorFromRequest(req));
      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.getById(req.params.id, actorFromRequest(req));
      ResponseHelper.success(res, invoice);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.create(req.body, actorFromRequest(req));
      ResponseHelper.success(res, invoice, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.update(
        req.params.id,
        req.body,
        actorFromRequest(req)
      );
      ResponseHelper.success(res, invoice);
    } catch (error) {
      next(error);
    }
  }

  async markOverdue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.markOverdue(
        req.params.id,
        actorFromRequest(req)
      );
      ResponseHelper.success(res, invoice);
    } catch (error) {
      next(error);
    }
  }

  async pdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.getByIdForPdf(
        req.params.id,
        actorFromRequest(req)
      );
      const pdf = exportInvoicePdf(invoice);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${invoice.invoiceNumber}.pdf"`
      );
      res.send(pdf);
      await auditService.log({
        userId: req.user?.id,
        action: AUDIT_ACTIONS.REPORT_EXPORTED,
        entity: AUDIT_ENTITIES.INVOICE,
        entityId: invoice.id,
        metadata: { format: 'PDF' },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const invoiceController = new InvoiceController();

