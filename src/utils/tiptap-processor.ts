import mammoth from 'mammoth';
import { ITipTapContent } from '@/models/document-content.model';

interface ProcessedDocument {
  tiptapJson: ITipTapContent;
  extractedImages: Array<{
    buffer: Buffer;
    contentType: string;
    index: number;
  }>;
  metadata: {
    wordCount: number;
    characterCount: number;
  };
}

export class TipTapProcessor {
  /**
   * Convert DOCX buffer to TipTap JSON format
   */
  async convertDocxToTipTap(buffer: Buffer): Promise<ProcessedDocument> {
    const extractedImages: Array<{
      buffer: Buffer;
      contentType: string;
      index: number;
    }> = [];

    // Convert DOCX to HTML first using mammoth
    const result = await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: (mammoth as any).images.inline(async (image: any) => {
          const contentType: string = image.contentType || 'image/png';
          const imageBuffer: Buffer = await image.read();
          const imageIndex = extractedImages.length;

          extractedImages.push({
            buffer: imageBuffer,
            contentType,
            index: imageIndex,
          });

          // Return placeholder that we'll replace with actual S3 URL later
          return {
            src: `__IMAGE_PLACEHOLDER_${imageIndex}__`,
          };
        }),
      }
    );

    const html = result.value;

    // Convert HTML to TipTap JSON structure
    const tiptapJson = this.htmlToTipTap(html);

    // Calculate metadata
    const plainText = this.extractPlainText(tiptapJson);
    const wordCount = plainText.split(/\s+/).filter((word) => word.length > 0).length;
    const characterCount = plainText.length;

    return {
      tiptapJson,
      extractedImages,
      metadata: {
        wordCount,
        characterCount,
      },
    };
  }

  /**
   * Convert HTML to TipTap JSON structure
   */
  private htmlToTipTap(html: string): ITipTapContent {
    const doc: ITipTapContent = {
      type: 'doc',
      content: [] as ITipTapContent[],
    };

    // Parse HTML and convert to TipTap nodes
    doc.content = this.parseHTML(html);

    return doc;
  }

  /**
   * Parse HTML string to TipTap structure using regex
   */
  private parseHTML(html: string): ITipTapContent[] {
    const result: ITipTapContent[] = [];
    
    // Clean up HTML
    html = html.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');

    // Parse paragraphs
    const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gi;
    let match;
    
    while ((match = paragraphRegex.exec(html)) !== null) {
      const content = this.parseInlineContent(match[1]);
      if (content.length > 0) {
        result.push({
          type: 'paragraph',
          content,
        });
      }
    }

    // Parse headings
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
    while ((match = headingRegex.exec(html)) !== null) {
      const level = parseInt(match[1]);
      const content = this.parseInlineContent(match[2]);
      if (content.length > 0) {
        result.push({
          type: 'heading',
          attrs: { level },
          content,
        });
      }
    }

    // Parse lists
    const ulRegex = /<ul[^>]*>(.*?)<\/ul>/gi;
    while ((match = ulRegex.exec(html)) !== null) {
      const items = this.parseListItems(match[1]);
      if (items.length > 0) {
        result.push({
          type: 'bulletList',
          content: items,
        });
      }
    }

    const olRegex = /<ol[^>]*>(.*?)<\/ol>/gi;
    while ((match = olRegex.exec(html)) !== null) {
      const items = this.parseListItems(match[1]);
      if (items.length > 0) {
        result.push({
          type: 'orderedList',
          content: items,
        });
      }
    }

    // Parse images
    const imgRegex = /<img[^>]*src=["']([^"']*)["'][^>]*>/gi;
    while ((match = imgRegex.exec(html)) !== null) {
      result.push({
        type: 'image',
        attrs: {
          src: match[1],
          alt: '',
          title: '',
        },
      });
    }

    return result.length > 0 ? result : [{
      type: 'paragraph',
      content: [{ type: 'text', text: '' } as ITipTapContent],
    }];
  }

  /**
   * Parse inline content (text with marks like bold, italic)
   */
  private parseInlineContent(html: string): ITipTapContent[] {
    // Remove leading/trailing whitespace
    html = html.trim();
    if (!html) {
      return [{ type: 'text', text: '' } as ITipTapContent];
    }

    // Handle bold text
    const boldRegex = /<(strong|b)>(.*?)<\/(strong|b)>/gi;
    const italicRegex = /<(em|i)>(.*?)<\/(em|i)>/gi;
    const underlineRegex = /<u>(.*?)<\/u>/gi;
    const codeRegex = /<code>(.*?)<\/code>/gi;

    // For simplicity, just handle the most common case: plain text or single mark
    if (boldRegex.test(html)) {
      const match = html.match(/<(strong|b)>(.*?)<\/(strong|b)>/i);
      if (match) {
        return [{
          type: 'text',
          marks: [{ type: 'bold' }],
          text: this.stripHtmlTags(match[2]),
        } as ITipTapContent];
      }
    }

    if (italicRegex.test(html)) {
      const match = html.match(/<(em|i)>(.*?)<\/(em|i)>/i);
      if (match) {
        return [{
          type: 'text',
          marks: [{ type: 'italic' }],
          text: this.stripHtmlTags(match[2]),
        } as ITipTapContent];
      }
    }

    if (underlineRegex.test(html)) {
      const match = html.match(/<u>(.*?)<\/u>/i);
      if (match) {
        return [{
          type: 'text',
          marks: [{ type: 'underline' }],
          text: this.stripHtmlTags(match[1]),
        } as ITipTapContent];
      }
    }

    if (codeRegex.test(html)) {
      const match = html.match(/<code>(.*?)<\/code>/i);
      if (match) {
        return [{
          type: 'text',
          marks: [{ type: 'code' }],
          text: this.stripHtmlTags(match[1]),
        } as ITipTapContent];
      }
    }

    // Plain text
    const text = this.stripHtmlTags(html);
    return text ? [{ type: 'text', text } as ITipTapContent] : [];
  }

  /**
   * Parse list items
   */
  private parseListItems(html: string): ITipTapContent[] {
    const result: ITipTapContent[] = [];
    const liRegex = /<li[^>]*>(.*?)<\/li>/gi;
    let match;

    while ((match = liRegex.exec(html)) !== null) {
      const content = this.parseInlineContent(match[1]);
      result.push({
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content,
        }],
      });
    }

    return result;
  }

  /**
   * Strip HTML tags from string
   */
  private stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Extract plain text from TipTap JSON for metadata
   */
  private extractPlainText(node: ITipTapContent): string {
    if (node.text) {
      return node.text;
    }

    if (node.content && Array.isArray(node.content)) {
      return node.content.map((child) => this.extractPlainText(child)).join(' ');
    }

    return '';
  }

  /**
   * Replace image placeholders with actual S3 URLs
   */
  replaceImagePlaceholders(
    tiptapJson: ITipTapContent,
    imageMapping: Map<number, string>
  ): ITipTapContent {
    if (tiptapJson.type === 'image' && tiptapJson.attrs?.src) {
      const match = tiptapJson.attrs.src.match(/__IMAGE_PLACEHOLDER_(\d+)__/);
      if (match) {
        const imageIndex = parseInt(match[1]);
        const s3Url = imageMapping.get(imageIndex);
        if (s3Url) {
          return {
            ...tiptapJson,
            attrs: {
              ...tiptapJson.attrs,
              src: s3Url,
            },
          };
        }
      }
    }

    if (tiptapJson.content && Array.isArray(tiptapJson.content)) {
      return {
        ...tiptapJson,
        content: tiptapJson.content.map((child) =>
          this.replaceImagePlaceholders(child, imageMapping)
        ),
      };
    }

    return tiptapJson;
  }
}

export default new TipTapProcessor();
