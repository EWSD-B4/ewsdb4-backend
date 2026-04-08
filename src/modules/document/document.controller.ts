import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import documentService from './document.service';
import { successResponse } from '@/utils/response';

class DocumentController {
  uploadContributionFile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'No file uploaded',
        requestId: req.requestId || 'unknown',
      });
    }

    const userId = parseInt(String(req.user!.id), 10);
    const contributionId = parseInt(String(req.params.contributionId), 10);
    const fileType = (req.body.fileType || 'docx') as 'docx' | 'image';

    const file = await documentService.uploadContributionFile(
      contributionId,
      userId,
      req.file,
      fileType
    );

    return res.status(201).json(
      successResponse(file, req.requestId || 'unknown', {
        message: `${fileType.toUpperCase()} file uploaded successfully${fileType === 'docx' ? ' and queued for processing' : ''}`,
      })
    );
  });

  getContributionFiles = asyncHandler(async (req: Request, res: Response) => {
    const contributionId = parseInt(String(req.params.contributionId), 10);

    const files = await documentService.getContributionFiles(contributionId);

    res.json(
      successResponse(
        { files },
        req.requestId || 'unknown',
        { message: 'Contribution files retrieved successfully' }
      )
    );
  });

  getContributionFileById = asyncHandler(async (req: Request, res: Response) => {
    const fileId = parseInt(String(req.params.fileId), 10);

    const file = await documentService.getContributionFileById(fileId);

    if (!file) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'File not found',
        requestId: req.requestId || 'unknown',
      });
    }

    return res.json(
      successResponse(file, req.requestId || 'unknown', {
        message: 'File retrieved successfully',
      })
    );
  });

  downloadContributionFile = asyncHandler(async (req: Request, res: Response) => {
    const fileId = parseInt(String(req.params.fileId), 10);

    const { buffer, file } = await documentService.downloadContributionFile(fileId);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  });

  getDownloadUrl = asyncHandler(async (req: Request, res: Response) => {
    const fileId = parseInt(String(req.params.fileId), 10);
    const expiresIn = parseInt((req.query.expiresIn as string) || '3600', 10);

    const downloadUrl = await documentService.getDownloadUrl(fileId, expiresIn);

    res.json(
      successResponse(
        {
          downloadUrl,
          expiresIn,
        },
        req.requestId || 'unknown',
        { message: 'Download URL generated successfully' }
      )
    );
  });

  downloadByContributionId = asyncHandler(async (req: Request, res: Response) => {
    const contributionId = parseInt(String(req.params.contributionId), 10);

    const { buffer, file } = await documentService.downloadByContributionId(contributionId);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  });

  getDownloadUrlByContributionId = asyncHandler(async (req: Request, res: Response) => {
    const contributionId = parseInt(String(req.params.contributionId), 10);
    const expiresIn = parseInt((req.query.expiresIn as string) || '3600', 10);

    const downloadUrl = await documentService.getDownloadUrlByContributionId(contributionId, expiresIn);

    res.json(
      successResponse(
        { downloadUrl, expiresIn },
        req.requestId || 'unknown',
        { message: 'Download URL generated successfully' }
      )
    );
  });

  deleteContributionFile = asyncHandler(async (req: Request, res: Response) => {
    const fileId = parseInt(String(req.params.fileId), 10);

    await documentService.deleteContributionFile(fileId);

    res.json(
      successResponse({ success: true }, req.requestId || 'unknown', {
        message: 'File deleted successfully',
      })
    );
  });

}

export default new DocumentController();
