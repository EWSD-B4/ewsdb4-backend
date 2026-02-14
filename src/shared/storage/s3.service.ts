import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import config from '@/config';
import logger from '@/shared/logger';
import {Readable} from 'stream';
import {Try} from '@/shared/utils/Try';

class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly documentPrefix: string;

  constructor() {
    this.s3Client = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    });
    this.bucketName = config.aws.s3.bucketName;
    this.documentPrefix = config.aws.s3.documentPrefix;
    logger.info('S3Service initialized');
  }

  async uploadFile(
    key: string,
    fileBuffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    return Try.execute(async () => {
      const fullKey = `${this.documentPrefix}${key}`;
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fullKey,
        Body: fileBuffer,
        ContentType: contentType,
        Metadata: metadata,
      });

      await this.s3Client.send(command);
      logger.info(`File uploaded successfully to S3: ${fullKey}`);
      return fullKey;
    }).orElseThrow('Error uploading file to S3', new Error('Failed to upload file to S3'));
  }

  async downloadFile(key: string): Promise<Buffer> {
    return Try.execute<Buffer>(async () => {
      const fullKey = key.startsWith(this.documentPrefix) ? key : `${this.documentPrefix}${key}`;
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fullKey,
      });

      const response = await this.s3Client.send(command);
      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    }).orElseThrow('Error downloading file from S3', new Error('Failed to download file from S3'));
  }

  async deleteFile(key: string): Promise<void> {
    return Try.execute(async () => {
      const fullKey = key.startsWith(this.documentPrefix) ? key : `${this.documentPrefix}${key}`;
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fullKey,
      });

      await this.s3Client.send(command);
      logger.info(`File deleted successfully from S3: ${fullKey}`);
    }).orElseThrow('Error deleting file from S3', new Error('Failed to delete file from S3'));
  }

  async fileExists(key: string): Promise<boolean> {
    return await Try.execute(async () => {
      const fullKey = key.startsWith(this.documentPrefix) ? key : `${this.documentPrefix}${key}`;
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: fullKey,
      });

      await this.s3Client.send(command);
      return true;
    }).orElseLogWarning('Error checking file existence in S3', false) as unknown as Promise<boolean>;
  }

  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    return Try.execute(async () => {
      const fullKey = key.startsWith(this.documentPrefix) ? key : `${this.documentPrefix}${key}`;
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fullKey,
      });

      return await getSignedUrl(this.s3Client, command, {expiresIn});
    }).orElseThrow('Error generating signed URL', new Error('Failed to generate signed URL'));
  }

  async getSignedUploadUrl(key: string, contentType: string, expiresIn: number = 3600): Promise<string> {
    return Try.execute(async () => {
      const fullKey = `${this.documentPrefix}${key}`;
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fullKey,
        ContentType: contentType,
      });

      return await getSignedUrl(this.s3Client, command, {expiresIn});
    }).orElseThrow('Error generating signed upload URL', new Error('Failed to generate signed upload URL'));
  }
}

export default new S3Service();
