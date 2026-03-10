import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import termsService from './terms.service';
import { successResponse } from '@/utils/response';
import { validate } from '@/middleware/validate';
import { createTermsSchema, updateTermsSchema } from './terms.validation';
import { CreateTermsRequest, UpdateTermsRequest } from './terms.types';

class TermsController {
  createTerms = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = validate<CreateTermsRequest>(createTermsSchema, req.body);
    const terms = await termsService.createTerms(validatedData);

    return res.status(201).json(
      successResponse(terms, req.requestId || 'unknown', {
        message: 'Terms and conditions created successfully',
      })
    );
  });

  getAllTerms = asyncHandler(async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const terms = await termsService.getAllTerms(includeInactive);

    return res.json(
      successResponse({ terms, total: terms.length }, req.requestId || 'unknown', {
        message: 'Terms and conditions retrieved successfully',
      })
    );
  });

  getTermsById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const terms = await termsService.getTermsById(id);

    return res.json(
      successResponse(terms, req.requestId || 'unknown', {
        message: 'Terms and conditions retrieved successfully',
      })
    );
  });

  getActiveTerms = asyncHandler(async (req: Request, res: Response) => {
    const terms = await termsService.getActiveTerms();

    if (!terms) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'No active terms and conditions found',
        requestId: req.requestId || 'unknown',
      });
    }

    return res.json(
      successResponse(terms, req.requestId || 'unknown', {
        message: 'Active terms and conditions retrieved successfully',
      })
    );
  });

  updateTerms = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const validatedData = validate<UpdateTermsRequest>(updateTermsSchema, req.body);
    const terms = await termsService.updateTerms(id, validatedData);

    return res.json(
      successResponse(terms, req.requestId || 'unknown', {
        message: 'Terms and conditions updated successfully',
      })
    );
  });

  setActiveTerms = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const terms = await termsService.setActiveTerms(id);

    return res.json(
      successResponse(terms, req.requestId || 'unknown', {
        message: 'Active terms and conditions set successfully',
      })
    );
  });

  deleteTerms = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    await termsService.deleteTerms(id);

    return res.json(
      successResponse({ success: true }, req.requestId || 'unknown', {
        message: 'Terms and conditions deleted successfully',
      })
    );
  });
}

export default new TermsController();
