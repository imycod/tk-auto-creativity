import { existsSync } from 'fs';
import { resolve, win32 } from 'path';
import type { Locator, Page } from 'playwright';

/** 将 DB 中的 assetPath（URL / UNC / 本地路径）解析为 Playwright 可用的本地绝对路径 */
export function resolveLocalImagePaths(
  assetPaths: string[],
  sambaShare?: string,
): string[] {
  console.log('assetPaths---', assetPaths)
  console.log('sambaShare---', sambaShare)
  return assetPaths.map((raw) => {
    if (existsSync(raw)) {
      return resolve(raw);
    }

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const filename = decodeURIComponent(
        new URL(raw).pathname.split('/').pop() ?? '',
      );
      if (sambaShare && filename) {
        const sambaPath = win32.join(sambaShare, 'docker', 'vi-system', 'uploads', 'images', filename);
        if (existsSync(sambaPath)) {
          return sambaPath;
        }
      }
    }

    const relative = resolve(process.cwd(), raw);
    if (existsSync(relative)) {
      return relative;
    }

    throw new Error(`图片文件不存在: ${raw}`);
  });
}

/**
 * 上传图片到 TikTok Creative Studio。
 * 优先直接找 shadow DOM 内的 input[type=file]；
 * 找不到则拦截 filechooser，无需操作系统弹窗。
 */
const UPLOAD_BUTTON_SELECTOR =
  'button[aria-label="Upload"], button[aria-label="上传"], button[aria-label*="pload" i]';

/** Upload 下拉菜单项文案（不同 profile 语言/版本可能不同） */
const UPLOAD_MENU_TEXTS = [
  'Upload media',
  'Upload image',
  'Upload file',
  '上传媒体',
  '上传图片',
  '上传文件',
  '从电脑上传',
  '本地上传',
];

export async function uploadImagesToCreativeStudio(
  page: Page,
  imagePaths: string[],
): Promise<void> {
  await dismissUploadOverlays(page);

  const uploadBtn = page.locator(UPLOAD_BUTTON_SELECTOR);
  await uploadBtn.first().waitFor({ state: 'visible', timeout: 15000 });
  await uploadBtn.first().scrollIntoViewIfNeeded();

  let lastError: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await tryUploadImagesOnce(page, uploadBtn.first(), imagePaths);
      return;
    } catch (error) {
      lastError = error as Error;
      await dismissUploadOverlays(page);
      await page.waitForTimeout(600);
    }
  }

  throw lastError ?? new Error('图片上传失败');
}

/** 关闭可能遮挡 Upload 菜单的弹层/下拉 */
async function dismissUploadOverlays(page: Page): Promise<void> {
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.mouse.click(10, 10).catch(() => undefined);
  await page.waitForTimeout(200);
}

/** 单次上传尝试：先找 file input，再走 filechooser 兜底 */
async function tryUploadImagesOnce(
  page: Page,
  uploadBtn: Locator,
  imagePaths: string[],
): Promise<void> {
  const existingInput = await findUsableFileInput(page);
  if (existingInput) {
    await existingInput.setInputFiles(imagePaths);
    await waitForImagePreview(page);
    return;
  }

  // 必须在点击触发上传的控件之前注册监听，避免 filechooser 事件被错过
  const fileChooserPromise = page.waitForEvent('filechooser', {
    timeout: 20000,
  });

  await uploadBtn.hover().catch(() => undefined);
  await uploadBtn.click();

  // 轮询等待 file input 或下拉菜单出现（复用标签页时菜单渲染可能较慢）
  const openedInput = await waitForUsableFileInput(page, 5000);
  if (openedInput) {
    fileChooserPromise.catch(() => undefined);
    await openedInput.setInputFiles(imagePaths);
    await waitForImagePreview(page);
    return;
  }

  let clicked = await clickShadowDomByTexts(page, UPLOAD_MENU_TEXTS);
  if (!clicked) {
    // 菜单可能未展开，再点一次 Upload 后重试
    await uploadBtn.click();
    await page.waitForTimeout(500);
    clicked = await clickShadowDomByTexts(page, UPLOAD_MENU_TEXTS);
  }

  if (!clicked) {
    fileChooserPromise.catch(() => undefined);
    throw new Error(
      `未找到 Upload 菜单项（已尝试: ${UPLOAD_MENU_TEXTS.slice(0, 4).join(' / ')} 等），无法打开文件选择器`,
    );
  }

  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(imagePaths);
  await waitForImagePreview(page);
}

/** 查找可用的 file input（含 hidden，Playwright 可直接 setInputFiles） */
async function findUsableFileInput(page: Page): Promise<Locator | null> {
  const fileInput = page.locator('input[type="file"]');
  if ((await fileInput.count()) > 0) {
    return fileInput.first();
  }
  return null;
}

/** 轮询等待 file input 出现在 DOM 中 */
async function waitForUsableFileInput(
  page: Page,
  timeoutMs: number,
): Promise<Locator | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const input = await findUsableFileInput(page);
    if (input) {
      return input;
    }
    await page.waitForTimeout(200);
  }
  return null;
}

/**
 * 清空 Creative Studio 的输入框：移除已上传的图片并清空提示词。
 * 用于同一个浏览器连续处理多个任务时，提交完上一个任务后重置输入区域，
 * 再回填下一个任务的 promptText 与 imagePaths。
 */
export async function clearCreativeStudioInputs(page: Page): Promise<void> {
  await removeUploadedImages(page);
  await clearCreativeStudioPrompt(page);
}

/** 清空 ProseMirror 提示词输入框内容 */
export async function clearCreativeStudioPrompt(page: Page): Promise<void> {
  const editor = page.locator('div.ProseMirror[contenteditable="true"]');
  if ((await editor.count()) === 0) {
    return;
  }

  await editor.first().click().catch(() => undefined);
  await page.keyboard.press('Control+A').catch(() => undefined);
  await page.keyboard.press('Delete').catch(() => undefined);

  // 兜底：直接清空 DOM 内容
  await editor
    .first()
    .fill('')
    .catch(async () => {
      await page
        .evaluate(() => {
          const el = document.querySelector(
            'div.ProseMirror[contenteditable="true"]',
          );
          if (!el) return;
          el.innerHTML = '<p></p>';
          el.dispatchEvent(
            new InputEvent('input', { bubbles: true, inputType: 'deleteContent' }),
          );
        })
        .catch(() => undefined);
    });

  await page.waitForTimeout(200);
}

/**
 * 移除所有已上传图片的预览。
 * 反复点击预览上的删除/移除按钮，直到没有可移除项为止（最多尝试若干次）。
 */
async function removeUploadedImages(page: Page): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    const removed = await clickRemoveImageButton(page);
    if (!removed) {
      break;
    }
    await page.waitForTimeout(250);
  }
}

/**
 * 在普通 DOM 与 open shadow DOM 中查找“删除图片”按钮并点击一个。
 * 既匹配 aria-label / title / 文本里的 Delete、Remove、Close、删除、移除 关键字，
 * 也匹配按钮内含的关闭图标（如 <ks-icon-close-small>）。
 */
async function clickRemoveImageButton(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const keywords = ['delete', 'remove', 'close', '删除', '移除'];

    function matches(el: Element): boolean {
      const label = (
        (el.getAttribute('aria-label') ?? '') +
        ' ' +
        (el.getAttribute('title') ?? '') +
        ' ' +
        (el.textContent ?? '')
      ).toLowerCase();
      if (keywords.some((k) => label.includes(k))) {
        return true;
      }

      // 图标按钮没有文字，根据内部的关闭图标判断（如 ks-icon-close-small）
      const icon = el.querySelector(
        'ks-icon-close-small, [ks-icon*="close"], [class*="close"], [class*="Close"]',
      );
      return icon !== null;
    }

    function isVisible(el: HTMLElement): boolean {
      // 删除按钮默认 opacity-0，仅 hover 显示，但 display 不为 none 时 offsetParent 仍存在
      const rect = el.getBoundingClientRect();
      return el.offsetParent !== null || rect.width + rect.height > 0;
    }

    function walk(root: Document | ShadowRoot): HTMLElement | null {
      const candidates = root.querySelectorAll('button, [role="button"]');
      for (const el of candidates) {
        if (matches(el) && el instanceof HTMLElement && isVisible(el)) {
          return el;
        }
      }
      for (const node of root.querySelectorAll('*')) {
        const shadow = (node as Element).shadowRoot;
        if (shadow) {
          const found = walk(shadow);
          if (found) return found;
        }
      }
      return null;
    }

    const target = walk(document);
    if (!target) return false;
    target.click();
    return true;
  });
}

/** 填入 ProseMirror 提示词输入框 */
export async function fillCreativeStudioPrompt(
  page: Page,
  promptText: string,
): Promise<void> {
  const editor = page.locator('div.ProseMirror[contenteditable="true"]');
  await editor.waitFor({ state: 'visible', timeout: 15000 });
  await editor.first().click();

  // 先清掉残留内容
  await page.keyboard.press('Control+A').catch(() => undefined);
  await page.keyboard.press('Delete').catch(() => undefined);

  // ProseMirror 会拦截并重写 input 事件，locator.fill() 经常不生效，
  // 改用模拟逐字键入，最贴近真实输入，回填最可靠。
  await editor.first().pressSequentially(promptText, { delay: 10 });
  await page.waitForTimeout(200);

  // 校验是否真的写进去了；没写进去再用 DOM + InputEvent 兜底
  if (!(await promptFilled(editor, promptText))) {
    await page.evaluate((text) => {
      const el = document.querySelector(
        'div.ProseMirror[contenteditable="true"]',
      ) as HTMLElement | null;
      if (!el) return;
      el.focus();
      el.innerHTML = `<p>${text}</p>`;
      el.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: text,
        }),
      );
    }, promptText);
    await page.waitForTimeout(200);
  }

  if (!(await promptFilled(editor, promptText))) {
    throw new Error('提示词回填失败：输入框内容为空');
  }
}

/** 校验编辑器内是否已包含提示词（用前若干字符做包含判断，容忍空白差异） */
async function promptFilled(
  editor: Locator,
  promptText: string,
): Promise<boolean> {
  const current = normalizePrompt((await editor.first().textContent()) ?? '');
  const expected = normalizePrompt(promptText);
  if (!expected) return true;
  const probe = expected.slice(0, Math.min(10, expected.length));
  return current.includes(probe);
}

/**
 * 点击发送按钮提交（主色 icon-only 按钮），或在输入框按 Enter 兜底。
 */
export async function submitCreativeStudioPrompt(page: Page): Promise<void> {
  const chatbox = page.locator('fieldset[data-chatbox-part="container"]');
  const sendBtn = chatbox.locator(
    'button.button--icon-only.button--color-primary[part="base"], button.button--type-contained.button--icon-only.button--color-primary',
  );

  if ((await sendBtn.count()) > 0) {
    await sendBtn.last().click();
    await page.waitForTimeout(500);
    return;
  }

  const clicked = await clickShadowDomButton(page, {
    part: 'base',
    classes: [
      'button',
      'button--sm',
      'button--type-contained',
      'button--icon-only',
      'button--color-primary',
    ],
  });
  if (clicked) {
    await page.waitForTimeout(500);
    return;
  }

  const editor = page.locator('div.ProseMirror[contenteditable="true"]');
  await editor.press('Enter');
  await page.waitForTimeout(500);
}

async function waitForImagePreview(page: Page): Promise<void> {
  await page
    .waitForSelector(
      'img[alt^="image"], img[src^="blob:"], [class*="preview"] img, [class*="upload"] img',
      { timeout: 20000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(800);
}

/** 递归遍历 open shadow DOM，按任一匹配文本点击元素 */
async function clickShadowDomByTexts(
  page: Page,
  texts: string[],
): Promise<boolean> {
  return page.evaluate((searchTexts) => {
    function walk(root: Document | ShadowRoot): HTMLElement | null {
      const nodes = root.querySelectorAll(
        'li, button, [role="menuitem"], a, div, span',
      );
      for (const el of nodes) {
        const content = el.textContent?.trim() ?? '';
        if (!content || content.length >= 80) continue;
        if (searchTexts.some((t) => content.includes(t))) {
          return el as HTMLElement;
        }
        const aria = el.getAttribute('aria-label')?.trim() ?? '';
        if (aria && searchTexts.some((t) => aria.includes(t))) {
          return el as HTMLElement;
        }
      }
      for (const node of root.querySelectorAll('*')) {
        const shadow = (node as Element).shadowRoot;
        if (shadow) {
          const found = walk(shadow);
          if (found) return found;
        }
      }
      return null;
    }

    const target = walk(document);
    if (!target) return false;
    target.click();
    return true;
  }, texts);
}

/** 在 shadow DOM 中查找并点击匹配 class/part 的按钮 */
async function clickShadowDomButton(
  page: Page,
  match: { part?: string; classes: string[] },
): Promise<boolean> {
  return page.evaluate((match) => {
    function matchesButton(el: Element): boolean {
      if (el.tagName !== 'BUTTON') return false;
      if (match.part && el.getAttribute('part') !== match.part) return false;
      return match.classes.every((cls) => el.classList.contains(cls));
    }

    function walk(root: Document | ShadowRoot): HTMLElement | null {
      const buttons = root.querySelectorAll('button');
      for (const el of buttons) {
        if (matchesButton(el)) return el as HTMLElement;
      }
      for (const node of root.querySelectorAll('*')) {
        const shadow = (node as Element).shadowRoot;
        if (shadow) {
          const found = walk(shadow);
          if (found) return found;
        }
      }
      return null;
    }

    const target = walk(document);
    if (!target) return false;
    target.click();
    return true;
  }, match);
}

/**
 * 生成结果卡片选择器。
 * 最外层容器为 class="flex flex-col-reverse gap-6 m-auto w-[988px]"，
 * 其每一个直接子 div 就是一个「生成视频块」。
 */
const VIDEO_CARD_SELECTOR = 'div.flex.flex-col-reverse.gap-6 > div';

export interface DownloadResult {
  filePath: string;
  /** 从页面视频块中读取到的 promptText */
  promptText: string;
}

/** 归一化 promptText：去掉首尾空白并把连续空白折叠成单个空格，便于匹配 */
function normalizePrompt(text: string): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** 判断页面卡片上的 promptText 是否与任务的 promptText 对应 */
function promptMatches(cardPrompt: string, taskPrompt: string): boolean {
  const a = normalizePrompt(cardPrompt);
  const b = normalizePrompt(taskPrompt);
  if (!a || !b) return false;
  if (a === b) return true;
  // 页面文本可能被截断或注入了图片占位符，做包含兜底（要求有足够长度避免误匹配）
  const minLen = Math.min(a.length, b.length);
  if (minLen >= 12 && (a.includes(b) || b.includes(a))) return true;
  return false;
}

/**
 * 读取某个视频块的 promptText。
 * 对应 DOM：div.truncate-wrapper-* → ks-tooltip → div[style*="--multi-line-count"]
 * （--multi-line-count 这个内联样式比哈希类名稳定，作为主锚点）。
 */
async function extractCardPrompt(card: Locator): Promise<string> {
  return card
    .evaluate((cardEl) => {
      const el = cardEl as Element;
      const node =
        el.querySelector('div[style*="multi-line-count"]') ??
        el.querySelector('[class*="truncate-wrapper"] div');
      return node?.textContent?.trim() ?? '';
    })
    .catch(() => '');
}

/**
 * 遍历最外层容器里的所有视频块，找到 promptText 与任务匹配且「已生成完成」的块，
 * 深层展开（含 open shadow DOM）把 opacity-0 的悬浮控制栏改为 opacity-100，
 * 找到下载按钮（ks-icon[name="download"] 所在 button），点击并捕获浏览器下载，另存为 savePath。
 *
 * 返回 null 的情况：没有匹配 promptText 的块，或匹配的块尚未生成完成（无下载按钮）。
 */
export async function downloadVideoByPrompt(
  page: Page,
  promptText: string,
  savePath: string,
): Promise<DownloadResult | null> {
  const cards = page.locator(VIDEO_CARD_SELECTOR);
  const total = await cards.count();

  for (let i = 0; i < total; i += 1) {
    const card = cards.nth(i);

    const cardPrompt = await extractCardPrompt(card);
    if (!promptMatches(cardPrompt, promptText)) {
      continue;
    }

    await card.scrollIntoViewIfNeeded().catch(() => undefined);

    // 第一步：展开悬浮控制栏并检测下载按钮是否存在（生成完成才会出现）
    const ready = await revealAndDetectDownload(card);
    if (!ready) {
      // 命中的块还在生成中，本轮跳过，等下次轮询
      continue;
    }

    // 第二步：注册下载监听并点击下载按钮
    const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
    const clicked = await clickDownloadInCard(card);
    if (!clicked) {
      continue;
    }

    const download = await downloadPromise;
    await download.saveAs(savePath);
    return { filePath: savePath, promptText: cardPrompt };
  }

  return null;
}

/** 展开视频块里的悬浮控制栏并判断是否存在下载按钮 */
async function revealAndDetectDownload(card: Locator): Promise<boolean> {
  return card.evaluate((cardEl) => {
    const deepCollect = (
      root: Element | ShadowRoot,
      selector: string,
    ): HTMLElement[] => {
      const out: HTMLElement[] = [];
      const visit = (node: Element | ShadowRoot) => {
        node
          .querySelectorAll(selector)
          .forEach((el) => out.push(el as HTMLElement));
        node.querySelectorAll('*').forEach((child) => {
          const shadow = (child as Element).shadowRoot;
          if (shadow) visit(shadow);
        });
      };
      visit(root);
      return out;
    };

    // opacity-0 → opacity-100，并恢复 pointer-events，让悬浮控制栏可见可点
    deepCollect(cardEl as Element, '[class*="opacity-0"]').forEach((el) => {
      el.classList.remove('opacity-0');
      el.classList.add('opacity-100');
      el.style.opacity = '1';
    });
    deepCollect(cardEl as Element, '.pointer-events-none').forEach((el) => {
      el.style.pointerEvents = 'auto';
    });

    const icon = deepCollect(
      cardEl as Element,
      'ks-icon[name="download"], [name="download"]',
    )[0];
    const btn = icon ? icon.closest('button') : null;
    return !!btn;
  });
}

/** 点击视频块里的下载按钮 */
async function clickDownloadInCard(card: Locator): Promise<boolean> {
  return card.evaluate((cardEl) => {
    const deepCollect = (
      root: Element | ShadowRoot,
      selector: string,
    ): HTMLElement[] => {
      const out: HTMLElement[] = [];
      const visit = (node: Element | ShadowRoot) => {
        node
          .querySelectorAll(selector)
          .forEach((el) => out.push(el as HTMLElement));
        node.querySelectorAll('*').forEach((child) => {
          const shadow = (child as Element).shadowRoot;
          if (shadow) visit(shadow);
        });
      };
      visit(root);
      return out;
    };

    const icon = deepCollect(
      cardEl as Element,
      'ks-icon[name="download"], [name="download"]',
    )[0];
    const btn = icon ? (icon.closest('button') as HTMLElement | null) : null;
    if (!btn) return false;
    btn.click();
    return true;
  });
}
