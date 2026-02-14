import {v4 as uuidv4} from 'uuid';
import {ResultSetHeader, RowDataPacket} from 'mysql2';
import db from '@/shared/database/mysql';
import s3Service from '@/shared/storage/s3.service';
import rabbitmqService from '@/shared/mq/rabbitmq.service';
import logger from '@/shared/logger';
import {Document, DocumentResponse, DocumentStatus} from './document.types';
import {BadRequestError, InternalServerError, NotFoundError} from '@/shared/errors/AppError';
import {Try} from '@/shared/utils/Try';

class DocumentService {
  async uploadDocument(
    userId: string,
    file: Express.Multer.File
  ): Promise<DocumentResponse> {
    const documentId = uuidv4();
    const fileName = `${documentId}-${file.originalname}`;
    const s3Key = `${userId}/${fileName}`;

    await s3Service.uploadFile(s3Key, file.buffer, file.mimetype, {
      userId,
      documentId,
      originalName: file.originalname,
    });

    await Try.execute(async () => {
      const [result] = await db.getPool().execute<ResultSetHeader>(
        `INSERT INTO documents (id, user_id, file_name, original_name, s3_key, content_type, file_size, status, uploaded_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
        [
          documentId,
          userId,
          fileName,
          file.originalname,
          s3Key,
          file.mimetype,
          file.size,
          DocumentStatus.PENDING,
        ]
      );

      if (result.affectedRows === 0) {
        throw new InternalServerError('Failed to save document metadata');
      }
    }).orElseThrow('Error saving document metadata')

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

  async getDocumentById(documentId: string, userId: string): Promise<Document | null> {
    return Try.execute(async () => {
      const [rows] = await db.getPool().execute<RowDataPacket[]>(
        'SELECT * FROM documents WHERE id = ? AND user_id = ?',
        [documentId, userId]
      );

      if (rows.length === 0) {
        return null;
      }

      return rows[0] as Document;
    }).orElseThrow('Error fetching document');
  }

  async getUserDocuments(userId: string, limit: number = 50, offset: number = 0): Promise<Document[]> {
    return Try.execute(async () => {
      const [rows] = await db.getPool().execute<RowDataPacket[]>(
        'SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [userId, limit, offset]
      );

      return rows as Document[];
    }).orElseThrow('Error fetching user documents');
  }

  async downloadDocument(documentId: string, userId: string): Promise<{ buffer: Buffer; document: Document }> {
    return Try.execute(async () => {
      const document = await this.getDocumentById(documentId, userId);

      if (!document) {
        throw new NotFoundError('Document not found');
      }

      const buffer = await s3Service.downloadFile(document.s3Key);

      return { buffer, document };
    }).orElseThrow('Error downloading document');
  }

  async getDownloadUrl(documentId: string, userId: string, expiresIn: number = 3600): Promise<string> {
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

      const [result] = await db.getPool().execute<ResultSetHeader>(
        'DELETE FROM documents WHERE id = ? AND user_id = ?',
        [documentId, userId]
      );

      if (result.affectedRows === 0) {
        throw new InternalServerError('Failed to delete document metadata');
      }

      logger.info(`Document deleted: ${documentId}`);
    }).orElseThrow('Error deleting document');
  }

  async updateDocumentStatus(
    documentId: string,
    status: DocumentStatus,
    processingError?: string
  ): Promise<void> {
    return Try.execute(async () => {
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

      const [result] = await db.getPool().execute<ResultSetHeader>(
        `UPDATE documents SET ${updateFields.join(', ')} WHERE id = ?`,
        params
      );

      if (result.affectedRows === 0) {
        throw new InternalServerError('Failed to update document status');
      }

      logger.info(`Document status updated: ${documentId} -> ${status}`);
    }).orElseThrow('Error updating document status');
  }

  async updateConvertedFiles(
    documentId: string,
    convertedHtmlKey: string,
    convertedJsonKey: string
  ): Promise<void> {
    return Try.execute(async () => {
      const [result] = await db.getPool().execute<ResultSetHeader>(
        `UPDATE documents SET converted_html_key = ?, converted_json_key = ?, updated_at = NOW() WHERE id = ?`,
        [convertedHtmlKey, convertedJsonKey, documentId]
      );

      if (result.affectedRows === 0) {
        throw new InternalServerError('Failed to update converted file keys');
      }

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
