export interface AcademicYear {
  id: number;
  yearName: string;
  startDate: Date;
  endDate: Date;
  closureDate: Date | null;
  closureFinalDate: Date | null;
  isCurrent: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAcademicYearRequest {
  yearName: string;
  startDate: string;
  endDate: string;
  closureDate?: string;
  closureFinalDate?: string;
}

export interface UpdateAcademicYearRequest {
  yearName?: string;
  startDate?: string;
  endDate?: string;
  closureDate?: string;
  closureFinalDate?: string;
  isCurrent?: boolean;
  isActive?: boolean;
}

export interface AcademicYearResponse {
  id: number;
  yearName: string;
  startDate: string;
  endDate: string;
  closureDate: string | null;
  closureFinalDate: string | null;
  isCurrent: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
