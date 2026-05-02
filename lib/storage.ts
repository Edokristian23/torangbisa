import crypto from 'crypto';

export function hashBuffer(buffer: Buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function buildDocumentDownloadHeaders(params: {
  mimeType: string;
  originalName: string;
  inline?: boolean;
  fileSize?: number;
}) {
  const inline = params.inline ?? isInlinePreviewable(params.mimeType);
  return {
    'Content-Type': params.mimeType || 'application/octet-stream',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(params.originalName)}"`,
    'Cache-Control': 'private, max-age=60',
    ...(typeof params.fileSize === 'number' ? { 'Content-Length': String(params.fileSize) } : {}),
  };
}

export function isInlinePreviewable(mimeType: string) {
  return [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'text/plain',
  ].includes(mimeType);
}
