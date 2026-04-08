import s3Service from '@/shared/storage/s3.service';
import rabbitmqService from '@/shared/mq/rabbitmq.service';
import logger from '@/shared/logger';
import { ContributionFileResponse, DocumentStatus } from './document.types';
import { BadRequestError, NotFoundError } from '@/shared/errors/AppError';
import { Try } from '@/shared/utils/Try';
import { db } from '@/shared/database';

class DocumentService {
  async uploadContributionFile(
    contributionId: number,
    userId: number,
    file: Express.Multer.File,
    fileType: 'docx' | 'image'
  ): Promise<ContributionFileResponse> {
    return Try.execute(async () => {
      // Validate contribution exists and belongs to user
      const contribution = await db.contribution.findFirst({
        where: { id: contributionId, userId },
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found');
      }

      return await this.createContributionFile(contributionId, userId, file, fileType);
    }).orElseThrow('Error uploading contribution file');
  }

  async createContributionFile(
    contributionId: number,
    userId: number,
    file: Express.Multer.File,
    fileType: 'docx' | 'image'
  ): Promise<ContributionFileResponse> {
    return Try.execute(async () => {
      // Validate contribution exists (no user check for internal calls)
      const contribution = await db.contribution.findUnique({
        where: { id: contributionId },
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found');
      }

      // Check file limits
      const existingFiles = await db.contributionFile.findMany({
        where: { contributionId, fileType },
      });

      if (fileType === 'docx' && existingFiles.length >= 1) {
        throw new BadRequestError('Contribution already has a DOCX file');
      }

      // For images, only count manually uploaded images (not extracted from DOCX)
      if (fileType === 'image') {
        const manuallyUploadedImages = existingFiles.filter(f => !f.isExtracted);
        if (manuallyUploadedImages.length >= 5) {
          throw new BadRequestError('Contribution already has maximum 5 manually uploaded images');
        }
      }

      // Create file record
      const contributionFile = await db.contributionFile.create({
        data: {
          contributionId,
          fileType,
          originalName: file.originalname,
          storedName: file.originalname,
          fileSize: BigInt(file.size),
          isExtracted: false,
          uploadedAt: new Date(),
        },
      });

      const s3Key = `contributions/${contributionId}/${fileType}/${contributionFile.id}-${file.originalname}`;

      // Upload to S3
      await s3Service.uploadFile(s3Key, file.buffer, file.mimetype, {
        contributionId: contributionId.toString(),
        contributionFileId: contributionFile.id.toString(),
        userId: userId.toString(),
        fileType,
      });

      // Update file path
      await db.contributionFile.update({
        where: { id: contributionFile.id },
        data: { filePath: s3Key },
      });

      // Queue for processing if DOCX
      if (fileType === 'docx') {
        await rabbitmqService.publishMessage({
          contributionFileId: contributionFile.id,
          contributionId,
          userId,
          fileName: file.originalname,
          s3Key,
          contentType: file.mimetype,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        });

        logger.info(`DOCX file uploaded and queued for processing: ${contributionFile.id}`);
      } else {
        logger.info(`Image file uploaded: ${contributionFile.id}`);
      }

      return {
        id: contributionFile.id,
        contributionId,
        fileType,
        originalName: file.originalname,
        storedName: file.originalname,
        filePath: s3Key,
        fileSize: file.size,
        status: fileType === 'docx' ? DocumentStatus.PENDING : DocumentStatus.COMPLETED,
        uploadedAt: new Date(),
        createdAt: contributionFile.createdAt,
      };
    }).orElseThrow('Error uploading contribution file');
  }

  async getContributionFileById(fileId: number): Promise<ContributionFileResponse | null> {
    return Try.execute(async () => {
      const file = await db.contributionFile.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        return null;
      }

      return {
        id: file.id,
        contributionId: file.contributionId,
        fileType: file.fileType,
        originalName: file.originalName,
        storedName: file.storedName,
        filePath: file.filePath,
        fileSize: file.fileSize !== null ? Number(file.fileSize) : null,
        status: DocumentStatus.COMPLETED,
        uploadedAt: file.uploadedAt,
        createdAt: file.createdAt,
      };
    }).orElseThrow('Error fetching contribution file');
  }

  async getContributionFiles(contributionId: number): Promise<ContributionFileResponse[]> {
    return Try.execute(async () => {
      const files = await db.contributionFile.findMany({
        where: { contributionId },
        orderBy: { createdAt: 'asc' },
      });

      return files.map((file): ContributionFileResponse => ({
        id: file.id,
        contributionId: file.contributionId,
        fileType: file.fileType,
        originalName: file.originalName,
        storedName: file.storedName,
        filePath: file.filePath,
        fileSize: file.fileSize !== null ? Number(file.fileSize) : null,
        status: DocumentStatus.COMPLETED,
        uploadedAt: file.uploadedAt,
        createdAt: file.createdAt,
      }));
    }).orElseThrow('Error fetching contribution files');
  }

  async downloadContributionFile(
    fileId: number
  ): Promise<{ buffer: Buffer; file: ContributionFileResponse }> {
    return Try.execute(async () => {
      const file = await this.getContributionFileById(fileId);

      if (!file || !file.filePath) {
        throw new NotFoundError('File not found');
      }

      const buffer = await s3Service.downloadFile(file.filePath);

      return { buffer, file };
    }).orElseThrow('Error downloading contribution file');
  }

  async getDownloadUrl(fileId: number, expiresIn: number = 3600): Promise<string> {
    return Try.execute(async () => {
      const file = await this.getContributionFileById(fileId);

      if (!file || !file.filePath) {
        throw new NotFoundError('File not found');
      }

      return await s3Service.getSignedDownloadUrl(file.filePath, expiresIn);
    }).orElseThrow('Error generating download URL');
  }

  async downloadByContributionId(
    contributionId: number
  ): Promise<{ buffer: Buffer; file: ContributionFileResponse }> {
    return Try.execute(async () => {
      const file = await db.contributionFile.findFirst({
        where: { contributionId, fileType: 'docx' },
        orderBy: { createdAt: 'asc' },
      });

      if (!file || !file.filePath) {
        throw new NotFoundError('No DOCX file found for this contribution');
      }

      const buffer = await s3Service.downloadFile(file.filePath);

      return {
        buffer,
        file: {
          id: file.id,
          contributionId: file.contributionId,
          fileType: file.fileType,
          originalName: file.originalName,
          storedName: file.storedName,
          filePath: file.filePath,
          fileSize: file.fileSize !== null ? Number(file.fileSize) : null,
          status: DocumentStatus.COMPLETED,
          uploadedAt: file.uploadedAt,
          createdAt: file.createdAt,
        },
      };
    }).orElseThrow('Error downloading contribution file by contribution ID');
  }

  async getDownloadUrlByContributionId(
    contributionId: number,
    expiresIn: number = 3600
  ): Promise<string> {
    return Try.execute(async () => {
      const file = await db.contributionFile.findFirst({
        where: { contributionId, fileType: 'docx' },
        orderBy: { createdAt: 'asc' },
      });

      if (!file || !file.filePath) {
        throw new NotFoundError('No DOCX file found for this contribution');
      }

      return await s3Service.getSignedDownloadUrl(file.filePath, expiresIn);
    }).orElseThrow('Error generating download URL by contribution ID');
  }

  async deleteContributionFile(fileId: number): Promise<void> {
    return Try.execute(async () => {
      const file = await this.getContributionFileById(fileId);

      if (!file) {
        throw new NotFoundError('File not found');
      }

      if (file.filePath) {
        await s3Service.deleteFile(file.filePath);
      }

      await db.contributionFile.delete({
        where: { id: fileId },
      });

      logger.info(`Contribution file deleted: ${fileId}`);
    }).orElseThrow('Error deleting contribution file');
  }

  async updateFileStatus(
    fileId: number,
    status: DocumentStatus,
    processingError?: string
  ): Promise<void> {
    return Try.execute(async () => {
      // Note: ContributionFile doesn't have status/processingError fields in schema
      // We'll log the status for now. If needed, add these fields to the schema.
      logger.info(`File status update: ${fileId} -> ${status}${processingError ? ` (${processingError})` : ''}`);
      
      // If you want to persist status, add these fields to ContributionFile model:
      // await db.contributionFile.update({
      //   where: { id: fileId },
      //   data: { status, processingError },
      // });
    }).orElseThrow('Error updating file status');
  }

}

export default new DocumentService();
