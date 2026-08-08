import {
  inferMediaExtension,
  sortAndValidateMediaAssets,
} from './consumer.service';
import { mediaPreviewLocator } from '../core/browser/creative-studio.helper';

describe('consumer media helpers', () => {
  it('sorts all mixed media by sortOrder and assetId', () => {
    const assets = [
      {
        assetId: 4,
        assetType: 'video' as const,
        assetPath: 'four.mp4',
        sortOrder: 2,
      },
      {
        assetId: 3,
        assetType: 'image' as const,
        assetPath: 'three.jpg',
        sortOrder: 1,
      },
      {
        assetId: 2,
        assetType: 'video' as const,
        assetPath: 'two.mp4',
        sortOrder: 1,
      },
    ];
    expect(
      sortAndValidateMediaAssets(assets).map((asset) => asset.assetId),
    ).toEqual([2, 3, 4]);
  });
  it('rejects unsupported media types', () => {
    expect(() =>
      sortAndValidateMediaAssets([
        { assetId: 1, assetType: 'audio', assetPath: 'one.mp3' } as never,
      ]),
    ).toThrow();
  });
  it('scopes media previews to the chatbox container', () => {
    const previews = { name: 'previews' };
    const chatbox = { locator: jest.fn().mockReturnValue(previews) };
    const first = jest.fn().mockReturnValue(chatbox);
    const page = { locator: jest.fn().mockReturnValue({ first }) };

    expect(mediaPreviewLocator(page as never, 'img, video')).toBe(previews);
    expect(page.locator).toHaveBeenCalledWith(
      'fieldset[data-chatbox-part="container"]',
    );
    expect(first).toHaveBeenCalledTimes(1);
    expect(chatbox.locator).toHaveBeenCalledWith('img, video');
    expect(page.locator).not.toHaveBeenCalledWith('img, video');
  });
  it('preserves and infers media extensions', () => {
    expect(
      inferMediaExtension(
        'https://cdn.test/a.mov?token=1',
        'application/octet-stream',
        'video',
      ),
    ).toBe('.mov');
    expect(
      inferMediaExtension(
        'https://cdn.test/download?id=1',
        'image/png; charset=binary',
        'image',
      ),
    ).toBe('.png');
    expect(
      inferMediaExtension('https://cdn.test/download?id=2', undefined, 'video'),
    ).toBe('.mp4');
  });
});
