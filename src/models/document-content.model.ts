import mongoose, { Schema, Document } from 'mongoose';

export interface ITipTapContent {
  type: string;
  content?: ITipTapContent[];
  attrs?: Record<string, any>;
  text?: string;
  marks?: Array<{
    type: string;
    attrs?: Record<string, any>;
  }>;
}

export interface IDocumentContent extends Document {
  contributionFileId: number;
  contributionId: number;
  tiptapJson: ITipTapContent;
  plainText?: string;
  uploadedImages: Array<{
    s3Key: string;
    alt?: string;
    title?: string;
  }>;
  plagiarismCheck?: {
    checked: boolean;
    checkedAt: Date;
    matches: Array<{
      contributionFileId: number;
      contributionId: number;
      similarityScore: number;
      matchedExcerpt?: string;
    }>;
  };
  metadata: {
    wordCount: number;
    characterCount: number;
    processedAt: Date;
    processingDuration?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DocumentContentSchema = new Schema<IDocumentContent>(
  {
    contributionFileId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    contributionId: {
      type: Number,
      required: true,
      index: true,
    },
    tiptapJson: {
      type: Schema.Types.Mixed,
      required: true,
    },
    uploadedImages: [
      {
        s3Key: { type: String, required: true },
        alt: { type: String },
        title: { type: String },
      },
    ],
    plainText: {
      type: String,
    },
    plagiarismCheck: {
      checked: { type: Boolean, default: false },
      checkedAt: { type: Date },
      matches: [
        {
          contributionFileId: { type: Number, required: true },
          contributionId: { type: Number, required: true },
          similarityScore: { type: Number, required: true },
          matchedExcerpt: { type: String },
        },
      ],
    },
    metadata: {
      wordCount: { type: Number, default: 0 },
      characterCount: { type: Number, default: 0 },
      processedAt: { type: Date, default: Date.now },
      processingDuration: { type: Number },
    },
  },
  {
    timestamps: true,
    collection: 'document_contents',
  }
);

// Indexes for efficient queries
DocumentContentSchema.index({ contributionId: 1, createdAt: -1 });

export const DocumentContentModel = mongoose.model<IDocumentContent>(
  'DocumentContent',
  DocumentContentSchema
);
