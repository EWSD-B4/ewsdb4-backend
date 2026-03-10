import { db } from '@/shared/database';
import logger from '@/shared/logger';
import { BadRequestError, NotFoundError } from '@/shared/errors/AppError';
import { Try } from '@/shared/utils/Try';
import { CreateTermsRequest, UpdateTermsRequest, TermsResponse } from './terms.types';

class TermsService {
  async createTerms(data: CreateTermsRequest): Promise<TermsResponse> {
    return Try.execute(async () => {
      const existingVersion = await db.termsCondition.findUnique({
        where: { version: data.version },
      });

      if (existingVersion) {
        throw new BadRequestError('Terms version already exists');
      }

      const terms = await db.termsCondition.create({
        data: {
          version: data.version,
          content: data.content,
          effectiveDate: new Date(data.effectiveDate),
          isActive: false,
        },
      });

      logger.info(`Terms and conditions created: ${terms.version}`);

      return this.formatTerms(terms);
    }).orElseThrow('Error creating terms and conditions');
  }

  async getAllTerms(includeInactive = false): Promise<TermsResponse[]> {
    return Try.execute(async () => {
      const terms = await db.termsCondition.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: { effectiveDate: 'desc' },
      });

      return terms.map((term) => this.formatTerms(term));
    }).orElseThrow('Error fetching terms and conditions');
  }

  async getTermsById(id: number): Promise<TermsResponse> {
    return Try.execute(async () => {
      const terms = await db.termsCondition.findUnique({
        where: { id },
      });

      if (!terms) {
        throw new NotFoundError('Terms and conditions not found');
      }

      return this.formatTerms(terms);
    }).orElseThrow('Error fetching terms and conditions');
  }

  async getActiveTerms(): Promise<TermsResponse | null> {
    return Try.execute(async () => {
      const terms = await db.termsCondition.findFirst({
        where: { isActive: true },
        orderBy: { effectiveDate: 'desc' },
      });

      return terms ? this.formatTerms(terms) : null;
    }).orElseThrow('Error fetching active terms and conditions');
  }

  async updateTerms(id: number, data: UpdateTermsRequest): Promise<TermsResponse> {
    return Try.execute(async () => {
      const existingTerms = await db.termsCondition.findUnique({
        where: { id },
      });

      if (!existingTerms) {
        throw new NotFoundError('Terms and conditions not found');
      }

      if (data.isActive === true) {
        await db.termsCondition.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }

      const updateData: any = {};

      if (data.content !== undefined) updateData.content = data.content;
      if (data.effectiveDate !== undefined)
        updateData.effectiveDate = new Date(data.effectiveDate);
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const terms = await db.termsCondition.update({
        where: { id },
        data: updateData,
      });

      logger.info(`Terms and conditions updated: ${terms.version}`);

      return this.formatTerms(terms);
    }).orElseThrow('Error updating terms and conditions');
  }

  async setActiveTerms(id: number): Promise<TermsResponse> {
    return Try.execute(async () => {
      const terms = await db.termsCondition.findUnique({
        where: { id },
      });

      if (!terms) {
        throw new NotFoundError('Terms and conditions not found');
      }

      await db.termsCondition.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      const updatedTerms = await db.termsCondition.update({
        where: { id },
        data: { isActive: true },
      });

      logger.info(`Active terms and conditions set to: ${updatedTerms.version}`);

      return this.formatTerms(updatedTerms);
    }).orElseThrow('Error setting active terms and conditions');
  }

  async deleteTerms(id: number): Promise<void> {
    return Try.execute(async () => {
      const terms = await db.termsCondition.findUnique({
        where: { id },
      });

      if (!terms) {
        throw new NotFoundError('Terms and conditions not found');
      }

      if (terms.isActive) {
        throw new BadRequestError('Cannot delete active terms and conditions');
      }

      const agreementCount = await db.agreement.count({
        where: { termsId: id },
      });

      if (agreementCount > 0) {
        await db.termsCondition.update({
          where: { id },
          data: { isActive: false },
        });
        logger.info(`Terms and conditions soft deleted: ${terms.version}`);
      } else {
        await db.termsCondition.delete({
          where: { id },
        });
        logger.info(`Terms and conditions hard deleted: ${terms.version}`);
      }
    }).orElseThrow('Error deleting terms and conditions');
  }

  private formatTerms(terms: any): TermsResponse {
    return {
      id: terms.id,
      version: terms.version,
      content: terms.content,
      effectiveDate: terms.effectiveDate.toISOString(),
      isActive: terms.isActive,
      createdAt: terms.createdAt.toISOString(),
      updatedAt: terms.updatedAt.toISOString(),
    };
  }
}

export default new TermsService();
