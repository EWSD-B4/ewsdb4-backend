import rabbitmqService, { DocumentMessage } from '@/shared/mq/rabbitmq.service';
import s3Service from '@/shared/storage/s3.service';
import documentService from '@/modules/document/document.service';
import { DocumentStatus } from '@/modules/document/document.types';
import logger from '@/shared/logger';
import mammoth from 'mammoth';
import { Try } from '@/shared/utils/Try';
import TurndownService from 'turndown';

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
    const { contributionFileId, contributionId, s3Key, contentType } = message;

    await Try.execute(async () => {
      logger.info(`Processing contribution file: ${contributionFileId}`);

      await documentService.updateFileStatus(contributionFileId, DocumentStatus.PROCESSING);

      const fileExists = await s3Service.fileExists(s3Key);
      if (!fileExists) {
        throw new Error('File not found in S3');
      }

      // Only process DOCX files (images are already uploaded)
      if (contentType.includes('word') || contentType.includes('msword')) {
        const fileBuffer = await s3Service.downloadFile(s3Key);
        await this.processWordDocument(fileBuffer, contributionFileId, contributionId);
      } else {
        logger.warn(`Unexpected file type for processing: ${contentType}`);
      }

      await documentService.updateFileStatus(contributionFileId, DocumentStatus.COMPLETED);
      logger.info(`Contribution file processed successfully: ${contributionFileId}`);
    })
      .onFailure(async (error: Error) => {
        await documentService.updateFileStatus(
          contributionFileId,
          DocumentStatus.FAILED,
          error.message || 'Unknown error'
        );
      })
      .orElseLogWarning(`Error processing contribution file ${contributionFileId}`);
  }


  private async processWordDocument(
    buffer: Buffer,
    contributionFileId: number,
    contributionId: number
  ): Promise<void> {
    logger.info(`Processing Word document: contributionFileId=${contributionFileId}`);

    return Try.execute(async () => {
      const uploadedImages: Array<{
        contributionFileId: number;
        s3Key: string;
        contentType: string;
      }> = [];

      const result = await mammoth.convertToHtml(
        { buffer },
        {
          convertImage: (mammoth as any).images.inline(async (image: any) => {
            const contentType: string = image.contentType || 'application/octet-stream';
            const ext = contentType.includes('/') ? contentType.split('/')[1] : 'bin';
            const imageIndex = uploadedImages.length + 1;
            const imageBuffer: Buffer = await image.read();

            // Create image file record in contribution_files
            const imageFile = await documentService.createContributionFile(
              contributionId,
              0, // userId not used in internal method
              {
                originalname: `image-${imageIndex}.${ext}`,
                buffer: imageBuffer,
                mimetype: contentType,
                size: imageBuffer.length,
              } as Express.Multer.File,
              'image'
            );

            uploadedImages.push({
              contributionFileId: imageFile.id,
              s3Key: imageFile.filePath!,
              contentType,
            });

            return {
              src: imageFile.filePath,
            };
          }),
        }
      );

      const html: string = result.value;
      const messages: unknown[] = result.messages;

      const turndownService = new TurndownService({
        codeBlockStyle: 'fenced',
        emDelimiter: '*',
      });

      const markdown: string = turndownService.turndown(html);

      if (messages.length > 0) {
        logger.warn(`Conversion warnings for contributionFileId=${contributionFileId}:`, messages);
      }

      // Store markdown directly in contribution_files.content_md
      const manifestData = {
        contributionFileId,
        contributionId,
        markdownS3Key: null, // Markdown stored in DB, not S3
        images: uploadedImages,
        convertedAt: new Date().toISOString(),
        warnings: messages,
      };

      const manifestKey = `contributions/${contributionId}/manifest/${contributionFileId}.json`;
      const uploadedManifestKey = await s3Service.uploadFile(
        manifestKey,
        Buffer.from(JSON.stringify(manifestData, null, 2), 'utf-8'),
        'application/json',
        {
          contributionId: contributionId.toString(),
          contributionFileId: contributionFileId.toString(),
          convertedFrom: 'docx',
        }
      );

      // Update contribution_files with markdown content
      await documentService.updateConvertedMarkdown(
        contributionFileId,
        markdown,
        uploadedManifestKey
      );

      logger.info(
        `Word document converted successfully: contributionFileId=${contributionFileId}, images=${uploadedImages.length}, manifest=${uploadedManifestKey}`
      );
    }).orElseThrow(`Error converting Word document contributionFileId=${contributionFileId}`);
  }

  async stop(): Promise<void> {
    await rabbitmqService.close();
    logger.info('Document processor worker stopped');
  }
}

export default new DocumentProcessor();
