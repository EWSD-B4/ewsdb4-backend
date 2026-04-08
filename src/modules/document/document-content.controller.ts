import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import documentContentService from './document-content.service';
import { successResponse } from '@/utils/response';
import { AppError } from '@/middleware/errorHandler';

class DocumentContentController {
  /**
   * Get TipTap JSON content by contribution file ID
   * GET /api/v1/documents/content/:contributionFileId
   */
  getByContributionFileId = asyncHandler(async (req: Request, res: Response) => {
    const contributionFileId = parseInt(String(req.params.contributionFileId), 10);

    if (!Number.isFinite(contributionFileId)) {
      throw new AppError('Invalid contribution file ID', 400, 'VALIDATION_ERROR');
    }

    const content = await documentContentService.getByContributionFileId(contributionFileId);

    if (!content) {
      res.status(404).json({
        success: false,
        message: 'Document content not found. It may not have been processed yet.',
      });
      return;
    }

    res.json(
      successResponse(
        {
          contributionFileId: content.contributionFileId,
          contributionId: content.contributionId,
          content: content.tiptapJson,
          uploadedImages: content.uploadedImages || [],
          extractedImages: content.extractedImages || [],
          metadata: content.metadata,
        },
        req.requestId || 'unknown',
        {
          message: 'Document content retrieved successfully',
        }
      )
    );
  });

  /**
   * Get TipTap JSON content by contribution ID
   * GET /api/v1/documents/content/contribution/:contributionId
   */
  getByContributionId = asyncHandler(async (req: Request, res: Response) => {
    const contributionId = parseInt(String(req.params.contributionId), 10);

    if (!Number.isFinite(contributionId)) {
      throw new AppError('Invalid contribution ID', 400, 'VALIDATION_ERROR');
    }

    const contents = await documentContentService.getByContributionId(contributionId);

    res.json(
      successResponse(
        {
          contributionId,
          documents: contents.map((content) => ({
            contributionFileId: content.contributionFileId,
            data: content.tiptapJson,
            uploadedImages: content.uploadedImages || [],
            extractedImages: content.extractedImages || [],
            metadata: content.metadata,
          })),
        },
        req.requestId || 'unknown',
        {
          message: `Found ${contents.length} document(s)`,
        }
      )
    );
  });

  /**
   * Get aggregated statistics for all documents of a contribution
   * GET /api/v1/documents/content/contribution/:contributionId/stats
   */
  getStatsByContributionId = asyncHandler(async (req: Request, res: Response) => {
    const contributionId = parseInt(String(req.params.contributionId), 10);

    if (!Number.isFinite(contributionId)) {
      throw new AppError('Invalid contribution ID', 400, 'VALIDATION_ERROR');
    }

    const stats = await documentContentService.getStatisticsByContributionId(contributionId);

    res.json(
      successResponse(stats, req.requestId || 'unknown', {
        message: 'Document statistics retrieved successfully',
      })
    );
  });

  /**
   * Get document statistics
   * GET /api/v1/documents/content/:contributionFileId/stats
   */
  getStatistics = asyncHandler(async (req: Request, res: Response) => {
    const contributionFileId = parseInt(String(req.params.contributionFileId), 10);

    if (!Number.isFinite(contributionFileId)) {
      throw new AppError('Invalid contribution file ID', 400, 'VALIDATION_ERROR');
    }

    const stats = await documentContentService.getStatistics(contributionFileId);

    res.json(
      successResponse(stats, req.requestId || 'unknown', {
        message: 'Document statistics retrieved successfully',
      })
    );
  });
}

export default new DocumentContentController();
