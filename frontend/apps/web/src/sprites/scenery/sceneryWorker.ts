import { createCutting } from './cellCutting';
import type { CutRequest } from './cellCutting';

/**
 * The scenery's cells cut off the page's thread: a busy wood is a few milliseconds of scattering, and the page cut
 * dozens of them at once as their terrain came in, which was a stall each time the camera stopped over busy ground.
 * Here it is throughput. Nothing here touches the document; the cutting is `cellCutting.ts`, the same the page runs
 * where there is no worker. See decision record 0118.
 */

const cutting = createCutting();

self.addEventListener('message', (event: MessageEvent<CutRequest | 'forget'>) => {
  if (event.data === 'forget') {
    cutting.forget();
    return;
  }
  void cutting.answer(event.data).then((reply) => self.postMessage(reply));
});
