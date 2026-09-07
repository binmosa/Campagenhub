import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Base64 upload endpoint for avatars, campaign art and pitch media.
 *
 * The name a client sends is never used as a path. It used to be joined
 * straight onto the upload directory, so `filename: "../../dist/main.js"`
 * wrote anywhere the process could reach. Every file now gets a server-made
 * random name and an extension picked from a fixed list, which also means
 * two people uploading "photo.png" cannot overwrite each other.
 */
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
};

/** Base64 inflates by ~4/3, so this caps stored files at roughly 25 MB. */
const MAX_BASE64_LENGTH = 34_000_000;

@Controller('api/uploads')
export class UploadsController {
  @UseGuards(JwtAuthGuard)
  @Post()
  async uploadFile(@Body() body: { file: string; filename?: string }) {
    if (!body?.file) throw new BadRequestException('No file data provided');

    const matches = String(body.file).match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) throw new BadRequestException('Invalid file format. Expected a base64 data URI.');

    const mimeType = matches[1].toLowerCase();
    const data = matches[2];
    const ext = EXTENSION_BY_MIME[mimeType];
    if (!ext) {
      throw new BadRequestException(`Unsupported file type "${mimeType}". Allowed: images, mp4/webm/mov video, PDF.`);
    }
    if (data.length > MAX_BASE64_LENGTH) throw new BadRequestException('That file is too large (25 MB maximum).');

    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length) throw new BadRequestException('That file is empty.');

    const uploadDir = path.join(process.env.UPLOADS_DIR || path.join(process.cwd(), 'public'), 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    // Server-generated name: nothing from the request reaches the path.
    const filename = `${Date.now()}-${randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(uploadDir, filename), buffer);

    return { url: `/uploads/${filename}`, filename, mimeType };
  }
}
