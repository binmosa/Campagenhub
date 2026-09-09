import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Where uploaded files live.
 *
 * Two backends, chosen by configuration rather than by code:
 *
 *  - **Cloudflare R2** when R2_BUCKET and its credentials are set. Files
 *    leave the server entirely, which is what makes the app safe to
 *    redeploy, rebuild or move — a container filesystem is temporary, and
 *    KYC images and pitch videos are not.
 *  - **Local disk** otherwise, so `npm run dev` and the e2e suite need no
 *    cloud account.
 *
 * Both return a URL the browser can load directly. R2 hands back an
 * absolute URL on the public bucket domain; local returns the relative
 * `/uploads/...` the API serves itself. Callers already handle both.
 */
@Injectable()
export class StorageService {
  private client: S3Client | null = null;
  private announced = false;

  private get bucket(): string {
    return process.env.R2_BUCKET || '';
  }

  /** R2 is used only when it is fully configured — a half-set bucket falls back to disk. */
  get usingR2(): boolean {
    return !!(
      this.bucket &&
      (process.env.R2_ACCOUNT_ID || process.env.R2_ENDPOINT) &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
    );
  }

  private get s3(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: 'auto',
        // R2's own endpoint by default. R2_ENDPOINT overrides it, which is
        // how this is exercised against a local S3-compatible server.
        endpoint:
          process.env.R2_ENDPOINT ||
          `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        forcePathStyle: !!process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
        },
      });
    }
    return this.client;
  }

  /**
   * The base the browser loads files from: a custom domain if you have one
   * (`https://cdn.campaignhubz.com`), otherwise the bucket's r2.dev address.
   * Trailing slashes are trimmed so joining is predictable.
   */
  private get publicBase(): string {
    return (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  }

  private announce(): void {
    if (this.announced) return;
    this.announced = true;
    console.log(
      this.usingR2
        ? `[Storage] Uploads go to R2 bucket "${this.bucket}"${this.publicBase ? ` served from ${this.publicBase}` : ' (no R2_PUBLIC_URL set — files will not be reachable)'}.`
        : '[Storage] Uploads go to local disk. Set R2_* to move them off the server.',
    );
  }

  /**
   * Store one file and return the URL to reach it.
   *
   * `prefix` groups objects in the bucket (avatars/, pitches/…) purely so
   * the bucket is browsable; it is not a security boundary.
   */
  async put(buffer: Buffer, extension: string, mimeType: string, prefix = 'uploads'): Promise<string> {
    this.announce();
    const key = `${prefix}/${Date.now()}-${randomUUID()}.${extension}`;

    if (!this.usingR2) return this.putLocal(buffer, key);

    if (!this.publicBase) {
      // Storing a file nobody can load is worse than refusing: the record
      // would point at a URL that never resolves.
      throw new InternalServerErrorException('R2_PUBLIC_URL is not configured, so uploads cannot be served.');
    }

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          // Hashed names never change contents, so they cache forever.
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch (e: any) {
      console.error(`[Storage] R2 upload failed: ${e?.message}`);
      throw new InternalServerErrorException('The file could not be stored. Please try again.');
    }

    return `${this.publicBase}/${key}`;
  }

  /** Disk fallback — the historical behaviour, still used in development. */
  private putLocal(buffer: Buffer, key: string): string {
    const root = process.env.UPLOADS_DIR || path.join(process.cwd(), 'public');
    const filePath = path.join(root, key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
    return `/${key}`;
  }
}
