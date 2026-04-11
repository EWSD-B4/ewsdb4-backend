import rabbitmqService, { DocumentMessage } from '@/shared/mq/rabbitmq.service';
import s3Service from '@/shared/storage/s3.service';
import documentService from '@/modules/document/document.service';
import { DocumentStatus } from '@/modules/document/document.types';
import logger from '@/shared/logger';
import mammoth from 'mammoth';
import { Try } from '@/shared/utils/Try';
import { DocumentContentModel } from '@/models/document-content.model';
import { db } from '@/shared/database';
import plagiarismService from '../services/plagiarism.service';

interface ExtractedImage {
  buffer: Buffer;
  contentType: string;
  index: number;
}

class DocumentProcessorTipTap {
  async start(): Promise<void> {
    return Try.execute(async () => {
      await rabbitmqService.connect();
      logger.info('TipTap Document processor worker started');

      await rabbitmqService.consumeMessages(async (message: DocumentMessage) => {
        await this.processDocument(message);
      });
    }).orElseThrow('Failed to start TipTap document processor');
  }

  private async processDocument(message: DocumentMessage): Promise<void> {
    const { contributionFileId, contributionId, s3Key, contentType } = message;

    await Try.execute(async () => {
      logger.info(`Processing contribution file with TipTap: ${contributionFileId}`);

      await documentService.updateFileStatus(contributionFileId, DocumentStatus.PROCESSING);

      const fileExists = await s3Service.fileExists(s3Key);
      if (!fileExists) {
        throw new Error('File not found in S3');
      }

      if (contentType.includes('word') || contentType.includes('msword')) {
        const fileBuffer = await s3Service.downloadFile(s3Key);
        await this.processWordDocumentToTipTap(fileBuffer, contributionFileId, contributionId);
      } else {
        logger.warn(`Unexpected file type for processing: ${contentType}`);
      }

      await documentService.updateFileStatus(contributionFileId, DocumentStatus.COMPLETED);
      logger.info(`Contribution file processed successfully with TipTap: ${contributionFileId}`);
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

  private async processWordDocumentToTipTap(
    buffer: Buffer,
    contributionFileId: number,
    contributionId: number
  ): Promise<void> {
    logger.info(`Processing Word document to TipTap JSON: contributionFileId=${contributionFileId}`);

    // if there is already content, delete it
    const documentContent = await DocumentContentModel.find({
      where: { contributionFileId },
    });

    if (documentContent.length > 0) {
      await DocumentContentModel.deleteMany({
        where: { contributionFileId },
      });
    }

    const startTime = Date.now();

    return Try.execute(async () => {
      const extractedImages: ExtractedImage[] = [];
      const imageMapping = new Map<number, string>();

      // Convert DOCX to HTML with image extraction
      const result = await mammoth.convertToHtml(
        { buffer },
        {
          convertImage: (mammoth as any).images.inline(async (image: any) => {
            const contentType: string = image.contentType || 'image/png';
            const imageIndex = extractedImages.length;
            const imageBuffer: Buffer = await image.read();

            extractedImages.push({
              buffer: imageBuffer,
              contentType,
              index: imageIndex,
            });

            // Return placeholder for now
            return {
              src: `__IMAGE_PLACEHOLDER_${imageIndex}__`,
            };
          }),
        }
      );

      const html: string = result.value;

      logger.info(`Extracted ${extractedImages.length} images from DOCX file: contributionFileId=${contributionFileId}`);

      // Convert HTML to TipTap JSON structure
      const tiptapJson = this.htmlToTipTapJson(html);

      // Upload extracted images to S3 and get their URLs
      // Create all image file records in a single transaction
      const imageFiles = await db.$transaction(async (tx) => {
        const files = [];
        for (const extractedImage of extractedImages) {
          const imageFile = await tx.contributionFile.create({
            data: {
              contributionId,
              fileType: 'image',
              originalName: `extracted-image-${extractedImage.index}.${extractedImage.contentType.split('/')[1] || 'png'}`,
              storedName: `extracted-image-${extractedImage.index}.${extractedImage.contentType.split('/')[1] || 'png'}`,
              fileSize: BigInt(extractedImage.buffer.length),
              isExtracted: true,
              uploadedAt: new Date(),
            },
          });
          files.push(imageFile);
        }
        return files;
      });

      // Upload to S3 and update file paths (outside transaction)
      const filePathUpdates = [];
      
      for (let i = 0; i < extractedImages.length; i++) {
        const extractedImage = extractedImages[i];
        const imageFile = imageFiles[i];

        const s3Key = `contributions/${contributionId}/extracted-images/${imageFile.id}-image-${extractedImage.index}.${extractedImage.contentType.split('/')[1] || 'png'}`;

        // Upload to S3
        await s3Service.uploadFile(s3Key, extractedImage.buffer, extractedImage.contentType, {
          contributionId: contributionId.toString(),
          contributionFileId: imageFile.id.toString(),
          fileType: 'extracted-image',
        });

        imageMapping.set(extractedImage.index, s3Key);
        filePathUpdates.push({
          id: imageFile.id,
          filePath: s3Key,
        });
        
        logger.info(`Extracted image uploaded: ${imageFile.id} (${s3Key})`);
      }

      // Batch update all file paths in a single transaction
      if (filePathUpdates.length > 0) {
        await db.$transaction(
          filePathUpdates.map(update =>
            db.contributionFile.update({
              where: { id: update.id },
              data: { filePath: update.filePath },
            })
          )
        );
      }

      // Calculate metadata
      const plainText = this.extractPlainText(tiptapJson);
      const wordCount = plainText.split(/\s+/).filter((w) => w.length > 0).length;
      const characterCount = plainText.length;
      const processingDuration = Date.now() - startTime;

      // Fetch uploaded images (images uploaded via API, not extracted from DOCX)
      const uploadedImageFiles = await db.contributionFile.findMany({
        where: {
          contributionId,
          fileType: 'image',
          isExtracted: false, // Only get manually uploaded images
        },
        orderBy: {
          id: 'asc',
        },
      });

      // Store TipTap JSON in MongoDB
      await DocumentContentModel.findOneAndUpdate(
        { contributionFileId },
        {
          contributionFileId,
          contributionId,
          tiptapJson: tiptapJson,
          plainText: plainText,
          uploadedImages: uploadedImageFiles.map((img) => ({
            s3Key: img.filePath || '',
            alt: img.originalName,
          })),
          extractedImages: Array.from(imageMapping.entries()).map(([index, s3Key]) => ({
            s3Key,
            alt: `Extracted Image ${index + 1}`,
          })),
          metadata: {
            wordCount,
            characterCount,
            processedAt: new Date(),
            processingDuration,
          },
        },
        { upsert: true, returnDocument: 'after' }
      );

      // Check for plagiarism
      logger.info(`Checking plagiarism for contributionFileId=${contributionFileId}`);
      const plagiarismMatches = await plagiarismService.checkPlagiarism(
        plainText,
        contributionFileId
      );

      // Store plagiarism check results
      await DocumentContentModel.findOneAndUpdate(
        { contributionFileId },
        {
          plagiarismCheck: {
            checked: true,
            checkedAt: new Date(),
            matches: plagiarismMatches,
          },
        }
      );

      // If plagiarism detected, update contribution status to flagged
      if (plagiarismMatches.length > 0) {
        const riskLevel = plagiarismService.getRiskLevel(plagiarismMatches);
        logger.warn(
          `Plagiarism detected for contributionId=${contributionId}: ` +
          `${plagiarismMatches.length} matches, risk level: ${riskLevel}, ` +
          `highest similarity: ${(plagiarismMatches[0].similarityScore * 100).toFixed(1)}%`
        );

        // Update contribution status to flagged_plagiarism
        await db.contribution.update({
          where: { id: contributionId },
          data: { status: 'flagged_plagiarism' },
        });

        logger.info(`Contribution ${contributionId} flagged for plagiarism review`);
      } else {
        logger.info(`No plagiarism detected for contributionId=${contributionId}`);
      }


      logger.info(
        `Word document converted to TipTap JSON: contributionFileId=${contributionFileId}, ` +
          `images=${extractedImages.length}, words=${wordCount}, duration=${processingDuration}ms`
      );
    }).orElseThrow(`Error converting Word document to TipTap: contributionFileId=${contributionFileId}`);
  }

  private htmlToTipTapJson(html: string): any {
    // Basic HTML to TipTap JSON conversion
    const doc: { type: string; content: any[] } = {
      type: 'doc',
      content: [],
    };

    // Remove images from HTML since they're stored separately in extractedImages
    const htmlWithoutImages = html.replace(/<img[^>]*>/gi, '');

    // Simple parsing - split by common tags
    const paragraphs = htmlWithoutImages.split(/<\/?p>/gi).filter((p) => p.trim());

    const paragraphNodes = paragraphs.map((p) => {
      const content = [];
      
      // Handle bold text
      const boldRegex = /<strong>(.*?)<\/strong>/gi;
      let lastIndex = 0;
      let match;
      
      while ((match = boldRegex.exec(p)) !== null) {
        if (match.index > lastIndex) {
          const text = p.substring(lastIndex, match.index).replace(/<[^>]*>/g, '');
          if (text) content.push({ type: 'text', text });
        }
        content.push({
          type: 'text',
          marks: [{ type: 'bold' }],
          text: match[1],
        });
        lastIndex = match.index + match[0].length;
      }
      
      if (lastIndex < p.length) {
        const text = p.substring(lastIndex).replace(/<[^>]*>/g, '');
        if (text) content.push({ type: 'text', text });
      }

      return {
        type: 'paragraph',
        content: content.length > 0 ? content : [{ type: 'text', text: p.replace(/<[^>]*>/g, '') }],
      };
    });

    doc.content.push(...paragraphNodes);

    return doc;
  }

  private replaceImagePlaceholders(tiptapJson: any, imageMapping: Map<number, string>): any {
    if (typeof tiptapJson !== 'object' || tiptapJson === null) {
      return tiptapJson;
    }

    if (tiptapJson.type === 'image' && tiptapJson.attrs?.src) {
      const match = tiptapJson.attrs.src.match(/__IMAGE_PLACEHOLDER_(\d+)__/);
      if (match) {
        const imageIndex = parseInt(match[1]);
        const s3Url = imageMapping.get(imageIndex);
        if (s3Url) {
          return {
            ...tiptapJson,
            attrs: {
              ...tiptapJson.attrs,
              src: s3Url,
            },
          };
        }
      }
    }

    if (Array.isArray(tiptapJson.content)) {
      return {
        ...tiptapJson,
        content: tiptapJson.content.map((child: any) =>
          this.replaceImagePlaceholders(child, imageMapping)
        ),
      };
    }

    return tiptapJson;
  }

  private extractPlainText(node: any): string {
    if (!node) return '';
    if (node.text) return node.text;
    if (Array.isArray(node.content)) {
      return node.content.map((child: any) => this.extractPlainText(child)).join(' ');
    }
    return '';
  }


  async stop(): Promise<void> {
    await rabbitmqService.close();
    logger.info('TipTap Document processor worker stopped');
  }
}

export default new DocumentProcessorTipTap();
