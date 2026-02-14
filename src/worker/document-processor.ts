import rabbitmqService, { DocumentMessage } from '@/shared/mq/rabbitmq.service';
import s3Service from '@/shared/storage/s3.service';
import documentService from '@/modules/document/document.service';
import { DocumentStatus } from '@/modules/document/document.types';
import logger from '@/shared/logger';
import mammoth from 'mammoth';
import {Try} from '@/shared/utils/Try';

class DocumentProcessor {
  async start(): Promise<void> {
    return Try.execute(async () => {
      await rabbitmqService.connect();
      logger.info('Document processor worker started');

      await rabbitmqService.consumeMessages(async (message: DocumentMessage) => {
        await this.processDocument(message);
      });
    }).orElseThrow('Failed to start document processor');
  }

  private async processDocument(message: DocumentMessage): Promise<void> {
    const { documentId, s3Key, contentType } = message;

    await Try.execute(async () => {
      logger.info(`Processing document: ${documentId}`);

      await documentService.updateDocumentStatus(documentId, DocumentStatus.PROCESSING);

      const fileExists = await s3Service.fileExists(s3Key);
      if (!fileExists) {
        throw new Error('File not found in S3');
      }

      const fileBuffer = await s3Service.downloadFile(s3Key);

      if (contentType.includes('html')) {
        await this.processHtmlDocument(fileBuffer, documentId);
      } else if (contentType.includes('pdf')) {
        await this.processPdfDocument(fileBuffer, documentId);
      } else if (contentType.includes('word') || contentType.includes('msword')) {
        await this.processWordDocument(fileBuffer, documentId);
      } else if (contentType.includes('image')) {
        await this.processImageDocument(fileBuffer, documentId);
      } else {
        await this.processGenericDocument(fileBuffer, documentId);
      }

      await documentService.updateDocumentStatus(documentId, DocumentStatus.COMPLETED);
      logger.info(`Document processed successfully: ${documentId}`);
    }).onFailure(async (error: any) => {
      await documentService.updateDocumentStatus(
        documentId,
        DocumentStatus.FAILED,
        error.message || 'Unknown error'
      );
    }).orElseLogWarning(`Error processing document ${documentId}`);
  }

  private async processHtmlDocument(_buffer: Buffer, documentId: string): Promise<void> {
    logger.info(`Processing HTML document: ${documentId}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  private async processPdfDocument(_buffer: Buffer, documentId: string): Promise<void> {
    logger.info(`Processing PDF document: ${documentId}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  private async processWordDocument(buffer: Buffer, documentId: string): Promise<void> {
    logger.info(`Processing Word document: ${documentId}`);
    
    return Try.execute(async () => {
      const result = await mammoth.convertToHtml({ buffer });
      const html = result.value;
      const messages = result.messages;

      if (messages.length > 0) {
        logger.warn(`Conversion warnings for ${documentId}:`, messages);
      }

      const htmlKey = `converted/${documentId}.html`;
      await s3Service.uploadFile(
        htmlKey,
        Buffer.from(html, 'utf-8'),
        'text/html',
        { documentId, convertedFrom: 'docx' }
      );

      const jsonData = {
        documentId,
        html,
        convertedAt: new Date().toISOString(),
        warnings: messages,
      };

      const jsonKey = `converted/${documentId}.json`;
      await s3Service.uploadFile(
        jsonKey,
        Buffer.from(JSON.stringify(jsonData, null, 2), 'utf-8'),
        'application/json',
        { documentId, convertedFrom: 'docx' }
      );

      await documentService.updateConvertedFiles(documentId, htmlKey, jsonKey);

      logger.info(`Word document converted successfully: ${documentId} (HTML: ${htmlKey}, JSON: ${jsonKey})`);
    }).orElseThrow(`Error converting Word document ${documentId}`);
  }

  private async processImageDocument(_buffer: Buffer, documentId: string): Promise<void> {
    logger.info(`Processing image document: ${documentId}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  private async processGenericDocument(_buffer: Buffer, documentId: string): Promise<void> {
    logger.info(`Processing generic document: ${documentId}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  async stop(): Promise<void> {
    await rabbitmqService.close();
    logger.info('Document processor worker stopped');
  }
}

export default new DocumentProcessor();
