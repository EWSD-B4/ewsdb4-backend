export interface Comment {
  id: number;
  contributionId: number;
  userId: number;
  content: string;
  commentedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommentRequest {
  contributionId: number;
  content: string;
}

export interface UpdateCommentRequest {
  content: string;
}

export interface CommentResponse {
  id: number;
  contributionId: number;
  userId: number;
  content: string;
  commentedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface CommentListQuery {
  contributionId?: number;
  userId?: number;
  limit?: number;
  offset?: number;
}
