import { db } from '@/shared/database';
import logger from '@/shared/logger';
import { BadRequestError, NotFoundError } from '@/shared/errors/AppError';
import { Try } from '@/shared/utils/Try';
import {
  AcademicYearResponse,
  CreateAcademicYearRequest,
  UpdateAcademicYearRequest,
} from './academic-year.types';

class AcademicYearService {
  private validateAcademicYearDates(data: {
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    closureDate?: string | Date | null;
    closureFinalDate?: string | Date | null;
  }): void {
    const startDate = data.startDate ? new Date(data.startDate) : null;
    const endDate = data.endDate ? new Date(data.endDate) : null;
    const closureDate = data.closureDate ? new Date(data.closureDate) : null;
    const closureFinalDate = data.closureFinalDate ? new Date(data.closureFinalDate) : null;

    if (startDate && endDate && endDate <= startDate) {
      throw new BadRequestError('End date must be after start date');
    }

    if (closureDate && closureFinalDate && closureFinalDate <= closureDate) {
      throw new BadRequestError('Final closure date must be after closure date');
    }
  }

  async createAcademicYear(data: CreateAcademicYearRequest): Promise<AcademicYearResponse> {
    return Try.execute(async () => {
      const existingYear = await db.academicYear.findUnique({
        where: { yearName: data.yearName },
      });

      if (existingYear) {
        throw new BadRequestError('Academic year with this name already exists');
      }

      this.validateAcademicYearDates(data);

      const academicYear = await db.academicYear.create({
        data: {
          yearName: data.yearName,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          closureDate: data.closureDate ? new Date(data.closureDate) : null,
          closureFinalDate: data.closureFinalDate ? new Date(data.closureFinalDate) : null,
          isCurrent: false,
          isActive: true,
        },
      });

      logger.info(`Academic year created: ${academicYear.yearName}`);

      return this.formatAcademicYear(academicYear);
    }).orElseThrow('Error creating academic year');
  }

  async getAcademicYears(includeInactive = false): Promise<AcademicYearResponse[]> {
    return Try.execute(async () => {
      const academicYears = await db.academicYear.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: { startDate: 'desc' },
      });

      return academicYears.map((year) => this.formatAcademicYear(year));
    }).orElseThrow('Error fetching academic years');
  }

  async getAcademicYearById(id: number): Promise<AcademicYearResponse> {
    return Try.execute(async () => {
      const academicYear = await db.academicYear.findUnique({
        where: { id },
      });

      if (!academicYear) {
        throw new NotFoundError('Academic year not found');
      }

      return this.formatAcademicYear(academicYear);
    }).orElseThrow('Error fetching academic year');
  }

  async getCurrentAcademicYear(): Promise<AcademicYearResponse | null> {
    return Try.execute(async () => {
      const academicYear = await db.academicYear.findFirst({
        where: { isCurrent: true, isActive: true },
      });

      return academicYear ? this.formatAcademicYear(academicYear) : null;
    }).orElseThrow('Error fetching current academic year');
  }

  async getActiveAcademicYearId(): Promise<number> {
    const year = await db.academicYear.findFirst({
      where: { isCurrent: true, isActive: true },
      select: { id: true },
    });
    if (!year) {
      throw new NotFoundError('No active academic year found');
    }
    return year.id;
  }

  async updateAcademicYear(
    id: number,
    data: UpdateAcademicYearRequest
  ): Promise<AcademicYearResponse> {
    return Try.execute(async () => {
      const existingYear = await db.academicYear.findUnique({
        where: { id },
      });

      if (!existingYear) {
        throw new NotFoundError('Academic year not found');
      }

      if (data.yearName && data.yearName !== existingYear.yearName) {
        const duplicateYear = await db.academicYear.findUnique({
          where: { yearName: data.yearName },
        });

        if (duplicateYear) {
          throw new BadRequestError('Academic year with this name already exists');
        }
      }

      if (data.isActive === true) {
        await db.academicYear.updateMany({
          where: { isActive: true, id: { not: id } },
          data: { isActive: false, isCurrent: false },
        });
      }

      if (data.isCurrent === true) {
        await db.academicYear.updateMany({
          where: { isCurrent: true, id: { not: id } },
          data: { isCurrent: false },
        });
      }

      this.validateAcademicYearDates({
        startDate: data.startDate ?? existingYear.startDate,
        endDate: data.endDate ?? existingYear.endDate,
        closureDate:
          data.closureDate !== undefined ? data.closureDate : existingYear.closureDate,
        closureFinalDate:
          data.closureFinalDate !== undefined
            ? data.closureFinalDate
            : existingYear.closureFinalDate,
      });

      const updateData: any = {};

      if (data.yearName !== undefined) updateData.yearName = data.yearName;
      if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
      if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
      if (data.closureDate !== undefined)
        updateData.closureDate = data.closureDate ? new Date(data.closureDate) : null;
      if (data.closureFinalDate !== undefined)
        updateData.closureFinalDate = data.closureFinalDate
          ? new Date(data.closureFinalDate)
          : null;
      if (data.isCurrent !== undefined) updateData.isCurrent = data.isCurrent;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const academicYear = await db.academicYear.update({
        where: { id },
        data: updateData,
      });

      logger.info(`Academic year updated: ${academicYear.yearName}`);

      return this.formatAcademicYear(academicYear);
    }).orElseThrow('Error updating academic year');
  }

  async setCurrentAcademicYear(id: number): Promise<AcademicYearResponse> {
    return Try.execute(async () => {
      const academicYear = await db.academicYear.findUnique({
        where: { id },
      });

      if (!academicYear) {
        throw new NotFoundError('Academic year not found');
      }

      if (!academicYear.isActive) {
        throw new BadRequestError('Cannot set inactive academic year as current');
      }

      await db.academicYear.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });

      const updatedYear = await db.academicYear.update({
        where: { id },
        data: { isCurrent: true },
      });

      logger.info(`Current academic year set to: ${updatedYear.yearName}`);

      return this.formatAcademicYear(updatedYear);
    }).orElseThrow('Error setting current academic year');
  }

  async deleteAcademicYear(id: number): Promise<void> {
    return Try.execute(async () => {
      const academicYear = await db.academicYear.findUnique({
        where: { id },
      });

      if (!academicYear) {
        throw new NotFoundError('Academic year not found');
      }

      if (academicYear.isCurrent) {
        throw new BadRequestError('Cannot delete the current academic year');
      }

      const contributionCount = await db.contribution.count({
        where: { academicYearId: id },
      });

      if (contributionCount > 0) {
        await db.academicYear.update({
          where: { id },
          data: { isActive: false },
        });
        logger.info(`Academic year soft deleted: ${academicYear.yearName}`);
      } else {
        await db.academicYear.delete({
          where: { id },
        });
        logger.info(`Academic year hard deleted: ${academicYear.yearName}`);
      }
    }).orElseThrow('Error deleting academic year');
  }

  async checkSubmissionAllowed(academicYearId: number): Promise<boolean> {
    return Try.execute(async () => {
      const academicYear = await db.academicYear.findUnique({
        where: { id: academicYearId },
      });

      if (!academicYear || !academicYear.isActive) {
        return false;
      }

      if (!academicYear.closureDate) {
        return true;
      }

      const now = new Date();
      return now < academicYear.closureDate;
    }).orElse(false);
  }

  async checkUpdateAllowed(academicYearId: number): Promise<boolean> {
    return Try.execute(async () => {
      const academicYear = await db.academicYear.findUnique({
        where: { id: academicYearId },
      });

      if (!academicYear || !academicYear.isActive) {
        return false;
      }

      if (!academicYear.closureFinalDate) {
        return true;
      }

      const now = new Date();
      return now < academicYear.closureFinalDate;
    }).orElse(false);
  }

  private formatAcademicYear(academicYear: any): AcademicYearResponse {
    return {
      id: academicYear.id,
      yearName: academicYear.yearName,
      startDate: academicYear.startDate.toISOString(),
      endDate: academicYear.endDate.toISOString(),
      closureDate: academicYear.closureDate ? academicYear.closureDate.toISOString() : null,
      closureFinalDate: academicYear.closureFinalDate
        ? academicYear.closureFinalDate.toISOString()
        : null,
      isCurrent: academicYear.isCurrent,
      isActive: academicYear.isActive,
      createdAt: academicYear.createdAt.toISOString(),
      updatedAt: academicYear.updatedAt.toISOString(),
    };
  }
}

export default new AcademicYearService();
