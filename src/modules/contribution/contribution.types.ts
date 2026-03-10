export enum ContributionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  SELECTED = 'selected',
  REJECTED = 'rejected',
  PUBLISHED = 'published',
}

export interface Contribution {
  id: number;
  userId: number;
  academicYearId: number;
  facultyId: number;
  title: string;
  contentMd: string | null;
  status: string;
  submittedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContributionRequest {
  title: string;
  academicYearId: number;
}

export interface UpdateContributionRequest {
  title?: string;
  contentMd?: string;
}

export interface SubmitContributionRequest {
  termsId: number;
}

export interface ContributionResponse {
  id: number;
  userId: number;
  academicYearId: number;
  facultyId: number;
  title: string;
  contentMd: string | null;
  status: string;
  submittedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  academicYear?: {
    id: number;
    yearName: string;
  };
  faculty?: {
    id: number;
    facultyName: string;
    facultyCode: string;
  };
  files?: Array<{
    id: number;
    fileType: string | null;
    originalName: string | null;
    filePath: string | null;
    fileSize: bigint | null;
  }>;
  commentsCount?: number;
}

export interface ContributionListQuery {
  status?: string;
  academicYearId?: number;
  facultyId?: number;
  userId?: number;
  limit?: number;
  offset?: number;
  search?: string;
}
