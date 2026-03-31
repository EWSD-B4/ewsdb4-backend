import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import plagiarismService from '../../services/plagiarism.service';
import { db } from '@/shared/database';
import { successResponse } from '@/utils/response';
import { NotFoundError, BadRequestError } from '@/shared/errors/AppError';

class PlagiarismController {
  /**
   * Get all flagged contributions
   * GET /api/v1/plagiarism/flagged
   */
  getFlaggedContributions = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const offset = parseInt(String(req.query.offset || '0'), 10);

    const [contributions, total] = await Promise.all([
      db.contribution.findMany({
        where: { status: 'flagged_plagiarism' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          faculty: {
            select: {
              id: true,
              facultyName: true,
              facultyCode: true,
            },
          },
          academicYear: {
            select: {
              id: true,
              yearName: true,
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      db.contribution.count({
        where: { status: 'flagged_plagiarism' },
      }),
    ]);

    res.json(
      successResponse(
        {
          items: contributions,
          total,
        },
        req.requestId || 'unknown',
        {
          message: 'Flagged contributions retrieved',
          pagination: { limit, offset, total },
        }
      )
    );
  });

  /**
   * Get plagiarism report for a specific contribution
   * GET /api/v1/plagiarism/report/:contributionId
   */
  getPlagiarismReport = asyncHandler(async (req: Request, res: Response) => {
    const contributionId = parseInt(String(req.params.contributionId), 10);

    if (!contributionId || isNaN(contributionId)) {
      throw new BadRequestError('Invalid contribution ID');
    }

    // Get contribution details
    const contribution = await db.contribution.findUnique({
      where: { id: contributionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        files: {
          where: { fileType: 'document' },
          select: { id: true },
        },
      },
    });

    if (!contribution) {
      throw new NotFoundError('Contribution not found');
    }

    const contributionFileId = contribution.files[0]?.id;
    if (!contributionFileId) {
      throw new NotFoundError('No document file found for this contribution');
    }

    // Get plagiarism report from service
    const report = await plagiarismService.getPlagiarismReport(contributionFileId);

    if (!report) {
      throw new NotFoundError('Plagiarism report not found');
    }

    // Get details of matched contributions
    const matchedContributionIds = report.plagiarismCheck.matches.map((m: any) => m.contributionId);
    const matchedContributions = await db.contribution.findMany({
      where: { id: { in: matchedContributionIds } },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Combine report with matched contribution details
    const enrichedMatches = report.plagiarismCheck.matches.map((match: any) => {
      const matchedContribution = matchedContributions.find((c) => c.id === match.contributionId);
      return {
        ...match,
        contribution: matchedContribution,
      };
    });

    const riskLevel = plagiarismService.getRiskLevel(report.plagiarismCheck.matches);

    res.json(
      successResponse(
        {
          contribution,
          report: {
            ...report,
            plagiarismCheck: {
              ...report.plagiarismCheck,
              matches: enrichedMatches,
            },
            riskLevel,
          },
        },
        req.requestId || 'unknown',
        {
          message: 'Plagiarism report retrieved',
        }
      )
    );
  });

  /**
   * Review plagiarism case (approve/reject)
   * POST /api/v1/plagiarism/review/:contributionId
   */
  reviewPlagiarism = asyncHandler(async (req: Request, res: Response) => {
    const contributionId = parseInt(String(req.params.contributionId), 10);
    const { decision, notes } = req.body;

    if (!contributionId || isNaN(contributionId)) {
      throw new BadRequestError('Invalid contribution ID');
    }

    if (!['approved', 'rejected'].includes(decision)) {
      throw new BadRequestError('Decision must be "approved" or "rejected"');
    }

    const contribution = await db.contribution.findUnique({
      where: { id: contributionId },
    });

    if (!contribution) {
      throw new NotFoundError('Contribution not found');
    }

    if (contribution.status !== 'flagged_plagiarism') {
      throw new BadRequestError('Contribution is not flagged for plagiarism');
    }

    // Update contribution status based on decision
    const newStatus = decision === 'approved' ? 'submitted' : 'rejected';
    
    const updated = await db.contribution.update({
      where: { id: contributionId },
      data: { 
        status: newStatus,
      },
    });

    // Log the review in submission history
    await db.submissionHistory.create({
      data: {
        contributionId,
        userId: (req as any).user.id,
        action: `plagiarism_review_${decision}`,
        note: notes || `Plagiarism review: ${decision}`,
        actionDate: new Date(),
      },
    });

    res.json(
      successResponse(
        updated,
        req.requestId || 'unknown',
        {
          message: `Contribution ${decision === 'approved' ? 'approved' : 'rejected'}`,
        }
      )
    );
  });
}

export default new PlagiarismController();
