import { db as prisma } from '@/shared/database';
import { BadRequestError, NotFoundError } from '@/shared/errors/AppError';
import s3Service from '@/shared/storage/s3.service';
import rabbitmqService from '@/shared/mq/rabbitmq.service';
import logger from '@/shared/logger';
import { Try } from '@/shared/utils/Try';
import { emailService } from '@/shared/email';

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft:              ['submitted'],
  submitted:          ['under_review'],
  under_review:       ['selected', 'rejected', 'flagged_plagiarism'],
  selected:           ['published'],
  rejected:           ['submitted'],
  flagged_plagiarism: ['submitted'],
  published:          [],
};

function assertValidTransition(from: string, to: string): void {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BadRequestError(
      `Cannot transition from '${from}' to '${to}'. Allowed next states: [${allowed.join(', ') || 'none'}]`
    );
  }
}

class ContributionService {
  private parseContributionId(id: string): number {
    const idNum = parseInt(id, 10);
    if (!Number.isFinite(idNum)) {
      throw new BadRequestError('Invalid contribution id');
    }
    return idNum;
  }

  async listCoordinatorContributions(facultyId: number, limit: number, offset: number) {
    const where = { facultyId };
    const [items, total] = await Promise.all([
      prisma.contribution.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contribution.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getCoordinatorContribution(facultyId: number, id: string) {
    const contributionId = this.parseContributionId(id);
    const contribution = await prisma.contribution.findFirst({
      where: { id: contributionId, facultyId },
    });
    if (!contribution) {
      throw new NotFoundError('Contribution not found');
    }
    return contribution;
  }

  async listGuestSelected(facultyId: number, limit: number, offset: number) {
    const where = { facultyId, status: 'selected' };
    const [items, total] = await Promise.all([
      prisma.contribution.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contribution.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getGuestSelected(id: string) {
    const contributionId = this.parseContributionId(id);
    const contribution = await prisma.contribution.findFirst({
      where: { id: contributionId, status: 'selected' },
    });
    if (!contribution) {
      throw new NotFoundError('Contribution not found');
    }
    return contribution;
  }

  async createStudentContribution(
    userId: number,
    facultyId: number,
    academicYearId: number,
    title: string,
    docxFile: Express.Multer.File,
    imageFiles: Express.Multer.File[] = []
  ) {
    return Try.execute(async () => {
      // Check academic year closure date for new submissions
      const academicYear = await prisma.academicYear.findUnique({
        where: { id: academicYearId },
      });

      if (!academicYear) {
        throw new NotFoundError('Academic year not found');
      }

      const now = new Date();
      
      // Check if new submissions are closed
      if (academicYear.closureDate && now > academicYear.closureDate) {
        throw new BadRequestError(
          `New contributions are no longer accepted for ${academicYear.yearName}. ` +
          `Closure date was ${academicYear.closureDate.toISOString().split('T')[0]}.`
        );
      }

      // Calculate comment due date (14 days from now)
      const commentDueDate = new Date();
      commentDueDate.setDate(commentDueDate.getDate() + 14);

      // Validate DOCX file
      const allowedDocxMimeTypes = [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      if (!allowedDocxMimeTypes.includes(docxFile.mimetype)) {
        throw new BadRequestError('Only DOCX files are allowed for contributions');
      }

      // Validate image files
      const allowedImageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      
      for (const imageFile of imageFiles) {
        if (!allowedImageMimeTypes.includes(imageFile.mimetype)) {
          throw new BadRequestError(`Invalid image type: ${imageFile.originalname}. Only JPEG, PNG, GIF, and WebP are allowed.`);
        }
      }

      if (imageFiles.length > 5) {
        throw new BadRequestError('Maximum 5 images allowed');
      }

      // Create all database records in a single transaction
      const { contribution, contributionFile, imageRecords } = await prisma.$transaction(async (tx) => {
        // Create contribution with submitted status
        const contribution = await tx.contribution.create({
          data: {
            userId,
            facultyId,
            academicYearId,
            title,
            status: 'submitted',
            submittedAt: new Date(),
            commentDueDate,
          },
        });

        // Create DOCX file record
        const contributionFile = await tx.contributionFile.create({
          data: {
            contributionId: contribution.id,
            fileType: 'docx',
            originalName: docxFile.originalname,
            storedName: docxFile.originalname,
            fileSize: BigInt(docxFile.size),
            isExtracted: false,
            uploadedAt: new Date(),
          },
        });

        // Create image file records
        const imageRecords = [];
        for (const imageFile of imageFiles) {
          const imageRecord = await tx.contributionFile.create({
            data: {
              contributionId: contribution.id,
              fileType: 'image',
              originalName: imageFile.originalname,
              storedName: imageFile.originalname,
              fileSize: BigInt(imageFile.size),
              isExtracted: false,
              uploadedAt: new Date(),
            },
          });
          imageRecords.push(imageRecord);
        }

        return { contribution, contributionFile, imageRecords };
      });

      logger.info(`Contribution created: ${contribution.id} by user ${userId}`);

      // Upload DOCX to S3 (outside transaction)
      const docxS3Key = `contributions/${contribution.id}/docx/${contributionFile.id}-${docxFile.originalname}`;
      await s3Service.uploadFile(docxS3Key, docxFile.buffer, docxFile.mimetype, {
        contributionId: contribution.id.toString(),
        contributionFileId: contributionFile.id.toString(),
        userId: userId.toString(),
        fileType: 'docx',
      });

      logger.info(`DOCX file uploaded to S3: ${docxS3Key}`);

      // Process and upload images (outside transaction)
      const uploadedImages = [];
      const filePathUpdates = [];
      
      // Upload all files to S3 first
      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i];
        const imageRecord = imageRecords[i];

        const imageS3Key = `contributions/${contribution.id}/images/${imageRecord.id}-${imageFile.originalname}`;
        await s3Service.uploadFile(imageS3Key, imageFile.buffer, imageFile.mimetype, {
          contributionId: contribution.id.toString(),
          contributionFileId: imageRecord.id.toString(),
          userId: userId.toString(),
          fileType: 'image',
        });

        uploadedImages.push({
          id: imageRecord.id,
          originalName: imageFile.originalname,
          filePath: imageS3Key,
          fileSize: imageFile.size,
        });

        filePathUpdates.push({
          id: imageRecord.id,
          filePath: imageS3Key,
        });

        logger.info(`Image ${i + 1}/${imageFiles.length} uploaded to S3: ${imageS3Key}`);
      }

      // Batch update all file paths in a single transaction
      await prisma.$transaction([
        prisma.contributionFile.update({
          where: { id: contributionFile.id },
          data: { filePath: docxS3Key },
        }),
        ...filePathUpdates.map(update =>
          prisma.contributionFile.update({
            where: { id: update.id },
            data: { filePath: update.filePath },
          })
        ),
      ]);

      // Publish to RabbitMQ for DOCX processing
      await rabbitmqService.publishMessage({
        contributionFileId: contributionFile.id,
        contributionId: contribution.id,
        userId,
        fileName: docxFile.originalname,
        s3Key: docxS3Key,
        contentType: docxFile.mimetype,
        fileSize: docxFile.size,
        uploadedAt: new Date().toISOString(),
      });

      logger.info(`Message published to RabbitMQ for contribution: ${contribution.id}`);

      await this.notifyFacultyCoordinatorsOnSubmission(contribution.id);

      return {
        contribution,
        docxFile: {
          id: contributionFile.id,
          originalName: docxFile.originalname,
          filePath: docxS3Key,
          fileSize: docxFile.size,
          status: 'pending',
        },
        images: uploadedImages,
      };
    }).orElseThrow('Error creating student contribution');
  }

  private async notifyFacultyCoordinatorsOnSubmission(contributionId: number): Promise<void> {
    await Try.execute(async () => {
      const contribution = await prisma.contribution.findUnique({
        where: { id: contributionId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          faculty: {
            select: {
              facultyName: true,
            },
          },
        },
      });

      if (!contribution) {
        logger.warn(`Skipping coordinator email: contribution ${contributionId} not found`);
        return;
      }

      const coordinators = await prisma.user.findMany({
        where: {
          facultyId: contribution.facultyId,
          isActive: true,
          role: {
            roleCode: 'COORDINATOR',
          },
        },
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      if (coordinators.length === 0) {
        logger.warn(
          `No active coordinators found for faculty ${contribution.facultyId} after contribution ${contributionId} submission`
        );
        return;
      }

      const studentName =
        `${contribution.user.firstName || ''} ${contribution.user.lastName || ''}`.trim() ||
        contribution.user.email;
      const facultyName = contribution.faculty.facultyName;

      for (const coordinator of coordinators) {
        const coordinatorName =
          `${coordinator.firstName || ''} ${coordinator.lastName || ''}`.trim() || coordinator.email;

        await emailService.sendContributionSubmittedEmail(coordinator.email, {
          coordinatorName,
          studentName,
          facultyName,
          contributionTitle: contribution.title,
          contributionId: contribution.id,
        });
      }

      logger.info(
        `Coordinator notification emails sent for contribution ${contributionId} to ${coordinators.length} coordinator(s)`
      );
    }).orElseLogWarning(
      `Failed to notify faculty coordinators for contribution ${contributionId}`
    );
  }

  async getContributionsByStudentId(studentId: number, limit: number, offset: number) {
    const where = { userId: studentId };
    const [items, total] = await Promise.all([
      prisma.contribution.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contribution.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async updateContributionStatus(
    contributionId: number,
    facultyId: number,
    newStatus: string
  ) {
    return Try.execute(async () => {
      // Validate status
      const validStatuses = ['draft', 'submitted', 'under_review', 'selected', 'rejected', 'published'];
      if (!validStatuses.includes(newStatus)) {
        throw new BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      // Check if contribution exists and belongs to coordinator's faculty
      const contribution = await prisma.contribution.findFirst({
        where: {
          id: contributionId,
          facultyId,
        },
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found or does not belong to your faculty');
      }

      assertValidTransition(contribution.status, newStatus);

      // Update status
      const updated = await prisma.contribution.update({
        where: { id: contributionId },
        data: {
          status: newStatus,
          publishedAt: newStatus === 'published' ? new Date() : contribution.publishedAt,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          academicYear: {
            select: {
              id: true,
              yearName: true,
            },
          },
          faculty: {
            select: {
              id: true,
              facultyName: true,
              facultyCode: true,
            },
          },
        },
      });

      logger.info(`Contribution ${contributionId} status updated to ${newStatus} by faculty ${facultyId}`);

      return updated;
    }).orElseThrow('Error updating contribution status');
  }

  async selectContribution(
    contributionId: number,
    coordinatorId: number,
    facultyId: number,
    comment: string
  ) {
    return Try.execute(async () => {
      // Check if contribution exists and belongs to coordinator's faculty
      const contribution = await prisma.contribution.findFirst({
        where: {
          id: contributionId,
          facultyId,
        },
        include: {
          academicYear: true,
        },
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found or does not belong to your faculty');
      }

      assertValidTransition(contribution.status, 'selected');

      // Check if selection is still allowed (before final closure date)
      const now = new Date();
      if (contribution.academicYear.closureFinalDate && now > contribution.academicYear.closureFinalDate) {
        throw new BadRequestError(
          `Selection is no longer allowed for ${contribution.academicYear.yearName}. ` +
          `Final closure date was ${contribution.academicYear.closureFinalDate.toISOString().split('T')[0]}.`
        );
      }

      // Update status to selected and create comment in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.contribution.update({
          where: { id: contributionId },
          data: {
            status: 'selected',
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            academicYear: {
              select: {
                id: true,
                yearName: true,
              },
            },
            faculty: {
              select: {
                id: true,
                facultyName: true,
                facultyCode: true,
              },
            },
          },
        });

        const createdComment = await tx.comment.create({
          data: {
            contributionId,
            userId: coordinatorId,
            content: comment,
            commentedAt: new Date(),
          },
        });

        return { contribution: updated, comment: createdComment };
      });

      logger.info(`Contribution ${contributionId} selected by coordinator ${coordinatorId}`);

      return result;
    }).orElseThrow('Error selecting contribution');
  }

  async rejectContribution(
    contributionId: number,
    coordinatorId: number,
    facultyId: number,
    comment: string
  ) {
    return Try.execute(async () => {
      // Check if contribution exists and belongs to coordinator's faculty
      const contribution = await prisma.contribution.findFirst({
        where: {
          id: contributionId,
          facultyId,
        },
        include: {
          academicYear: true,
        },
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found or does not belong to your faculty');
      }

      assertValidTransition(contribution.status, 'rejected');

      // Check if rejection is still allowed (before final closure date)
      const now = new Date();
      if (contribution.academicYear.closureFinalDate && now > contribution.academicYear.closureFinalDate) {
        throw new BadRequestError(
          `Rejection is no longer allowed for ${contribution.academicYear.yearName}. ` +
          `Final closure date was ${contribution.academicYear.closureFinalDate.toISOString().split('T')[0]}.`
        );
      }

      // Update status to rejected and create comment in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.contribution.update({
          where: { id: contributionId },
          data: {
            status: 'rejected',
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            academicYear: {
              select: {
                id: true,
                yearName: true,
              },
            },
            faculty: {
              select: {
                id: true,
                facultyName: true,
                facultyCode: true,
              },
            },
          },
        });

        const createdComment = await tx.comment.create({
          data: {
            contributionId,
            userId: coordinatorId,
            content: comment,
            commentedAt: new Date(),
          },
        });

        return { contribution: updated, comment: createdComment };
      });

      logger.info(`Contribution ${contributionId} rejected by coordinator ${coordinatorId}`);

      return result;
    }).orElseThrow('Error rejecting contribution');
  }

  async replaceContributionFiles(
    contributionId: number,
    userId: number,
    docxFile: Express.Multer.File,
    imageFiles: Express.Multer.File[] = []
  ) {
    return Try.execute(async () => {
      // Ownership + existence check
      const contribution = await prisma.contribution.findFirst({
        where: { id: contributionId, userId },
        include: { academicYear: true },
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found or you do not have permission to update it');
      }

      // Only allow file replacement for rejected or flagged contributions
      const replaceableStatuses = ['rejected', 'flagged_plagiarism'];
      if (!replaceableStatuses.includes(contribution.status)) {
        throw new BadRequestError(
          `Files can only be replaced when contribution is rejected or flagged for plagiarism. Current status: '${contribution.status}'`
        );
      }

      // Require at least one coordinator comment before resubmission
      const coordinatorComment = await prisma.comment.findFirst({
        where: {
          contributionId,
          user: {
            role: { roleCode: 'COORDINATOR' },
          },
        },
      });
      if (!coordinatorComment) {
        throw new BadRequestError(
          'Cannot resubmit: a coordinator must leave a comment before you can replace files'
        );
      }

      // DOCX mime type check
      const allowedDocxMimeTypes = [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowedDocxMimeTypes.includes(docxFile.mimetype)) {
        throw new BadRequestError('Only DOCX files are allowed');
      }

      // Image mime type + count check
      const allowedImageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      for (const img of imageFiles) {
        if (!allowedImageMimeTypes.includes(img.mimetype)) {
          throw new BadRequestError(`Invalid image type: ${img.originalname}`);
        }
      }
      if (imageFiles.length > 5) {
        throw new BadRequestError('Maximum 5 images allowed');
      }

      // Load all existing files
      const existingFiles = await prisma.contributionFile.findMany({
        where: { contributionId },
      });

      const existingDocx = existingFiles.find(f => f.fileType === 'docx');
      const existingImages = existingFiles.filter(f => f.fileType === 'image');

      // Delete old DOCX from S3
      if (existingDocx?.filePath) {
        await s3Service.deleteFile(existingDocx.filePath);
      }

      // Delete old images from S3 (both uploaded and extracted)
      if (imageFiles.length > 0) {
        for (const img of existingImages) {
          if (img.filePath) {
            await s3Service.deleteFile(img.filePath);
          }
        }
      }

      // Replace DB records in a transaction
      const { newDocxRecord, newImageRecords } = await prisma.$transaction(async (tx) => {
        // Remove old DOCX record
        if (existingDocx) {
          await tx.contributionFile.delete({ where: { id: existingDocx.id } });
        }

        // Remove old image records only if new images are being provided
        if (imageFiles.length > 0) {
          await tx.contributionFile.deleteMany({
            where: { contributionId, fileType: 'image' },
          });
        }

        // Create new DOCX record
        const newDocxRecord = await tx.contributionFile.create({
          data: {
            contributionId,
            fileType: 'docx',
            originalName: docxFile.originalname,
            storedName: docxFile.originalname,
            fileSize: BigInt(docxFile.size),
            isExtracted: false,
            uploadedAt: new Date(),
          },
        });

        // Create new image records
        const newImageRecords = [];
        for (const img of imageFiles) {
          const record = await tx.contributionFile.create({
            data: {
              contributionId,
              fileType: 'image',
              originalName: img.originalname,
              storedName: img.originalname,
              fileSize: BigInt(img.size),
              isExtracted: false,
              uploadedAt: new Date(),
            },
          });
          newImageRecords.push({ record, file: img });
        }

        return { newDocxRecord, newImageRecords };
      });

      // Upload new DOCX to S3
      const docxS3Key = `contributions/${contributionId}/docx/${newDocxRecord.id}-${docxFile.originalname}`;
      await s3Service.uploadFile(docxS3Key, docxFile.buffer, docxFile.mimetype, {
        contributionId: contributionId.toString(),
        contributionFileId: newDocxRecord.id.toString(),
        userId: userId.toString(),
        fileType: 'docx',
      });

      // Upload new images to S3
      const uploadedImages = [];
      const imagePathUpdates: { id: number; filePath: string }[] = [];
      for (const { record, file } of newImageRecords) {
        const imageS3Key = `contributions/${contributionId}/images/${record.id}-${file.originalname}`;
        await s3Service.uploadFile(imageS3Key, file.buffer, file.mimetype, {
          contributionId: contributionId.toString(),
          contributionFileId: record.id.toString(),
          userId: userId.toString(),
          fileType: 'image',
        });
        uploadedImages.push({ id: record.id, originalName: file.originalname, filePath: imageS3Key, fileSize: file.size });
        imagePathUpdates.push({ id: record.id, filePath: imageS3Key });
      }

      // Persist S3 paths
      await prisma.$transaction([
        prisma.contributionFile.update({
          where: { id: newDocxRecord.id },
          data: { filePath: docxS3Key },
        }),
        ...imagePathUpdates.map(u =>
          prisma.contributionFile.update({ where: { id: u.id }, data: { filePath: u.filePath } })
        ),
      ]);

      // Reset contribution status to submitted so it re-enters the review pipeline
      await prisma.contribution.update({
        where: { id: contributionId },
        data: { status: 'submitted', updatedAt: new Date() },
      });

      // Re-queue for processing
      await rabbitmqService.publishMessage({
        contributionFileId: newDocxRecord.id,
        contributionId,
        userId,
        fileName: docxFile.originalname,
        s3Key: docxS3Key,
        contentType: docxFile.mimetype,
        fileSize: docxFile.size,
        uploadedAt: new Date().toISOString(),
      });

      logger.info(`Contribution ${contributionId} files replaced by user ${userId}, new DOCX queued for processing`);

      return {
        contributionId,
        docxFile: {
          id: newDocxRecord.id,
          originalName: docxFile.originalname,
          filePath: docxS3Key,
          fileSize: docxFile.size,
          status: 'pending',
        },
        images: uploadedImages,
      };
    }).orElseThrow('Error replacing contribution files');
  }

  async deleteStudentContribution(contributionId: number, userId: number) {
    return Try.execute(async () => {
      const contribution = await prisma.contribution.findFirst({
        where: { id: contributionId, userId },
        include: { files: true },
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found or you do not have permission to delete it');
      }

      // Delete all files from S3
      for (const file of contribution.files) {
        if (file.filePath) {
          await s3Service.deleteFile(file.filePath);
        }
      }

      // Delete contribution (cascades to files, comments, etc. via DB constraints)
      await prisma.contribution.delete({ where: { id: contributionId } });

      logger.info(`Contribution ${contributionId} deleted by student ${userId}`);
    }).orElseThrow('Error deleting contribution');
  }

  async updateContribution(
    contributionId: number,
    userId: number,
    updateData: { title?: string }
  ) {
    return Try.execute(async () => {
      // Check if contribution exists and belongs to the user
      const contribution = await prisma.contribution.findFirst({
        where: {
          id: contributionId,
          userId,
        },
        include: {
          academicYear: true,
        },
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found or you do not have permission to update it');
      }

      // Check final closure date - no updates allowed after this date
      const now = new Date();
      if (contribution.academicYear.closureFinalDate && now > contribution.academicYear.closureFinalDate) {
        throw new BadRequestError(
          `Updates are no longer allowed for ${contribution.academicYear.yearName}. ` +
          `Final closure date was ${contribution.academicYear.closureFinalDate.toISOString().split('T')[0]}.`
        );
      }

      // Only allow updates if status is draft or rejected
      if (contribution.status !== 'draft' && contribution.status !== 'rejected') {
        throw new BadRequestError('You can only update contributions with draft or rejected status');
      }

      // Update contribution
      const updated = await prisma.contribution.update({
        where: { id: contributionId },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          academicYear: {
            select: {
              id: true,
              yearName: true,
            },
          },
          faculty: {
            select: {
              id: true,
              facultyName: true,
              facultyCode: true,
            },
          },
        },
      });

      logger.info(`Contribution ${contributionId} updated by user ${userId}`);

      return updated;
    }).orElseThrow('Error updating contribution');
  }
}

export default new ContributionService();
