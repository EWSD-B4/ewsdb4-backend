export interface ContributionsByFacultyReport {
  facultyId: number;
  facultyName: string;
  facultyCode: string;
  academicYearId: number;
  academicYearName: string;
  contributionCount: number;
}

export interface ContributorsByFacultyReport {
  facultyId: number;
  facultyName: string;
  facultyCode: string;
  academicYearId: number;
  academicYearName: string;
  contributorCount: number;
}

export interface ContributionPercentageReport {
  facultyId: number;
  facultyName: string;
  facultyCode: string;
  academicYearId: number;
  academicYearName: string;
  contributionCount: number;
  percentage: number;
}

export interface ExceptionReport {
  id: number;
  title: string;
  submittedAt: string | null;
  daysSinceSubmission: number;
  user: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  faculty: {
    id: number;
    facultyName: string;
  };
  coordinator?: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

export interface SystemUsageReport {
  totalUsers: number;
  totalContributions: number;
  totalComments: number;
  totalSelectedContributions: number;
  activeAcademicYears: number;
  activeFaculties: number;
  contributionsByStatus: {
    status: string;
    count: number;
  }[];
}

export interface ReportQuery {
  academicYearId?: number;
  facultyId?: number;
  startDate?: string;
  endDate?: string;
}
