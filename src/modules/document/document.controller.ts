import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import documentService from './document.service';

class DocumentController {
  uploadDocument = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const userId = req.user!.id;
    const document = await documentService.uploadDocument(userId, req.file);

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully and queued for processing',
      data: document,
    });
  });

  getUserDocuments = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const offset = parseInt((req.query.offset as string) || '0', 10);

    const documents = await documentService.getUserDocuments(userId, limit, offset);

    res.json({
      success: true,
      data: {
        documents,
        pagination: {
          limit,
          offset,
          total: documents.length,
        },
      },
    });
  });

  getDocumentById = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const document = await documentService.getDocumentById(id, userId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }

    return res.json({
      success: true,
      data: document,
    });
  });

  downloadDocument = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const { buffer, document } = await documentService.downloadDocument(id, userId);

    res.setHeader('Content-Type', document.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  });

  getDownloadUrl = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const expiresIn = parseInt((req.query.expiresIn as string) || '3600', 10);

    const downloadUrl = await documentService.getDownloadUrl(id, userId, expiresIn);

    res.json({
      success: true,
      data: {
        downloadUrl,
        expiresIn,
      },
    });
  });

  deleteDocument = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.id;

    await documentService.deleteDocument(id, userId);

    res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  });

  getConvertedHtml = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const { buffer, document } = await documentService.getConvertedDocument(id, userId, 'html');

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="${document.originalName}.html"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  });

  getConvertedJson = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const { buffer, document } = await documentService.getConvertedDocument(id, userId, 'json');

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `inline; filename="${document.originalName}.json"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  });
}

export default new DocumentController();
