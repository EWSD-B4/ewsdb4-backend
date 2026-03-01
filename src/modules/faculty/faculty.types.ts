export interface Faculty {
  id: number;
  facultyCode: string;
  facultyName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacultyListQuery {
  search?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}
