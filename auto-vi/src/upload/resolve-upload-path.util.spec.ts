import {
  buildUploadPublicUrl,
  resolvePublicBaseUrl,
  rewriteUploadImageUrl,
  collectUploadFilesystemCandidates,
  extractUploadRelativePath,
  normalizePathKey,
} from './resolve-upload-path.util';

describe('resolve-upload-path.util', () => {
  it('normalizes UNC paths for prefix matching', () => {
    const input = '\\\\TkGravity\\docker\\vi-system\\uploads\\images\\file.jpg';
    expect(normalizePathKey(input)).toBe('tkgravity/docker/vi-system/uploads/images/file.jpg');
  });

  it('extracts relative path from UNC prefix', () => {
    const input = '\\\\TkGravity\\docker\\vi-system\\uploads\\images\\1784007310656-file.jpg';
    expect(extractUploadRelativePath(input)).toBe('images/1784007310656-file.jpg');
  });

  it('extracts relative path from /api/upload/ URL', () => {
    const input = 'http://localhost:3002/api/upload/images/file.jpg';
    expect(extractUploadRelativePath(input)).toBe('images/file.jpg');
  });

  it('collects UNC fallback when UPLOAD_ROOT is Docker path', () => {
    const input = '\\\\TkGravity\\docker\\vi-system\\uploads\\images\\file.jpg';
    const relative = extractUploadRelativePath(input)!;
    const candidates = collectUploadFilesystemCandidates(
      input,
      relative,
      '/app/uploads',
      '\\\\TkGravity\\docker\\vi-system\\uploads',
    );
    expect(candidates).toEqual([
      'C:\\app\\uploads\\images\\file.jpg',
      '\\\\TkGravity\\docker\\vi-system\\uploads\\images\\file.jpg',
    ]);
  });

  it('uses default public base when unset or localhost', () => {
    expect(resolvePublicBaseUrl(undefined)).toBe('http://192.168.50.100:9444/api');
    expect(resolvePublicBaseUrl('http://localhost:3002/api')).toBe(
      'http://192.168.50.100:9444/api',
    );
    expect(resolvePublicBaseUrl('  http://example.com/api/  ')).toBe('http://example.com/api');
  });

  it('builds public upload URL', () => {
    expect(buildUploadPublicUrl('a b.jpg', 'http://192.168.50.100:9444/api')).toBe(
      'http://192.168.50.100:9444/api/upload/images/a%20b.jpg',
    );
  });

  it('rewrites localhost upload URLs', () => {
    expect(
      rewriteUploadImageUrl('http://localhost:3002/api/upload/images/20260527-150920.jpg'),
    ).toBe('http://192.168.50.100:9444/api/upload/images/20260527-150920.jpg');
  });
});
