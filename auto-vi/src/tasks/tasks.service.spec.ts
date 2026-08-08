import { BadRequestException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { UploadPathService } from '../upload/upload-path.service';
import { CreateTaskDto } from './dto/create-task.dto';

describe('TasksService asset normalization', () => {
  const resolveMediaForStorage = jest.fn<Promise<string>, [string, 'image' | 'video']>();
  let service: TasksService;

  beforeEach(() => {
    resolveMediaForStorage.mockReset();
    resolveMediaForStorage.mockImplementation(async (assetPath, assetType) => {
      const expectedFolder = assetType === 'image' ? '/images/' : '/videos/';
      if (!assetPath.includes(expectedFolder)) {
        throw new Error(`素材路径与类型 ${assetType} 不匹配`);
      }
      return `stored:${assetPath}`;
    });
    service = new TasksService(
      {} as never,
      {} as never,
      {} as never,
      { resolveMediaForStorage } as unknown as UploadPathService,
    );
  });

  const normalize = (dto: Partial<CreateTaskDto>) =>
    (service as unknown as {
      normalizeAssets(input: CreateTaskDto): Promise<Array<{
        assetType: 'image' | 'video';
        assetPath: string;
        sortOrder: number;
      }>>;
    }).normalizeAssets(dto as CreateTaskDto);

  it('supports legacy imageList tasks', async () => {
    await expect(normalize({ imageList: ['/images/a.jpg', '/images/b.jpg'] })).resolves.toEqual([
      { assetType: 'image', assetPath: 'stored:/images/a.jpg', sortOrder: 0, meta: undefined },
      { assetType: 'image', assetPath: 'stored:/images/b.jpg', sortOrder: 1, meta: undefined },
    ]);
  });

  it('normalizes video-only assets and preserves their order', async () => {
    await expect(normalize({
      assets: [
        { assetType: 'video', assetPath: '/videos/a.mp4' },
        { assetType: 'video', assetPath: '/videos/b.webm' },
      ],
    })).resolves.toEqual([
      { assetType: 'video', assetPath: 'stored:/videos/a.mp4', sortOrder: 0, meta: undefined },
      { assetType: 'video', assetPath: 'stored:/videos/b.webm', sortOrder: 1, meta: undefined },
    ]);
    expect(resolveMediaForStorage).toHaveBeenNthCalledWith(1, '/videos/a.mp4', 'video');
    expect(resolveMediaForStorage).toHaveBeenNthCalledWith(2, '/videos/b.webm', 'video');
  });

  it('normalizes mixed media with stable sortOrder ordering', async () => {
    const result = await normalize({
      assets: [
        { assetType: 'video', assetPath: '/videos/a.mp4', sortOrder: 2 },
        { assetType: 'image', assetPath: '/images/a.jpg', sortOrder: 1 },
        { assetType: 'video', assetPath: '/videos/b.mp4', sortOrder: 1 },
      ],
    });

    expect(result.map(({ assetPath }) => assetPath)).toEqual([
      'stored:/images/a.jpg',
      'stored:/videos/b.mp4',
      'stored:/videos/a.mp4',
    ]);
    expect(resolveMediaForStorage).toHaveBeenCalledTimes(3);
  });

  it('rejects simultaneous assets and imageList', async () => {
    await expect(normalize({
      imageList: ['/images/legacy.jpg'],
      assets: [{ assetType: 'image', assetPath: '/images/new.jpg' }],
    })).rejects.toThrow(BadRequestException);
    expect(resolveMediaForStorage).not.toHaveBeenCalled();
  });

  it('rejects more than ten assets', async () => {
    const assets = Array.from({ length: 11 }, (_, index) => ({
      assetType: 'image' as const,
      assetPath: `/images/${index}.jpg`,
    }));

    await expect(normalize({ assets })).rejects.toThrow('No more than 10 media assets are allowed');
    expect(resolveMediaForStorage).not.toHaveBeenCalled();
  });

  it('rejects media paths that do not match their type', async () => {
    await expect(normalize({
      assets: [{ assetType: 'video', assetPath: '/images/not-video.jpg' }],
    })).rejects.toThrow('素材路径与类型 video 不匹配');
  });

  it('rejects negative sortOrder values', async () => {
    await expect(normalize({
      assets: [{ assetType: 'image', assetPath: '/images/a.jpg', sortOrder: -1 }],
    })).rejects.toThrow('sortOrder must be a non-negative integer');
    expect(resolveMediaForStorage).not.toHaveBeenCalled();
  });
});