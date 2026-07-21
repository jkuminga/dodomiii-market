import { AdminMediaUsage, apiClient } from '../../lib/api';

export function formatAdminFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function uploadAdminImageAsset(file: File, usage: AdminMediaUsage) {
  const signed = await apiClient.signAdminUpload({
    usage,
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signed.apiKey);
  formData.append('timestamp', String(signed.timestamp));
  formData.append('signature', signed.signature);
  formData.append('folder', signed.folder);
  formData.append('public_id', signed.publicId);

  const uploadResponse = await fetch(signed.uploadUrl, {
    method: 'POST',
    body: formData,
  });

  const uploadResult = (await uploadResponse.json().catch(() => ({}))) as {
    public_id?: string;
    version?: number;
    secure_url?: string;
    signature?: string;
    resource_type?: 'image';
    format?: string;
    width?: number;
    height?: number;
    bytes?: number;
    error?: {
      message?: string;
    };
  };

  if (!uploadResponse.ok || !uploadResult.public_id || !uploadResult.version || !uploadResult.secure_url) {
    throw new Error(uploadResult.error?.message ?? 'Cloudinary 업로드에 실패했습니다.');
  }

  const finalized = await apiClient.finalizeAdminUpload({
    publicId: uploadResult.public_id,
    version: uploadResult.version,
    secureUrl: uploadResult.secure_url,
    signature: uploadResult.signature,
    resourceType: uploadResult.resource_type,
    format: uploadResult.format,
    width: uploadResult.width,
    height: uploadResult.height,
    bytes: uploadResult.bytes,
  });

  return finalized.secureUrl;
}
