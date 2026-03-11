import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import TurndownService from 'turndown';

/**
 * Local test for DOCX to Markdown conversion
 * No S3, no database, no RabbitMQ - just pure conversion logic
 */

interface ImageData {
  index: number;
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

async function convertDocxToMarkdown(docxPath: string): Promise<{
  markdown: string;
  images: ImageData[];
  warnings: unknown[];
}> {
  console.log(`\n📄 Reading DOCX file: ${docxPath}`);
  
  const fileBuffer = fs.readFileSync(docxPath);
  const images: ImageData[] = [];

  console.log('🔄 Converting DOCX to HTML with image extraction...');
  
  const result = await mammoth.convertToHtml(
    { buffer: fileBuffer },
    {
      convertImage: (mammoth as any).images.inline(async (image: any) => {
        const contentType: string = image.contentType || 'application/octet-stream';
        const ext = contentType.includes('/') ? contentType.split('/')[1] : 'bin';
        const imageIndex = images.length + 1;
        const imageBuffer: Buffer = await image.read();
        const fileName = `image-${imageIndex}.${ext}`;

        console.log(`  📷 Extracted image ${imageIndex}: ${fileName} (${imageBuffer.length} bytes)`);

        images.push({
          index: imageIndex,
          buffer: imageBuffer,
          contentType,
          fileName,
        });

        // Return a placeholder path for the markdown
        return {
          src: `./images/${fileName}`,
        };
      }),
    }
  );

  const html: string = result.value;
  const warnings: unknown[] = result.messages;

  if (warnings.length > 0) {
    console.log(`⚠️  Conversion warnings:`, warnings);
  }

  console.log('🔄 Converting HTML to Markdown...');
  
  const turndownService = new TurndownService({
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    headingStyle: 'atx',
  });

  const markdown: string = turndownService.turndown(html);

  console.log(`✅ Conversion complete!`);
  console.log(`   - Markdown length: ${markdown.length} characters`);
  console.log(`   - Images extracted: ${images.length}`);

  return { markdown, images, warnings };
}

async function runTest() {
  console.log('🧪 DOCX to Markdown Conversion Test\n');
  console.log('=' .repeat(60));

  // Get DOCX file path from command line or use default
  const docxPath = process.argv[2] || path.join(__dirname, 'sample.docx');

  if (!fs.existsSync(docxPath)) {
    console.error(`\n❌ Error: DOCX file not found at: ${docxPath}`);
    console.log('\nUsage:');
    console.log('  npm run test:docx <path-to-docx-file>');
    console.log('\nOr place a sample.docx file in the test directory');
    process.exit(1);
  }

  try {
    const { markdown, images, warnings } = await convertDocxToMarkdown(docxPath);

    // Create output directory
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create images directory
    const imagesDir = path.join(outputDir, 'images');
    if (images.length > 0 && !fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Save markdown
    const markdownPath = path.join(outputDir, 'output.md');
    fs.writeFileSync(markdownPath, markdown, 'utf-8');
    console.log(`\n💾 Saved markdown to: ${markdownPath}`);

    // Save images
    for (const image of images) {
      const imagePath = path.join(imagesDir, image.fileName);
      fs.writeFileSync(imagePath, image.buffer);
      console.log(`💾 Saved image to: ${imagePath}`);
    }

    // Save metadata
    const metadata = {
      sourceFile: path.basename(docxPath),
      convertedAt: new Date().toISOString(),
      markdownLength: markdown.length,
      imageCount: images.length,
      images: images.map((img) => ({
        fileName: img.fileName,
        contentType: img.contentType,
        size: img.buffer.length,
      })),
      warnings,
    };

    const metadataPath = path.join(outputDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log(`💾 Saved metadata to: ${metadataPath}`);

    // Display markdown preview
    console.log('\n' + '='.repeat(60));
    console.log('📝 Markdown Preview (first 500 characters):');
    console.log('='.repeat(60));
    console.log(markdown.substring(0, 500));
    if (markdown.length > 500) {
      console.log('\n... (truncated)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(60));
    console.log(`\nOutput files saved to: ${outputDir}`);
    console.log('  - output.md (converted markdown)');
    console.log('  - metadata.json (conversion details)');
    if (images.length > 0) {
      console.log(`  - images/ (${images.length} extracted images)`);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
runTest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
