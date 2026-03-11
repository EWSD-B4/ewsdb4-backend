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

      // Create contribution with draft status
      const contribution = await prisma.contribution.create({
        data: {
          userId,
          facultyId,
          academicYearId,
          title,
          status: 'draft',
          submittedAt: new Date(),
        },
      });

      logger.info(`Contribution created: ${contribution.id} by user ${userId}`);

      // Create DOCX file record
      const contributionFile = await prisma.contributionFile.create({
        data: {
          contributionId: contribution.id,
          fileType: 'docx',
          originalName: docxFile.originalname,
          storedName: docxFile.originalname,
          fileSize: BigInt(docxFile.size),
          uploadedAt: new Date(),
        },
      });

      // Upload DOCX to S3
      const docxS3Key = `contributions/${contribution.id}/docx/${contributionFile.id}-${docxFile.originalname}`;
      await s3Service.uploadFile(docxS3Key, docxFile.buffer, docxFile.mimetype, {
        contributionId: contribution.id.toString(),
        contributionFileId: contributionFile.id.toString(),
        userId: userId.toString(),
        fileType: 'docx',
      });

      // Update DOCX file path
      await prisma.contributionFile.update({
        where: { id: contributionFile.id },
        data: { filePath: docxS3Key },
      });

      logger.info(`DOCX file uploaded to S3: ${docxS3Key}`);

      // Process and upload images
      const uploadedImages = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i];
        
        // Create image file record
        const imageRecord = await prisma.contributionFile.create({
          data: {
            contributionId: contribution.id,
            fileType: 'image',
            originalName: imageFile.originalname,
            storedName: imageFile.originalname,
            fileSize: BigInt(imageFile.size),
            uploadedAt: new Date(),
          },
        });

        // Upload image to S3
        const imageS3Key = `contributions/${contribution.id}/images/${imageRecord.id}-${imageFile.originalname}`;
        await s3Service.uploadFile(imageS3Key, imageFile.buffer, imageFile.mimetype, {
          contributionId: contribution.id.toString(),
          contributionFileId: imageRecord.id.toString(),
          userId: userId.toString(),
          fileType: 'image',
        });

        // Update image file path
        await prisma.contributionFile.update({
          where: { id: imageRecord.id },
          data: { filePath: imageS3Key },
        });

        uploadedImages.push({
          id: imageRecord.id,
          originalName: imageFile.originalname,
          filePath: imageS3Key,
          fileSize: imageFile.size,
        });

        logger.info(`Image ${i + 1}/${imageFiles.length} uploaded to S3: ${imageS3Key}`);
      }

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
}

export default new ContributionService();
