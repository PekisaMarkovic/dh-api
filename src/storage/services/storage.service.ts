import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { slugify } from '@/common/helpers';
import {
  STORAGE_ROOT_LOCAL,
  STORAGE_ROOT_PRODUCTION,
} from '@/storage/storage.constants';

/** Cloudflare R2 (S3 compatible). The keys are `<production|local>/company-<name>-<id>/<folder>/<id>/<file>` */
@Injectable()
export class StorageService {
  private client?: S3Client;

  constructor(private readonly configService: ConfigService) {}

  /** `production` for the production api, `local` for everything else, so testing never touches the real images */
  get rootFolder(): string {
    return this.configService
      .get<string>('ENVIROMENT')
      ?.trim()
      .toLowerCase() === 'production'
      ? STORAGE_ROOT_PRODUCTION
      : STORAGE_ROOT_LOCAL;
  }

  /** `production/company-knez-bar-3/drinks/12` */
  drinkFolder(company: { companyId: number; name: string }, drinkId: number) {
    const name = slugify({ text: company.name, truncate: 50 }) || 'company';

    return `${this.rootFolder}/company-${name}-${company.companyId}/drinks/${drinkId}`;
  }

  /** `production/company-knez-bar-3/client/hero`, section: general (the logo), hero, story, promo */
  clientFolder(company: { companyId: number; name: string }, section: string) {
    const name = slugify({ text: company.name, truncate: 50 }) || 'company';

    return `${this.rootFolder}/company-${name}-${company.companyId}/client/${section}`;
  }

  async upload(key: string, body: Buffer, contentType: string) {
    await this.s3().send(
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  /** Never throws: a file that stays behind is not worth failing a request */
  async delete(key: string) {
    try {
      await this.s3().send(
        new DeleteObjectCommand({ Bucket: this.bucket(), Key: key }),
      );
    } catch {
      // ignored on purpose
    }
  }

  publicUrl(key: string | null | undefined): string | null {
    if (!key) {
      return null;
    }

    const base = this.required('R2_PUBLIC_URL').replace(/\/+$/, '');

    return `${base}/${key}`;
  }

  private bucket() {
    return this.required('R2_BUCKET_NAME');
  }

  private s3() {
    if (!this.client) {
      // R2_ENDPOINT may end with the bucket name, the sdk adds the bucket itself
      const endpoint = new URL(this.required('R2_ENDPOINT')).origin;

      this.client = new S3Client({
        region: 'auto',
        endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.required('R2_ACCESS_KEY'),
          secretAccessKey: this.required('R2_SECRET_ACCESS_KEY'),
        },
      });
    }

    return this.client;
  }

  private required(name: string): string {
    const value = this.configService.get<string>(name)?.trim();

    if (!value) {
      throw new InternalServerErrorException(`${name} is not set`);
    }

    return value;
  }
}
