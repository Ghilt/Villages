import './debug.css';

/**
 * What a development build adds to the page and a player's build leaves out: the debug panel, the grips that
 * resize the stage around it, and the arrangement of the two, which the stage's size is worked out from.
 *
 * `main.tsx` asks for this only when `import.meta.env.DEV`, so the bundler leaves it out of a production build
 * whole - its code, its words and its stylesheet - and a player's page is the stage and nothing else, filling
 * the window. Nothing in the game imports from `debug/` but `App.tsx`, and that only this module's type. See
 * decision record 0079.
 */

export { DebugPanel } from './DebugPanel';
export { Grips } from './Grips';
export { stageStore } from './stage';
