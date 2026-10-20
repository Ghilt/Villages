import { chromium } from '@playwright/test';
import type { Browser } from '@playwright/test';

/**
 * This machine's own Chrome drawing on its graphics card, which is what every measure needs: the end-to-end test's
 * Chrome draws in software, and a reading of software says nothing of the card. Headless when Chrome will draw there
 * with the card's timer, which it does on this machine with ANGLE on Direct3D 11; else a window that opens for the run.
 */
export async function chromeOnTheCard(
  headed = false,
): Promise<{ browser: Browser; renderer: string; headless: boolean }> {
  const launch = (headless: boolean) =>
    chromium.launch({
      channel: 'chrome',
      headless,
      args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
    });
  for (const headless of headed ? [false] : [true, false]) {
    const browser = await launch(headless);
    const page = await browser.newPage();
    const { renderer, timer } = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer:
          gl === null || gl === undefined
            ? 'no WebGL 2'
            : String(gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)),
        timer: gl?.getExtension('EXT_disjoint_timer_query_webgl2') !== null,
      };
    });
    await page.close();
    if (timer && !/swiftshader|software|no WebGL/i.test(renderer)) return { browser, renderer, headless };
    console.log(
      `${headless ? 'headless' : 'a window'}: ${renderer}${timer ? '' : ', no timer'} - not the card`,
    );
    await browser.close();
  }
  throw new Error('no Chrome on this machine draws on the graphics card with its timer');
}
