export interface Document {
  id: string;
  userId: string;
  fileName: string;
  originalName: string;
  s3Key: string;
  contentType: string;
  fileSize: number;
  status: DocumentStatus;
  processingError?: string;
  convertedHtmlKey?: string;
  convertedJsonKey?: string;
  uploadedAt: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum DocumentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface UploadDocumentRequest {
  file: Express.Multer.File;
}

export interface DocumentResponse {
  id: string;
  fileName: string;
  originalName: string;
  contentType: string;
  fileSize: number;
  status: DocumentStatus;
  uploadedAt: Date;
  processedAt?: Date;
}
