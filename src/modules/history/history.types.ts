export interface SubmissionHistory {
  id: number;
  contributionId: number;
  userId: number;
  action: string;
  note: string | null;
  actionDate: Date;
  createdAt: Date;
}

export interface SubmissionHistoryResponse {
  id: number;
  contributionId: number;
  userId: number;
  action: string;
  note: string | null;
  actionDate: string;
  createdAt: string;
  user?: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
    role?: {
      roleCode: string;
      roleName: string;
    };
  };
}

export interface HistoryQuery {
  contributionId?: number;
  userId?: number;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}
