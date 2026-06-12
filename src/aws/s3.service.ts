import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket?: string;
  private readonly publicBase?: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION') ?? 'us-east-1';
    this.bucket = this.configService.get<string>('S3_BUCKET') || undefined;
    this.publicBase = this.configService.get<string>('S3_PUBLIC_BASE_URL') || undefined;

    this.client = new S3Client({
      region,
      credentials:
        this.configService.get<string>('AWS_ACCESS_KEY_ID') &&
        this.configService.get<string>('AWS_SECRET_ACCESS_KEY')
          ? {
              accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
              secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
            }
          : undefined,
    });
  }

  assertConfigured() {
    if (!this.bucket) {
      throw new ServiceUnavailableException(
        'La carga de archivos no está configurada (falta S3_BUCKET)',
      );
    }
  }

  buildPublicUrl(key: string) {
    if (this.publicBase) {
      return `${this.publicBase.replace(/\/$/, '')}/${key}`;
    }
    return null;
  }

  async putBanner(eventId: string, buffer: Buffer, mimeType: string) {
    this.assertConfigured();
    const ext =
      mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const key = `events/${eventId}/${randomUUID()}.${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket!,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return { key, url: this.buildPublicUrl(key) };
  }

  async deleteObject(key: string) {
    this.assertConfigured();
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket!,
        Key: key,
      }),
    );
  }
}
