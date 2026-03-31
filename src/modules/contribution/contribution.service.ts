import { db as prisma } from '@/shared/database';
import { BadRequestError, NotFoundError } from '@/shared/errors/AppError';
import s3Service from '@/shared/storage/s3.service';
import rabbitmqService from '@/shared/mq/rabbitmq.service';
import logger from '@/shared/logger';
import { Try } from '@/shared/utils/Try';

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
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found or does not belong to your faculty');
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
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found or does not belong to your faculty');
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
