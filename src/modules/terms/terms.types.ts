export interface TermsConditions {
  id: number;
  version: string;
  content: string;
  effectiveDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTermsRequest {
  version: string;
  content: string;
  effectiveDate: string;
}

export interface UpdateTermsRequest {
  content?: string;
  effectiveDate?: string;
  isActive?: boolean;
}

export interface TermsResponse {
  id: number;
  version: string;
  content: string;
  effectiveDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
