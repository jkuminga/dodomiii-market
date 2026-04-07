import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';

import { AdminMediaFinalizeDto } from './dto/admin-media-finalize.dto';
import { AdminMediaSignUploadDto } from './dto/admin-media-sign-upload.dto';

type SignedUploadResponse = {
  uploadUrl: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  publicId: string;
  signature: string;
  maxBytes: number;
};

type FinalizedMediaResponse = {
  publicId: string;
  version: number;
  secureUrl: string;
  optimizedUrl: string;
  resourceType: 'image';
  format: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
};

const usagePolicy: Record<AdminMediaSignUploadDto['usage'], { folder: string; maxBytes: number }> = {
  HOME_POPUP: {
    folder: 'home-popups',
    maxBytes: 5 * 1024 * 1024,
  },
  PRODUCT_THUMBNAIL: {
    folder: 'product-thumbnails',
    maxBytes: 5 * 1024 * 1024,
  },
  PRODUCT_DETAIL: {
    folder: 'product-details',
    maxBytes: 10 * 1024 * 1024,
  },
};

@Injectable()
export class AdminMediaService {
  constructor(private readonly configService: ConfigService) {}

  createSignedUpload(dto: AdminMediaSignUploadDto): SignedUploadResponse {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME', '').trim();
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY', '').trim();
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET', '').trim();
    const baseFolder = this.configService.get<string>('CLOUDINARY_UPLOAD_FOLDER', 'dodomi').trim();

    if (!cloudName || !apiKey || !apiSecret) {
      throw new InternalServerErrorException({
        code: 'MEDIA_NOT_CONFIGURED',
        message: '미디어 업로드 설정이 완료되지 않았습니다.',
      });
    }

    const policy = usagePolicy[dto.usage];

    if (dto.size && dto.size > policy.maxBytes) {
      throw new BadRequestException({
        code: 'MEDIA_FILE_TOO_LARGE',
        message: `허용 파일 용량(${policy.maxBytes} bytes)을 초과했습니다.`,
      });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const normalizedSuffix = this.normalizeFolderSuffix(dto.folderSuffix);
    const folderBase = `${baseFolder.replace(/\/+$/g, '')}/${policy.folder}`;
    const folder = normalizedSuffix ? `${folderBase}/${normalizedSuffix}` : folderBase;
    const publicId = `${dto.usage.toLowerCase()}-${randomUUID()}`;

    const paramsToSign = this.buildSignSource({
      folder,
      public_id: publicId,
      timestamp,
    });
    const signature = this.sign(paramsToSign, apiSecret);

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      cloudName,
      apiKey,
      timestamp,
      folder,
      publicId,
      signature,
      maxBytes: policy.maxBytes,
    };
  }

  finalizeUpload(dto: AdminMediaFinalizeDto): FinalizedMediaResponse {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME', '').trim();
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET', '').trim();

    if (!cloudName || !apiSecret) {
      throw new InternalServerErrorException({
        code: 'MEDIA_NOT_CONFIGURED',
        message: '미디어 업로드 설정이 완료되지 않았습니다.',
      });
    }

    if (dto.signature) {
      const signSource = this.buildSignSource({
        public_id: dto.publicId,
        version: dto.version,
      });
      const expectedSignature = this.sign(signSource, apiSecret);

      if (expectedSignature !== dto.signature) {
        throw new BadRequestException({
          code: 'MEDIA_SIGNATURE_INVALID',
          message: '업로드 검증에 실패했습니다.',
        });
      }
    }

    return {
      publicId: dto.publicId,
      version: dto.version,
      secureUrl: dto.secureUrl,
      optimizedUrl: `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/v${dto.version}/${dto.publicId}`,
      resourceType: 'image',
      format: dto.format ?? null,
      width: dto.width ?? null,
      height: dto.height ?? null,
      bytes: dto.bytes ?? null,
    };
  }

  private buildSignSource(params: Record<string, string | number>): string {
    return Object.entries(params)
      .filter(([, value]) => `${value}` !== '')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }

  private sign(value: string, secret: string): string {
    return createHash('sha1').update(`${value}${secret}`).digest('hex');
  }

  private normalizeFolderSuffix(folderSuffix?: string): string | null {
    if (!folderSuffix) {
      return null;
    }

    const normalized = folderSuffix
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

    return normalized || null;
  }
}
