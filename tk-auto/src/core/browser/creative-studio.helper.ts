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
const CHATBOX_CONTAINER_SELECTOR = 'fieldset[data-chatbox-part="container"]';
const EXPAND_CHATBOX_SELECTOR =
  'button[aria-label="Expand chatbox"], button[aria-label="展开对话框"], button[aria-label*="Expand chatbox" i], button[aria-label*="展开" i][class*="inset-0"]';

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

/** 关闭弹层并展开 chatbox，避免透明 Expand 遮罩挡住 Upload 按钮 */
async function dismissUploadOverlays(page: Page): Promise<void> {
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.mouse.click(10, 10).catch(() => undefined);
  await ensureChatboxExpanded(page);
  await page.waitForTimeout(200);
}

/**
 * 滚动到页面底部并展开 chatbox，确保输入框 / Upload 可见可操作。
 * 复用标签页处理完视频后页面常在顶部，chatbox 处于折叠态，需先滚到底再操作。
 */
export async function ensureChatboxExpanded(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      const scrollElToBottom = (el: Element | null) => {
        if (!el || !(el instanceof HTMLElement)) return;
        if (el.scrollHeight > el.clientHeight) {
          el.scrollTop = el.scrollHeight;
        }
      };

      scrollElToBottom(document.documentElement);
      scrollElToBottom(document.body);
      window.scrollTo(0, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));

      document
        .querySelectorAll('[class*="overflow"], [style*="overflow"]')
        .forEach((el) => scrollElToBottom(el as Element));
    })
    .catch(() => undefined);

  await page.keyboard.press('End').catch(() => undefined);
  await page.waitForTimeout(300);

  const chatbox = page.locator(CHATBOX_CONTAINER_SELECTOR);
  if ((await chatbox.count()) > 0) {
    await chatbox.first().scrollIntoViewIfNeeded().catch(() => undefined);
  }

  const expandBtn = page.locator(EXPAND_CHATBOX_SELECTOR);
  if ((await expandBtn.count()) > 0) {
    await expandBtn.first().click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(400);
  }

  await page
    .evaluate(() => {
      const chatboxEl = document.querySelector(
        'fieldset[data-chatbox-part="container"]',
      );
      chatboxEl?.scrollIntoView({ block: 'end', inline: 'nearest' });

      // 折叠态透明 Expand 层仍会拦截点击，操作前临时禁用 pointer-events
      document
        .querySelectorAll(
          'button[aria-label="Expand chatbox"], button[aria-label="展开对话框"]',
        )
        .forEach((el) => {
          if (el instanceof HTMLElement) {
            el.style.pointerEvents = 'none';
          }
        });
    })
    .catch(() => undefined);

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
  await ensureChatboxExpanded(page);
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

/** 长文本逐字键入慢且易超时，超过阈值改用 DOM 一次性注入 */
const PROMPT_SEQUENTIAL_THRESHOLD = 100;

/** 通过 DOM + InputEvent 写入 ProseMirror（长文本首选） */
async function injectPromptViaDom(page: Page, promptText: string): Promise<void> {
  await page.evaluate((text) => {
    const el = document.querySelector(
      'div.ProseMirror[contenteditable="true"]',
    ) as HTMLElement | null;
    if (!el) return;
    el.focus();
    const safe = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    el.innerHTML = `<p>${safe}</p>`;
    el.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: text,
      }),
    );
  }, promptText);
}

/** 填入 ProseMirror 提示词输入框 */
export async function fillCreativeStudioPrompt(
  page: Page,
  promptText: string,
): Promise<void> {
  await ensureChatboxExpanded(page);

  const editor = page.locator('div.ProseMirror[contenteditable="true"]');
  await editor.waitFor({ state: 'visible', timeout: 15000 });
  await editor.first().click();

  // 先清掉残留内容
  await page.keyboard.press('Control+A').catch(() => undefined);
  await page.keyboard.press('Delete').catch(() => undefined);

  if (promptText.length >= PROMPT_SEQUENTIAL_THRESHOLD) {
    await injectPromptViaDom(page, promptText);
  } else {
    // 短文本用逐字键入，更贴近真实输入
    await editor.first().pressSequentially(promptText, { delay: 10 });
  }

  // 轮询等待编辑器内容完整写入，避免长文本还没输完就 submit
  if (!(await waitForPromptFilled(page, editor, promptText, 20000))) {
    await page.keyboard.press('Control+A').catch(() => undefined);
    await page.keyboard.press('Delete').catch(() => undefined);
    await injectPromptViaDom(page, promptText);
    if (!(await waitForPromptFilled(page, editor, promptText, 10000))) {
      throw new Error('提示词回填失败：内容不完整');
    }
  }
}

/** 轮询等待编辑器内容与预期 prompt 一致 */
async function waitForPromptFilled(
  page: Page,
  editor: Locator,
  promptText: string,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await promptFilled(editor, promptText)) {
      return true;
    }
    await page.waitForTimeout(200);
  }
  return false;
}

/** 校验编辑器内是否已完整包含提示词 */
async function promptFilled(
  editor: Locator,
  promptText: string,
): Promise<boolean> {
  const current = normalizePrompt((await editor.first().textContent()) ?? '');
  const expected = normalizePrompt(promptText);
  if (!expected) return true;
  if (current === expected) return true;
  // 长度不足说明还没输完或被截断
  if (current.length < expected.length) return false;
  return current.includes(expected);
}

const DURATION_BUTTON_SELECTOR = '[class*="chatbox-setting-btn"]';
const DURATION_INNER_BUTTON_SELECTOR =
  'button.button--sm[part="base"], button[part="base"]';
// 新增：更精确的定位第三个 dropdown 中的 button
const DURATION_DROPDOWN_SELECTOR = 'ks-dropdown-menu-1-1-1m, [data-inspector*="ks-dropdown-menu-1-1-1m"]';
/**
 * 在提交前设置 Creative Studio 的视频生成时长（秒）。
 * 点击 chatbox 内的时长按钮（如 "14s"），在弹出的 ks-input-number 中填入目标值。
 */
export async function setCreativeStudioDuration(
  page: Page,
  durationSeconds: number,
): Promise<void> {
  const duration = Math.min(15, Math.max(4, Math.round(durationSeconds)));
  await ensureChatboxExpanded(page);

  const clicked = await clickThirdDurationSettingButton(page);
  if (!clicked) {
    throw new Error('未找到第3个视频时长设置按钮');
  }

  await page.waitForTimeout(400);
  const filled = await fillDurationInput(page, duration);
  if (!filled) {
    throw new Error('未找到视频时长输入框');
  }

  await page.keyboard.press('Enter').catch(() => undefined);
  await page.waitForTimeout(300);
}

/** 点击第三个 duration setting button */
async function clickThirdDurationSettingButton(page: Page): Promise<boolean> {
  const chatbox = page.locator('fieldset[data-chatbox-part="container"], .chatbox');
  await chatbox.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

  // 优先尝试通过 shadow DOM 精确找第3个
  const clicked = await clickDurationButtonInShadow(page);
  if (clicked) return true;

  // 兜底：直接在页面上找所有按钮，点击第3个
  const allButtons = page.locator(DURATION_BUTTON_SELECTOR);
  const count = await allButtons.count();

  if (count >= 3) {
    await allButtons.nth(2).click({ force: true }); // 第3个（0-based index 2）
    return true;
  }

  // 最后一个作为备选
  if (count > 0) {
    await allButtons.last().click({ force: true });
    return true;
  }

  return false;
}

/** 通过 evaluate 遍历 shadow DOM 找第三个 ks-dropdown-menu 里的 button */
async function clickDurationButtonInShadow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    function walk(root: Document | ShadowRoot, results: Element[] = []): Element[] {
      // 找所有 ks-dropdown-menu
      const dropdowns = root.querySelectorAll('ks-dropdown-menu-1-1-1m, [class*="KsDropDownMenu"]');

      for (const dropdown of dropdowns) {
        const shadow = (dropdown as Element).shadowRoot;
        if (!shadow) continue;

        // 在每个 dropdown 里找 button
        const btn = shadow.querySelector('button.button--sm[part="base"], button[part="base"], button.button--sm, button');
        if (btn) results.push(btn as Element);
      }

      // 继续递归其他 shadow
      for (const node of root.querySelectorAll('*')) {
        const shadow = (node as Element).shadowRoot;
        if (shadow) walk(shadow, results);
      }

      return results;
    }

    const chatbox = document.querySelector('fieldset[data-chatbox-part="container"]') || document;
    const allButtons = walk(chatbox as Document | ShadowRoot);

    // 优先取第三个
    const targetBtn = allButtons[2] || allButtons[allButtons.length - 1];
    if (targetBtn) {
      (targetBtn as HTMLButtonElement).click();
      return true;
    }
    return false;
  });
}

/** 点击 chatbox 内的时长设置按钮（ks-button-* shadow 内的 button[part=base]） */
async function clickDurationSettingButton(page: Page): Promise<boolean> {
  const chatbox = page.locator(CHATBOX_CONTAINER_SELECTOR);
  await chatbox.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
  await chatbox.first().scrollIntoViewIfNeeded().catch(() => undefined);

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const host = chatbox.locator(DURATION_BUTTON_SELECTOR);
    if ((await host.count()) > 0) {
      const innerBtn = host.first().locator(DURATION_INNER_BUTTON_SELECTOR);
      if ((await innerBtn.count()) > 0) {
        await innerBtn.first().click({ force: true });
        return true;
      }
      await host.first().click({ force: true });
      return true;
    }

    const clicked = await clickDurationSettingButtonInShadow(page);
    if (clicked) {
      return true;
    }

    await page.waitForTimeout(300);
  }

  return false;
}

/** 递归遍历 open shadow DOM，定位时长按钮并点击内部 button */
async function clickDurationSettingButtonInShadow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    function isKsButtonTag(tagName: string): boolean {
      return /^ks-button/i.test(tagName);
    }

    function matchesDurationHost(el: Element): boolean {
      const className = typeof el.className === 'string' ? el.className : '';
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      return (
        className.includes('chatbox-setting-btn') ||
        (isKsButtonTag(el.tagName) && /\d+\s*s\b/i.test(text))
      );
    }

    function clickInnerButton(host: Element): boolean {
      if (!host.shadowRoot) return false;
      const root = host.shadowRoot;
      const btn =
        root.querySelector('button.button--sm[part="base"]') ??
        root.querySelector('button[part="base"]') ??
        root.querySelector('button.button--sm') ??
        root.querySelector('button');
      if (btn instanceof HTMLButtonElement) {
        btn.click();
        return true;
      }
      return false;
    }

    function walk(root: Document | ShadowRoot): Element | null {
      for (const el of root.querySelectorAll('*')) {
        if (matchesDurationHost(el)) {
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

    const chatbox = document.querySelector(
      'fieldset[data-chatbox-part="container"]',
    );
    const searchRoot = (chatbox ?? document) as Document | ShadowRoot;
    const target = walk(searchRoot);
    if (!target) return false;
    return clickInnerButton(target);
  });
}

/** 在弹出的 ks-input-number 中填入时长 */
async function fillDurationInput(page: Page, duration: number): Promise<boolean> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const filled = await page.evaluate((durationValue) => {
      function isKsInputNumberHost(el: Element): boolean {
        return /^ks-input-number/i.test(el.tagName);
      }

      function walk(root: Document | ShadowRoot): HTMLInputElement | null {
        const inputs = root.querySelectorAll(
          'input[placeholder="Duration"], input.input[type="text"], input[part="input"]',
        );
        for (const el of inputs) {
          const placeholder = el.getAttribute('placeholder') ?? '';
          let parent: Element | null = el;
          let inNumber = false;
          while (parent) {
            if (isKsInputNumberHost(parent)) {
              inNumber = true;
              break;
            }
            parent = parent.parentElement;
          }
          if (placeholder === 'Duration' || inNumber) {
            return el as HTMLInputElement;
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

      const input = walk(document);
      if (!input) return false;

      input.focus();
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      const value = String(durationValue);
      if (setter) {
        setter.call(input, value);
      } else {
        input.value = value;
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, duration);

    if (filled) {
      return true;
    }
    await page.waitForTimeout(200);
  }
  return false;
}

/** 页面积分不足以完成本次视频生成。 */
export class InsufficientCreditsError extends Error {
  constructor(
    message: string,
    public readonly credits: number,
    public readonly required: number,
  ) {
    super(message);
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * 读取页面右上角/操作区 coin 按钮旁的当前积分。
 * DOM：ks-icon[name="coin"] + 相邻 span.tiktok-labelMd（如 1980）
 */
export async function readCreativeStudioCredits(page: Page): Promise<number | null> {
  return page
    .evaluate(() => {
      const deepFindCoinButtons = (
        root: Document | ShadowRoot,
      ): number | null => {
        const icons = root.querySelectorAll(
          'ks-icon[name="coin"], [name="coin"]',
        );
        for (const icon of icons) {
          const host =
            icon.closest('ks-button-1-1-1m, button, [class*="operation-btn"]') ??
            icon.parentElement;
          const span =
            host?.querySelector('span.tiktok-labelMd, span') ??
            icon.nextElementSibling;
          const raw = (span?.textContent ?? '').replace(/[,\s]/g, '').trim();
          const n = Number(raw);
          if (Number.isFinite(n) && n >= 0) return n;
        }
        for (const el of root.querySelectorAll('*')) {
          const shadow = (el as Element).shadowRoot;
          if (!shadow) continue;
          const found = deepFindCoinButtons(shadow);
          if (found != null) return found;
        }
        return null;
      };
      return deepFindCoinButtons(document);
    })
    .catch(() => null);
}

/**
 * 提交前校验积分：当前积分必须 >= duration（生成所需点数）。
 * 不够则抛出 InsufficientCreditsError，由调用方写入 errorMessage。
 */
export async function assertEnoughCreditsForDuration(
  page: Page,
  durationSeconds: number,
): Promise<number> {
  const required = Math.min(15, Math.max(4, Math.round(durationSeconds)));
  const credits = await readCreativeStudioCredits(page);
  if (credits == null) {
    throw new Error('无法读取当前积分，取消提交');
  }
  if (credits < required) {
    throw new InsufficientCreditsError(
      `积分不够：当前 ${credits}，生成 ${required}s 视频至少需要 ${required}`,
      credits,
      required,
    );
  }
  return credits;
}

/**
 * 点击发送按钮提交（主色 icon-only 按钮），或在输入框按 Enter 兜底。
 * 提交前若有 Downloads 悬浮窗遮挡：先回调给调用方写回错误，再关闭悬浮窗，最后点击发送。
 */
export async function submitCreativeStudioPrompt(
  page: Page,
  onDownloadsFailures?: (
    failures: DownloadsManagerFailure[],
  ) => Promise<void>,
): Promise<void> {
  const leftoverFailures = await readDownloadsManagerFailures(page);
  if (leftoverFailures.length > 0 && onDownloadsFailures) {
    await onDownloadsFailures(leftoverFailures);
  }
  // 无论是否有失败项，有悬浮窗就关，避免挡住发送按钮
  await closeDownloadsManager(page);
  await page.waitForTimeout(300).catch(() => undefined);

  await ensureChatboxExpanded(page);

  const chatbox = page.locator('fieldset[data-chatbox-part="container"]');
  const sendBtn = chatbox.locator(
    'button.button--icon-only.button--color-primary[part="base"], button.button--type-contained.button--icon-only.button--color-primary',
  );

  if ((await sendBtn.count()) > 0) {
    const btn = sendBtn.last();
    if (await btn.isDisabled()) {
      throw new Error('SUBMIT_SLOT_FULL: browser concurrent limit reached, submit button disabled');
    }
    await btn.click();
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

/** TikTok Downloads 悬浮窗报告的、已确认的下载失败。 */
export class DownloadFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DownloadFailedError';
  }
}

/** 页面视频块上已展示生成失败（含 Task ID / Error code）。 */
export class GenerationFailedError extends Error {
  constructor(
    message: string,
    public readonly generationTaskId?: string,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = 'GenerationFailedError';
  }
}

/** 归一化 promptText：去掉首尾空白并把连续空白折叠成单个空格，便于匹配 */
function normalizePrompt(text: string): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** 判断页面卡片上的 promptText 是否与任务的 promptText 对应 */
export function promptMatches(cardPrompt: string, taskPrompt: string): boolean {
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
 * 从失败卡片中读取 Task ID / Error code。
 * DOM：div.tiktok-labelSm > span "Task ID: …" + span "Error code: …"
 */
async function extractCardErrorMeta(
  card: Locator,
): Promise<{ generationTaskId?: string; errorCode?: string } | null> {
  return card
    .evaluate((cardEl) => {
      let generationTaskId: string | undefined;
      let errorCode: string | undefined;

      for (const span of cardEl.querySelectorAll('span')) {
        const text = (span.textContent ?? '').trim();
        const taskMatch = text.match(/^Task ID:\s*(.+)$/i);
        if (taskMatch) generationTaskId = taskMatch[1].trim();
        const codeMatch = text.match(/^Error code:\s*(.+)$/i);
        if (codeMatch) errorCode = codeMatch[1].trim();
      }

      if (!generationTaskId && !errorCode) return null;
      return { generationTaskId, errorCode };
    })
    .catch(() => null);
}

/**
 * 从失败卡片中读取可读报错详情（Community Guidelines 等）。
 * DOM：与 Task ID 行同级的前一个兄弟，如
 *   div.tiktok-bodySm — "This content may violate our Community Guidelines..."
 *   div.tiktok-labelSm — Task ID / Error code
 */
async function extractCardErrorDetail(card: Locator): Promise<string> {
  return card
    .evaluate((cardEl) => {
      const textOf = (node: Element | null | undefined) =>
        (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

      // 以真正的 Task ID span 定位元信息行（避免命中外层父 div）
      const taskSpan = [...cardEl.querySelectorAll('span')].find((s) =>
        /^Task ID:\s*/i.test((s.textContent ?? '').trim()),
      );
      const metaRow = taskSpan?.parentElement;
      if (metaRow) {
        const fromSibling = textOf(metaRow.previousElementSibling);
        if (fromSibling && !/^Task ID:/i.test(fromSibling)) {
          return fromSibling;
        }
      }

      // 兜底：卡片内 body 文案节点
      const body =
        cardEl.querySelector('.tiktok-bodySm, [class*="bodySm"]') ??
        cardEl.querySelector('.whitespace-normal.break-words');
      return textOf(body);
    })
    .catch(() => '');
}

/**
 * 组合详情文案 + Task ID / Error code，形成入库用的完整错误信息。
 * 另处理 Preview unavailable（网络导致无预览/无下载按钮）。
 */
async function extractCardGenerationError(
  card: Locator,
): Promise<{
  message: string;
  detail?: string;
  generationTaskId?: string;
  errorCode?: string;
} | null> {
  // 网络/预览不可用
  const preview = await card
    .evaluate((cardEl) => {
      const textOf = (node: Element | null | undefined) =>
        (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
      const previewTitle = [...cardEl.querySelectorAll('p')].find((p) =>
        /preview unavailable/i.test(p.textContent ?? ''),
      );
      if (!previewTitle) return null;
      const detail =
        textOf(previewTitle.nextElementSibling as Element | null) ||
        'Check your network connection and try again.';
      return { detail, message: `Preview unavailable | ${detail}` };
    })
    .catch(() => null);

  if (preview) return preview;

  const meta = await extractCardErrorMeta(card);
  if (!meta) return null;

  const detail = await extractCardErrorDetail(card);
  const parts = [
    detail,
    meta.generationTaskId ? `Task ID: ${meta.generationTaskId}` : '',
    meta.errorCode ? `Error code: ${meta.errorCode}` : '',
  ].filter(Boolean);

  return {
    message: parts.join(' | ') || 'Video generation failed',
    detail: detail || undefined,
    generationTaskId: meta.generationTaskId,
    errorCode: meta.errorCode,
  };
}

/**
 * 遍历最外层容器里的所有视频块，找到 promptText 与任务匹配且「已生成完成」的块，
 * 深层展开（含 open shadow DOM）把 opacity-0 的悬浮控制栏改为 opacity-100，
 * 找到下载按钮（ks-icon[name="download"] 所在 button），点击并捕获浏览器下载，另存为 savePath。
 *
 * 若匹配块上已出现生成失败（Task ID / Error code）或预览不可用（Preview unavailable），
 * 抛出 GenerationFailedError。
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

    // 生成/预览失败：违规 Error code，或 Preview unavailable（网络导致无下载按钮）
    const generationError = await extractCardGenerationError(card);
    if (generationError) {
      throw new GenerationFailedError(
        generationError.message,
        generationError.generationTaskId,
        generationError.errorCode,
      );
    }

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

    const download = await Promise.race([
      downloadPromise,
      waitForDownloadFailure(page),
    ]);
    await download.saveAs(savePath);
    return { filePath: savePath, promptText: cardPrompt };
  }

  return null;
}

/**
 * 等待 TikTok 的 Downloads 悬浮窗出现失败项，并读取其标题和错误文案。
 * 不在这里关闭窗口，确保调用方先将错误回写到任务队列后再关闭。
 */
async function waitForDownloadFailure(page: Page): Promise<never> {
  await page.waitForFunction(
    () => {
      const root = document.querySelector('[class*="video-download-manager"]');
      if (!root) return false;
      return /download\s*failed|\(\s*\d+\s*failed\s*\)/i.test(
        root.textContent ?? '',
      );
    },
    undefined,
    { timeout: 120000 },
  );

  const failures = await readDownloadsManagerFailures(page);
  const first = failures[0];
  const message = first
    ? `${first.title}: ${first.status}`
    : 'TikTok Downloads 显示 Download failed';

  throw new DownloadFailedError(message);
}

export interface DownloadsManagerFailure {
  /** 悬浮窗条目标题（通常是卡片 prompt 截断文案） */
  title: string;
  /** 状态文案，如 Download failed */
  status: string;
}

/**
 * 读取 Downloads 悬浮窗里的失败项（不关闭窗口）。
 * 标题栏形如 "Downloads (2 failed)"；条目上有 truncate 标题 + Download failed。
 */
export async function readDownloadsManagerFailures(
  page: Page,
): Promise<DownloadsManagerFailure[]> {
  return page
    .evaluate(() => {
      const findManager = (): HTMLElement | null => {
        const action = document.querySelector(
          '.video-download-manager-action, [class*="video-download-manager"]',
        );
        if (action) {
          return (
            action.closest<HTMLElement>('[class*="video-download-manager"]') ??
            (action as HTMLElement)
          );
        }
        const header = [...document.querySelectorAll('div')].find((el) => {
          const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
          return /^Downloads?\b/i.test(t) && t.length < 40;
        });
        return (
          header?.closest<HTMLElement>('[class*="video-download-manager"]') ??
          header?.parentElement ??
          null
        );
      };

      const manager = findManager();
      if (!manager) return [];

      const out: { title: string; status: string }[] = [];
      const seen = new Set<string>();

      const titleNodes = [
        ...manager.querySelectorAll<HTMLElement>('[class*="truncate-wrapper"]'),
      ];
      for (const titleNode of titleNodes) {
        const title = (titleNode.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (!title || /^Downloads?\b/i.test(title)) continue;

        const row =
          titleNode.closest<HTMLElement>('li, [role="listitem"], div') ??
          titleNode.parentElement;
        const rowText = row?.textContent ?? '';
        if (!/download\s*failed/i.test(rowText)) continue;

        const status =
          [...(row?.querySelectorAll('span') ?? [])]
            .map((s) => s.textContent?.trim() ?? '')
            .find((t) => /download\s*failed/i.test(t)) ?? 'Download failed';

        const key = `${title}||${status}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ title, status });
      }

      if (
        out.length === 0 &&
        /\(\s*\d+\s*failed\s*\)|download\s*failed/i.test(
          manager.textContent ?? '',
        )
      ) {
        out.push({ title: '(unknown)', status: 'Download failed' });
      }

      return out;
    })
    .catch(() => []);
}

/**
 * 关闭 TikTok 的 Downloads 悬浮窗（成功/失败态都关，避免遮挡提交按钮）。
 * 优先点 .video-download-manager-action 里的 close 图标。
 */
export async function closeDownloadsManager(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const closeIcon =
      document.querySelector<HTMLElement>(
        '.video-download-manager-action ks-icon[name="close"]',
      ) ??
      document.querySelector<HTMLElement>(
        '[class*="video-download-manager"] ks-icon[name="close"]',
      );

    if (!closeIcon) {
      // 兜底：找到 "Downloads" 标题附近的 close
      const header = [...document.querySelectorAll('div')].find((el) =>
        /^Downloads?\b/i.test((el.textContent ?? '').trim()),
      );
      const root =
        header?.closest<HTMLElement>('[class*="video-download-manager"]') ??
        header?.parentElement;
      const icon = root?.querySelector<HTMLElement>('ks-icon[name="close"]');
      if (!icon) return false;
      (icon.closest('ks-button-1-1-1m, button') as HTMLElement | null)?.click();
      return true;
    }

    (closeIcon.closest('ks-button-1-1-1m, button') as HTMLElement | null)?.click();
    return true;
  });
}

/**
 * 先读取 Downloads 悬浮窗失败项，再关闭窗口。
 * 调用方应先把失败与任务关联写回 errorMessage，再调用本函数；
 * 或使用本函数的返回值再写回（本函数已关闭窗口）。
 */
export async function drainDownloadsManager(
  page: Page,
): Promise<DownloadsManagerFailure[]> {
  const failures = await readDownloadsManagerFailures(page);
  const closed = await closeDownloadsManager(page);
  if (closed || failures.length > 0) {
    await page.waitForTimeout(300).catch(() => undefined);
  }
  return failures;
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
