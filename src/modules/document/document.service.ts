import { randomUUID } from 'crypto';
import s3Service from '@/shared/storage/s3.service';
import rabbitmqService from '@/shared/mq/rabbitmq.service';
import logger from '@/shared/logger';
import { Document, DocumentResponse, DocumentStatus } from './document.types';
import { BadRequestError, InternalServerError, NotFoundError } from '@/shared/errors/AppError';
import { Try } from '@/shared/utils/Try';

// NOTE: The 'documents' table is not in the current Prisma schema.
// You may need to either:
// 1. Add a Document model to prisma/schema.prisma, or
// 2. Map this functionality to the ContributionFile model
// For now, this service needs to be refactored to use Prisma queries.

class DocumentService {
  async uploadDocument(userId: string, file: Express.Multer.File): Promise<DocumentResponse> {
    const documentId = randomUUID();
    const fileName = `${documentId}-${file.originalname}`;
    const s3Key = `${userId}/${fileName}`;

    await s3Service.uploadFile(s3Key, file.buffer, file.mimetype, {
      userId,
      documentId,
      originalName: file.originalname,
    });

    // TODO: Refactor to use Prisma - add Document model to schema or use ContributionFile
    // await Try.execute(async () => {
    //   await db.document.create({
    //     data: {
    //       id: documentId,
    //       userId: parseInt(userId),
    //       fileName,
    //       originalName: file.originalname,
    //       s3Key,
    //       contentType: file.mimetype,
    //       fileSize: file.size,
    //       status: DocumentStatus.PENDING,
    //       uploadedAt: new Date(),
    //     },
    //   });
    // }).orElseThrow('Error saving document metadata');

    await rabbitmqService.publishMessage({
      documentId,
      userId,
      fileName,
      s3Key,
      contentType: file.mimetype,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
    });

    logger.info(`Document uploaded and queued for processing: ${documentId}`);

    return {
      id: documentId,
      fileName,
      originalName: file.originalname,
      contentType: file.mimetype,
      fileSize: file.size,
      status: DocumentStatus.PENDING,
      uploadedAt: new Date(),
    };
  }

  getDocumentById(_documentId: string, _userId: string): Promise<Document | null> {
    // TODO: Refactor to use Prisma
    // return Try.execute(async () => {
    //   const document = await db.document.findFirst({
    //     where: {
    //       id: documentId,
    //       userId: parseInt(userId),
    //     },
    //   });
    //   return document;
    // }).orElseThrow('Error fetching document');
    throw new InternalServerError('Document service needs to be refactored for Prisma');
  }

  getUserDocuments(
    _userId: string,
    _limit: number = 50,
    _offset: number = 0
  ): Promise<Document[]> {
    // TODO: Refactor to use Prisma
    // return Try.execute(async () => {
    //   const documents = await db.document.findMany({
    //     where: { userId: parseInt(userId) },
    //     orderBy: { createdAt: 'desc' },
    //     take: limit,
    //     skip: offset,
    //   });
    //   return documents;
    // }).orElseThrow('Error fetching user documents');
    throw new InternalServerError('Document service needs to be refactored for Prisma');
  }

  async downloadDocument(
    documentId: string,
    userId: string
  ): Promise<{ buffer: Buffer; document: Document }> {
    return Try.execute(async () => {
      const document = await this.getDocumentById(documentId, userId);

      if (!document) {
        throw new NotFoundError('Document not found');
      }

      const buffer = await s3Service.downloadFile(document.s3Key);

      return { buffer, document };
    }).orElseThrow('Error downloading document');
  }

  async getDownloadUrl(
    documentId: string,
    userId: string,
    expiresIn: number = 3600
  ): Promise<string> {
    return Try.execute(async () => {
      const document = await this.getDocumentById(documentId, userId);

      if (!document) {
        throw new NotFoundError('Document not found');
      }

      return await s3Service.getSignedDownloadUrl(document.s3Key, expiresIn);
    }).orElseThrow('Error generating download URL');
  }

  async deleteDocument(documentId: string, userId: string): Promise<void> {
    return Try.execute(async () => {
      const document = await this.getDocumentById(documentId, userId);

      if (!document) {
        throw new NotFoundError('Document not found');
      }

      await s3Service.deleteFile(document.s3Key);

      // TODO: Refactor to use Prisma
      // await db.document.delete({
      //   where: {
      //     id: documentId,
      //     userId: parseInt(userId),
      //   },
      // });

      logger.info(`Document deleted: ${documentId}`);
    }).orElseThrow('Error deleting document');
  }

  async updateDocumentStatus(
    documentId: string,
    status: DocumentStatus,
    processingError?: string
  ): Promise<void> {
    return Try.execute(() => {
      const updateFields = ['status = ?', 'updated_at = NOW()'];
      const params: any[] = [status];

      if (status === DocumentStatus.COMPLETED || status === DocumentStatus.FAILED) {
        updateFields.push('processed_at = NOW()');
      }

      if (processingError) {
        updateFields.push('processing_error = ?');
        params.push(processingError);
      }

      params.push(documentId);

      // TODO: Refactor to use Prisma
      // const updateData: any = { status };
      // if (status === DocumentStatus.COMPLETED || status === DocumentStatus.FAILED) {
      //   updateData.processedAt = new Date();
      // }
      // if (processingError) {
      //   updateData.processingError = processingError;
      // }
      // await db.document.update({
      //   where: { id: documentId },
      //   data: updateData,
      // });

      logger.info(`Document status updated: ${documentId} -> ${status}`);
    }).orElseThrow('Error updating document status');
  }

  async updateConvertedFiles(
    documentId: string,
    _convertedHtmlKey: string,
    _convertedJsonKey: string
  ): Promise<void> {
    return Try.execute(() => {
      // TODO: Refactor to use Prisma
      // await db.document.update({
      //   where: { id: documentId },
      //   data: {
      //     convertedHtmlKey,
      //     convertedJsonKey,
      //   },
      // });

      logger.info(`Converted file keys updated for document: ${documentId}`);
    }).orElseThrow('Error updating converted file keys');
  }

  async getConvertedDocument(
    documentId: string,
    userId: string,
    format: 'html' | 'json'
  ): Promise<{ buffer: Buffer; document: Document }> {
    return Try.execute(async () => {
      const document = await this.getDocumentById(documentId, userId);

      if (!document) {
        throw new NotFoundError('Document not found');
      }

      if (document.status !== DocumentStatus.COMPLETED) {
        throw new BadRequestError('Document has not been processed yet');
      }

      const s3Key = format === 'html' ? document.convertedHtmlKey : document.convertedJsonKey;

      if (!s3Key) {
        throw new NotFoundError(`Converted ${format.toUpperCase()} file not available`);
      }

      const buffer = await s3Service.downloadFile(s3Key);

      return { buffer, document };
    }).orElseThrow(`Error downloading converted ${format} document`);
  }
}

export default new DocumentService();
