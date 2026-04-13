import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import documentContentService from './document-content.service';
import { successResponse } from '@/utils/response';
import { AppError } from '@/middleware/errorHandler';
import { db as prisma } from '@/shared/database';
import s3Service from '@/shared/storage/s3.service';

class DocumentContentController {
  private async fetchContributionContent(contributionId: number) {
    const contribution = await prisma.contribution.findUnique({
      where: { id: contributionId },
      select: {
        title: true,
        facultyId: true,
        status: true,
        userId: true,
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        faculty: {
          select: { id: true, facultyName: true, facultyCode: true },
        },
      },
    });
    return contribution;
  }

  private async generateSignedUrlsForImages(
    images: Array<{ s3Key: string; alt?: string; title?: string }>
  ) {
    return Promise.all(
      images.map(async (image) => ({
        url: await s3Service.getSignedDownloadUrl(image.s3Key, 3600),
        s3Key: image.s3Key,
        alt: image.alt,
        title: image.title,
      }))
    );
  }

  private async replaceS3KeysWithSignedUrls(tiptapJson: any): Promise<any> {
    if (!tiptapJson) return tiptapJson;

    if (typeof tiptapJson !== 'object') {
      return tiptapJson;
    }

    if (tiptapJson.type === 'image' && tiptapJson.attrs?.src) {
      const src = tiptapJson.attrs.src;
      // Check if src is an S3 key (not already a signed URL)
      if (src && !src.startsWith('http')) {
        const signedUrl = await s3Service.getSignedDownloadUrl(src, 3600);
        return {
          ...tiptapJson,
          attrs: {
            ...tiptapJson.attrs,
            src: signedUrl,
          },
        };
      }
    }

    if (Array.isArray(tiptapJson.content)) {
      return {
        ...tiptapJson,
        content: await Promise.all(
          tiptapJson.content.map((child: any) => this.replaceS3KeysWithSignedUrls(child))
        ),
      };
    }

    return tiptapJson;
  }

  private async buildContentResponse(
    contributionId: number,
    contribution: NonNullable<Awaited<ReturnType<DocumentContentController['fetchContributionContent']>>>,
    contents: Awaited<ReturnType<typeof documentContentService.getByContributionId>>
  ) {
    const documents = await Promise.all(
      contents.map(async (c) => ({
        contributionFileId: c.contributionFileId,
        data: await this.replaceS3KeysWithSignedUrls(c.tiptapJson),
        uploadedImages: await this.generateSignedUrlsForImages(c.uploadedImages || []),
        extractedImages: await this.generateSignedUrlsForImages(c.extractedImages || []),
        metadata: c.metadata,
      }))
    );

    return {
      contributionId,
      title: contribution.title,
      author: {
        id: contribution.user.id,
        firstName: contribution.user.firstName,
        lastName: contribution.user.lastName,
        email: contribution.user.email,
      },
      faculty: {
        id: contribution.faculty.id,
        facultyName: contribution.faculty.facultyName,
        facultyCode: contribution.faculty.facultyCode,
      },
      documents,
    };
  }
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

    const contribution = await prisma.contribution.findUnique({
      where: { id: content.contributionId },
      select: { title: true },
    });

    res.json(
      successResponse(
        {
          contributionFileId: content.contributionFileId,
          contributionId: content.contributionId,
          title: contribution?.title ?? null,
          content: await this.replaceS3KeysWithSignedUrls(content.tiptapJson),
          uploadedImages: await this.generateSignedUrlsForImages(content.uploadedImages || []),
          extractedImages: await this.generateSignedUrlsForImages(content.extractedImages || []),
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
    const contribution = await this.fetchContributionContent(contributionId);
    if (!contribution) {
      throw new AppError('Contribution not found', 404, 'NOT_FOUND');
    }
    const contents = await documentContentService.getByContributionId(contributionId);
    res.json(
      successResponse(
        await this.buildContentResponse(contributionId, contribution, contents),
        req.requestId || 'unknown',
        { message: `Found ${contents.length} document(s)` }
      )
    );
  });

  getForStudent = asyncHandler(async (req: Request, res: Response) => {
    const contributionId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(contributionId)) {
      throw new AppError('Invalid contribution ID', 400, 'VALIDATION_ERROR');
    }
    const contribution = await this.fetchContributionContent(contributionId);
    if (!contribution) {
      throw new AppError('Contribution not found', 404, 'NOT_FOUND');
    }
    const requesterId = parseInt(String(req.user?.id), 10);
    if (contribution.userId !== requesterId) {
      throw new AppError('Access denied: you can only view your own contribution content', 403, 'FORBIDDEN');
    }
    const contents = await documentContentService.getByContributionId(contributionId);
    res.json(
      successResponse(
        await this.buildContentResponse(contributionId, contribution, contents),
        req.requestId || 'unknown',
        { message: `Found ${contents.length} document(s)` }
      )
    );
  });

  getForCoordinator = asyncHandler(async (req: Request, res: Response) => {
    const contributionId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(contributionId)) {
      throw new AppError('Invalid contribution ID', 400, 'VALIDATION_ERROR');
    }
    const contribution = await this.fetchContributionContent(contributionId);
    if (!contribution) {
      throw new AppError('Contribution not found', 404, 'NOT_FOUND');
    }
    const userFacultyId = req.user?.facultyId ? parseInt(String(req.user.facultyId), 10) : null;
    if (contribution.facultyId !== userFacultyId) {
      throw new AppError('Access denied: contribution does not belong to your faculty', 403, 'FORBIDDEN');
    }
    const contents = await documentContentService.getByContributionId(contributionId);
    res.json(
      successResponse(
        await this.buildContentResponse(contributionId, contribution, contents),
        req.requestId || 'unknown',
        { message: `Found ${contents.length} document(s)` }
      )
    );
  });

  getForGuest = asyncHandler(async (req: Request, res: Response) => {
    const contributionId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(contributionId)) {
      throw new AppError('Invalid contribution ID', 400, 'VALIDATION_ERROR');
    }
    const contribution = await this.fetchContributionContent(contributionId);
    if (!contribution) {
      throw new AppError('Contribution not found', 404, 'NOT_FOUND');
    }
    if (contribution.status !== 'selected') {
      throw new AppError('Access denied: only selected contributions are accessible', 403, 'FORBIDDEN');
    }
    const userFacultyId = req.user?.facultyId ? parseInt(String(req.user.facultyId), 10) : null;
    if (contribution.facultyId !== userFacultyId) {
      throw new AppError('Access denied: contribution does not belong to your faculty', 403, 'FORBIDDEN');
    }
    const contents = await documentContentService.getByContributionId(contributionId);
    res.json(
      successResponse(
        await this.buildContentResponse(contributionId, contribution, contents),
        req.requestId || 'unknown',
        { message: `Found ${contents.length} document(s)` }
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

    const userRole = req.user?.role as string;
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      const contribution = await prisma.contribution.findUnique({
        where: { id: contributionId },
        select: { userId: true, facultyId: true, status: true },
      });
      if (!contribution) {
        throw new AppError('Contribution not found', 404, 'NOT_FOUND');
      }
      const requesterId = parseInt(String(req.user?.id), 10);
      const userFacultyId = req.user?.facultyId ? parseInt(String(req.user.facultyId), 10) : null;
      if (userRole === 'STUDENT') {
        if (contribution.userId !== requesterId) {
          throw new AppError('Access denied: you can only view your own contribution content', 403, 'FORBIDDEN');
        }
      } else if (userRole === 'COORDINATOR') {
        if (contribution.facultyId !== userFacultyId) {
          throw new AppError('Access denied: contribution does not belong to your faculty', 403, 'FORBIDDEN');
        }
      } else if (userRole === 'GUEST') {
        if (contribution.status !== 'selected') {
          throw new AppError('Access denied: only selected contributions are accessible', 403, 'FORBIDDEN');
        }
        if (contribution.facultyId !== userFacultyId) {
          throw new AppError('Access denied: contribution does not belong to your faculty', 403, 'FORBIDDEN');
        }
      }
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
