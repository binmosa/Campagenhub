import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/uploads')
export class UploadsController {
  @UseGuards(JwtAuthGuard)
  @Post()
  async uploadFile(@Body() body: { file: string; filename?: string }) {
    // Accepts base64-encoded files
    if (!body.file) {
      return { error: 'No file data provided' };
    }

    // Parse base64
    const matches = body.file.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return { error: 'Invalid file format. Expected base64 data URI.' };
    }

    const mimeType = matches[1];
    const data = matches[2];
    const ext = mimeType.split('/')[1] || 'png';
    const filename = body.filename || `upload-${Date.now()}.${ext}`;
    
    const uploadDir = path.join(process.env.UPLOADS_DIR || path.join(process.cwd(), 'public'), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));

    return {
      url: `/uploads/${filename}`,
      filename,
      mimeType,
    };
  }
}
