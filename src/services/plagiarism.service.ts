import stringSimilarity from 'string-similarity';
import { DocumentContentModel } from '@/models/document-content.model';
import logger from '@/shared/logger';

interface PlagiarismMatch {
  contributionFileId: number;
  contributionId: number;
  similarityScore: number;
  matchedExcerpt?: string;
}

class PlagiarismService {
  private readonly SIMILARITY_THRESHOLD = 0.7; // 70% similarity threshold
  private readonly EXCERPT_LENGTH = 200; // Characters to show in excerpt

  /**
   * Check document for plagiarism against all existing documents
   */
  async checkPlagiarism(
    plainText: string,
    currentContributionFileId: number
  ): Promise<PlagiarismMatch[]> {
    try {
      // Get all existing documents with plain text
      const existingDocuments = await DocumentContentModel.find({
        plainText: { $exists: true, $ne: null },
        contributionFileId: { $ne: currentContributionFileId }, // Exclude current document
      }).select('contributionFileId contributionId plainText');

      if (existingDocuments.length === 0) {
        logger.info('No existing documents to compare against');
        return [];
      }

      const matches: PlagiarismMatch[] = [];

      // Compare with each existing document
      for (const doc of existingDocuments) {
        if (!doc.plainText) continue;

        const similarity = stringSimilarity.compareTwoStrings(
          plainText.toLowerCase().trim(),
          doc.plainText.toLowerCase().trim()
        );

        // If similarity exceeds threshold, add to matches
        if (similarity >= this.SIMILARITY_THRESHOLD) {
          matches.push({
            contributionFileId: doc.contributionFileId,
            contributionId: doc.contributionId,
            similarityScore: Math.round(similarity * 100) / 100, // Round to 2 decimals
            matchedExcerpt: this.extractExcerpt(doc.plainText),
          });

          logger.warn(
            `Plagiarism detected: ${(similarity * 100).toFixed(1)}% similarity with contribution ${doc.contributionId}`
          );
        }
      }

      // Sort by similarity score (highest first)
      matches.sort((a, b) => b.similarityScore - a.similarityScore);

      return matches;
    } catch (error) {
      logger.error('Error checking plagiarism:', error);
      throw error;
    }
  }

  /**
   * Extract a short excerpt from the text
   */
  private extractExcerpt(text: string): string {
    const cleaned = text.trim();
    if (cleaned.length <= this.EXCERPT_LENGTH) {
      return cleaned;
    }
    return cleaned.substring(0, this.EXCERPT_LENGTH) + '...';
  }

  /**
   * Get detailed plagiarism report for a contribution
   */
  async getPlagiarismReport(contributionFileId: number) {
    const document = await DocumentContentModel.findOne({ contributionFileId });
    
    if (!document) {
      return null;
    }

    return {
      contributionFileId: document.contributionFileId,
      contributionId: document.contributionId,
      plagiarismCheck: document.plagiarismCheck || {
        checked: false,
        matches: [],
      },
      plainTextLength: document.plainText?.length || 0,
    };
  }

  /**
   * Calculate overall plagiarism risk level
   */
  getRiskLevel(matches: PlagiarismMatch[]): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    if (matches.length === 0) return 'none';

    const highestScore = matches[0].similarityScore;

    if (highestScore >= 0.95) return 'critical'; // 95%+
    if (highestScore >= 0.85) return 'high';     // 85-94%
    if (highestScore >= 0.75) return 'medium';   // 75-84%
    return 'low';                                 // 70-74%
  }
}

export default new PlagiarismService();
