import * as path from 'path';

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.png',
  '.webp',
  '.jpg',
  '.jpeg',
]);

/** Default UNC prefix used in Excel export (case-insensitive match). */
export const DEFAULT_UPLOAD_UNC_PREFIX =
  '\\\\TkGravity\\docker\\vi-system\\uploads';

/** Public API base for upload URLs when PUBLIC_BASE_URL is unset (includes /api). */
export const DEFAULT_PUBLIC_BASE_URL = 'http://192.168.50.100:9444/api';

function isLocalhostHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export function isLocalhostBaseUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  try {
    return isLocalhostHost(new URL(trimmed).hostname);
  } catch {
    return /localhost|127\.0\.0\.1/i.test(trimmed);
  }
}

export function resolvePublicBaseUrl(configured?: string | null): string {
  const trimmed = configured?.trim();
  if (trimmed && !isLocalhostBaseUrl(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }
  return DEFAULT_PUBLIC_BASE_URL;
}

export function normalizePathKey(input: string): string {
  return input
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '')
    .toLowerCase();
}

export function isHttpUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

export function isAllowedImageExtension(ext: string): boolean {
  return ALLOWED_IMAGE_EXTENSIONS.has(ext.toLowerCase());
}

export function isAbsoluteFilesystemPath(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('\\\\')) return true;
  if (/^[a-zA-Z]:[/\\]/.test(trimmed)) return true;
  return path.isAbsolute(trimmed);
}

/**
 * Extract path relative to the uploads root, e.g. `images/foo.jpg`.
 */
export function extractUploadRelativePath(
  input: string,
  uncPrefix?: string,
): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const normalizedInput = normalizePathKey(trimmed);
  const prefixKey = normalizePathKey(
    uncPrefix?.trim() || DEFAULT_UPLOAD_UNC_PREFIX,
  );

  if (normalizedInput.startsWith(`${prefixKey}/`)) {
    return normalizedInput.slice(prefixKey.length + 1);
  }

  const apiUploadMarker = '/api/upload/';
  const apiUploadIndex = normalizedInput.indexOf(apiUploadMarker);
  if (apiUploadIndex !== -1) {
    return normalizedInput.slice(apiUploadIndex + apiUploadMarker.length);
  }

  const uploadsMarker = '/uploads/';
  const markerIndex = normalizedInput.indexOf(uploadsMarker);
  if (markerIndex !== -1) {
    return normalizedInput.slice(markerIndex + uploadsMarker.length);
  }

  const uploadsSuffix = '/uploads';
  if (normalizedInput.endsWith(uploadsSuffix)) {
    return '';
  }

  if (normalizedInput.startsWith('images/')) {
    return normalizedInput;
  }

  return null;
}

export function resolveUploadFilesystemPath(
  relativePath: string,
  uploadRoot: string,
): string | null {
  const segments = relativePath
    .split(/[/\\]+/)
    .filter(Boolean)
    .filter((segment) => segment !== '.' && segment !== '..');

  if (!segments.length) {
    return null;
  }

  const rootResolved = path.resolve(uploadRoot);
  const candidate = path.resolve(path.join(rootResolved, ...segments));

  const rootWithSep =
    rootResolved.endsWith(path.sep) ? rootResolved : `${rootResolved}${path.sep}`;
  if (!candidate.startsWith(rootWithSep) && candidate !== rootResolved) {
    return null;
  }

  return candidate;
}

/**
 * Build ordered, unique filesystem paths to probe for an imported image.
 * Tries configured UPLOAD_ROOT first (Docker), then UNC prefix (Windows share), then the raw path.
 */
export function collectUploadFilesystemCandidates(
  input: string,
  relativePath: string,
  uploadRoot: string,
  uncPrefix?: string,
): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  const push = (candidate: string | null | undefined) => {
    if (!candidate) return;
    const key = candidate.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  push(resolveUploadFilesystemPath(relativePath, uploadRoot));

  const prefix = uncPrefix?.trim() || DEFAULT_UPLOAD_UNC_PREFIX;
  const uncRootKey = normalizePathKey(uploadRoot);
  const prefixKey = normalizePathKey(prefix);
  if (prefixKey !== uncRootKey) {
    push(resolveUploadFilesystemPath(relativePath, prefix));
  }

  if (isAbsoluteFilesystemPath(input)) {
    push(path.normalize(input.trim()));
  }

  return candidates;
}

export function buildUploadPublicUrl(
  filename: string,
  publicBaseUrl: string,
): string {
  const base = resolvePublicBaseUrl(publicBaseUrl);
  return `${base}/upload/images/${encodeURIComponent(filename)}`;
}

/**
 * Rewrite localhost / legacy upload URLs to the configured public base.
 */
export function rewriteUploadImageUrl(
  input: string,
  publicBaseUrl?: string | null,
): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  const base = resolvePublicBaseUrl(publicBaseUrl);

  const rewriteFromRelative = (relative: string | null): string | null => {
    if (!relative?.startsWith('images/')) return null;
    const filename = relative.slice('images/'.length);
    if (!filename) return null;
    return buildUploadPublicUrl(path.basename(filename), base);
  };

  const rewritten = rewriteFromRelative(extractUploadRelativePath(trimmed));
  if (rewritten) {
    return rewritten;
  }

  if (isHttpUrl(trimmed)) {
    try {
      const url = new URL(trimmed);
      const marker = '/upload/images/';
      const idx = url.pathname.indexOf(marker);
      if (idx !== -1) {
        const filename = decodeURIComponent(
          url.pathname.slice(idx + marker.length),
        );
        if (filename) {
          return buildUploadPublicUrl(path.basename(filename), base);
        }
      }
    } catch {
      // fall through
    }

    const legacyMatch = trimmed.match(/\/upload\/images\/([^/?#]+)/i);
    if (legacyMatch?.[1]) {
      return buildUploadPublicUrl(
        path.basename(decodeURIComponent(legacyMatch[1])),
        base,
      );
    }
  }

  if (isLocalhostBaseUrl(trimmed)) {
    throw new Error(`Refusing to persist localhost upload URL: ${trimmed}`);
  }

  return trimmed;
}

export function inferUploadRoot(uploadDir: string): string {
  const normalized = uploadDir.replace(/\\/g, '/');
  if (normalized.endsWith('/images')) {
    return path.dirname(uploadDir);
  }
  return uploadDir;
}
