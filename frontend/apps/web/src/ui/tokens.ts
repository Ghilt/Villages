/**
 * Every colour and space the library is drawn in, by name and by what it is for.
 *
 * The values are in `ui.css` and only there: this is what the page at /admin/inspect-ui-components reads
 * to lay out its swatches, and what a component's author reads to pick one. `tokens.test.ts` holds the
 * two together, so a token added to one and not the other is a failing check rather than a swatch nobody
 * sees.
 */

export interface Token {
  /** The custom property, without its leading dashes: `ui-gilt`. */
  readonly name: string;
  readonly for: string;
}

export interface TokenGroup {
  readonly name: string;
  readonly tokens: readonly Token[];
}

export const COLOURS: readonly TokenGroup[] = [
  {
    name: 'Night',
    tokens: [
      { name: 'ui-night', for: 'the dark everything lies on' },
      { name: 'ui-night-raised', for: 'a panel lifted off it' },
      { name: 'ui-night-edge', for: 'the line where two darks meet' },
    ],
  },
  {
    name: 'Gilt',
    tokens: [
      { name: 'ui-gilt-deep', for: 'the shadow in a moulding' },
      { name: 'ui-gilt', for: 'gold' },
      { name: 'ui-gilt-light', for: 'the light on its crest' },
    ],
  },
  {
    name: 'Parchment',
    tokens: [
      { name: 'ui-parchment-deep', for: 'a sheet in shadow, its edge' },
      { name: 'ui-parchment', for: 'a sheet' },
      { name: 'ui-parchment-light', for: 'a sheet in the light' },
    ],
  },
  {
    name: 'Ink and cream',
    tokens: [
      { name: 'ui-ink', for: 'text on parchment' },
      { name: 'ui-ink-soft', for: 'what is said about it' },
      { name: 'ui-cream', for: 'text on night' },
      { name: 'ui-cream-soft', for: 'what is said about it' },
    ],
  },
  {
    name: 'Velvet',
    tokens: [
      { name: 'ui-velvet-deep', for: 'a fold' },
      { name: 'ui-velvet', for: 'the primary cloth' },
      { name: 'ui-velvet-light', for: 'where the light catches it' },
    ],
  },
  {
    name: 'Lapis',
    tokens: [
      { name: 'ui-lapis-deep', for: 'a fold' },
      { name: 'ui-lapis', for: 'the secondary cloth' },
      { name: 'ui-lapis-light', for: 'where the light catches it' },
    ],
  },
  {
    name: 'Focus',
    tokens: [{ name: 'ui-focus', for: 'the ring round whatever the keyboard is on' }],
  },
  {
    name: 'Rarity',
    tokens: [
      { name: 'ui-rarity-common', for: 'common' },
      { name: 'ui-rarity-uncommon', for: 'uncommon' },
      { name: 'ui-rarity-rare', for: 'rare' },
      { name: 'ui-rarity-legendary', for: 'legendary' },
    ],
  },
  {
    name: 'Aspects',
    tokens: [
      { name: 'ui-aspect-violence', for: 'Violence, a challenge’s aspect' },
      { name: 'ui-aspect-diplomacy', for: 'Diplomacy, its anti-aspect' },
      { name: 'ui-aspect-holy', for: 'Holy' },
      { name: 'ui-aspect-reason', for: 'Reason, its anti-aspect' },
      { name: 'ui-aspect-authority', for: 'Authority' },
      { name: 'ui-aspect-freedom', for: 'Freedom, its anti-aspect' },
      { name: 'ui-aspect-greed', for: 'Greed' },
      { name: 'ui-aspect-generosity', for: 'Generosity, its anti-aspect' },
      { name: 'ui-aspect-nature', for: 'Nature' },
      { name: 'ui-aspect-industry', for: 'Industry, its anti-aspect' },
    ],
  },
  {
    name: 'Google and Discord',
    tokens: [
      { name: 'ui-google-face', for: "Google's sign-in button, by Google's rules" },
      { name: 'ui-google-rim', for: 'its rim' },
      { name: 'ui-google-ink', for: 'its words' },
      { name: 'ui-discord-face', for: "Discord's, its blurple" },
      { name: 'ui-discord-ink', for: 'its words and its mark' },
    ],
  },
];

export const SPACES: readonly Token[] = [
  { name: 'ui-space-1', for: 'inside a mark or a pip' },
  { name: 'ui-space-2', for: 'between a mark and its word' },
  { name: 'ui-space-3', for: 'between two things in a row' },
  { name: 'ui-space-4', for: 'inside a card' },
  { name: 'ui-space-5', for: 'between two cards' },
  { name: 'ui-space-6', for: 'between two sections' },
];

/** The type's own properties, which are not colours or spaces but are tokens all the same. */
export const TYPE: readonly Token[] = [
  { name: 'ui-font-text', for: 'everything that is read' },
  { name: 'ui-font-display', for: 'titles and names' },
];

/** Every token, flat, for the check that holds this list and the stylesheet together. */
export const ALL_TOKENS: readonly Token[] = [...COLOURS.flatMap((group) => group.tokens), ...SPACES, ...TYPE];
