import {DocumentContentModel, IDocumentContent} from '@/models/document-content.model';
import {NotFoundError} from '@/shared/errors/AppError';
import {Try} from '@/shared/utils/Try';
import logger from '@/shared/logger';

class DocumentContentService {
  /**
   * Get TipTap JSON content by contribution file ID
   */
  async getByContributionFileId(contributionFileId: number): Promise<IDocumentContent | null> {
    return Try.execute(async () => {
      const content = await DocumentContentModel.findOne({ contributionFileId });
      
      if (!content) {
        logger.warn(`Document content not found for contributionFileId: ${contributionFileId}`);
        return null;
      }

      return content;
    }).orElseThrow('Error fetching document content from MongoDB');
  }

  /**
   * Get TipTap JSON content by contribution ID
   */
  async getByContributionId(contributionId: number): Promise<IDocumentContent[]> {
    return Try.execute(async () => {
      return DocumentContentModel.find({contributionId}).sort({createdAt: -1});
    }).orElseThrow('Error fetching document contents from MongoDB');
  }

  /**
   * Delete document content by contribution file ID
   */
  async deleteByContributionFileId(contributionFileId: number): Promise<void> {
    return Try.execute(async () => {
      const result = await DocumentContentModel.deleteOne({ contributionFileId });
      
      if (result.deletedCount === 0) {
        throw new NotFoundError('Document content not found');
      }

      logger.info(`Document content deleted: contributionFileId=${contributionFileId}`);
    }).orElseThrow('Error deleting document content from MongoDB');
  }

  /**
   * Get aggregated statistics for all documents of a contribution
   */
  async getStatisticsByContributionId(contributionId: number) {
    return Try.execute(async () => {
      const contents = await DocumentContentModel.find({ contributionId });

      if (contents.length === 0) {
        throw new NotFoundError('No processed documents found for this contribution');
      }

      return {
        contributionId,
        documentCount: contents.length,
        totalWordCount: contents.reduce((sum: number, c: IDocumentContent) => sum + (c.metadata.wordCount || 0), 0),
        totalCharacterCount: contents.reduce((sum: number, c: IDocumentContent) => sum + (c.metadata.characterCount || 0), 0),
        totalUploadedImages: contents.reduce((sum: number, c: IDocumentContent) => sum + (c.uploadedImages?.length || 0), 0),
        documents: contents.map((c: IDocumentContent) => ({
          contributionFileId: c.contributionFileId,
          wordCount: c.metadata.wordCount,
          characterCount: c.metadata.characterCount,
          processedAt: c.metadata.processedAt,
          processingDuration: c.metadata.processingDuration,
        })),
      };
    }).orElseThrow('Error fetching document statistics by contribution ID');
  }

  /**
   * Get document statistics
   */
  async getStatistics(contributionFileId: number) {
    return Try.execute(async () => {
      const content = await DocumentContentModel.findOne({ contributionFileId });
      
      if (!content) {
        throw new NotFoundError('Document content not found');
      }

      return {
        contributionFileId: content.contributionFileId,
        contributionId: content.contributionId,
        wordCount: content.metadata.wordCount,
        characterCount: content.metadata.characterCount,
        uploadedImageCount: content.uploadedImages?.length || 0,
        processedAt: content.metadata.processedAt,
        processingDuration: content.metadata.processingDuration,
      };
    }).orElseThrow('Error fetching document statistics');
  }
}

export default new DocumentContentService();
