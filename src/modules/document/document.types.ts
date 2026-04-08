export interface ContributionFileData {
  id: number;
  contributionId: number;
  fileType: string | null;
  originalName: string | null;
  storedName: string | null;
  filePath: string | null;
  fileSize: bigint | null;
  status?: DocumentStatus;
  processingError?: string;
  createdAt: Date;
  uploadedAt: Date | null;
}

export enum DocumentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface UploadContributionFileRequest {
  contributionId: number;
  file: Express.Multer.File;
  fileType: 'docx' | 'image';
}

export interface ContributionFileResponse {
  id: number;
  contributionId: number;
  fileType: string | null;
  originalName: string | null;
  storedName: string | null;
  filePath: string | null;
  fileSize: number | null;
  status: DocumentStatus;
  uploadedAt: Date | null;
  createdAt: Date;
}

export interface ConversionManifest {
  contributionFileId: number;
  contributionId: number;
  markdownS3Key: string;
  images: Array<{
    contributionFileId: number;
    s3Key: string;
    contentType: string;
  }>;
  convertedAt: string;
  warnings: unknown[];
}
