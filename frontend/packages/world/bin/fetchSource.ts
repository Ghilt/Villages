import { SOURCES, ensureSource } from './sources.ts';
import { SOURCE_DIR } from './paths.ts';

/**
 * Downloads the raw material for the world: coastlines, lakes, rivers and ice from Natural Earth, and
 * Earth's biomes from RESOLVE Ecoregions 2017. Run once. Nothing here is committed.
 */

for (const spec of SOURCES) {
  await ensureSource(spec);
}

console.log(`\ninto ${SOURCE_DIR}`);
for (const credit of new Set(SOURCES.map((source) => source.credit))) {
  console.log(`  ${credit}`);
}
