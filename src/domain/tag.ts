/**
 * Tag — flat, colored label for transaction classification.
 */

export type Tag = Readonly<{
  id: string;
  name: string;
  color: string;
}>;

export type CreateTagParams = {
  id: string;
  name: string;
  color?: string;
};

const DEFAULT_TAG_COLOR = '#808080';
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * A curated, vivid palette ordered so consecutive entries are visually distinct
 * (hue is rotated rather than grouped by family), giving pleasant, well-separated
 * suggestions as tags are added one after another.
 */
export const SUGGESTED_TAG_COLORS: readonly string[] = [
  '#E11D48', // rose
  '#0EA5E9', // sky
  '#F59E0B', // amber
  '#7C3AED', // violet
  '#10B981', // emerald
  '#EC4899', // pink
  '#3B82F6', // blue
  '#F97316', // orange
  '#14B8A6', // teal
  '#A855F7', // purple
  '#84CC16', // lime
  '#EF4444', // red
  '#06B6D4', // cyan
  '#EAB308', // yellow
  '#6366F1', // indigo
  '#22C55E', // green
];

function hslToHex(h: number, s: number, l: number): string {
  const sFrac = s / 100;
  const lFrac = l / 100;
  const k = (n: number): number => (n + h / 30) % 12;
  const a = sFrac * Math.min(lFrac, 1 - lFrac);
  const f = (n: number): number => {
    const color = lFrac - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * color);
  };
  const toHex = (v: number): string => v.toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

/**
 * Generates a vivid color, evenly spaced around the hue wheel by index, that is
 * not present in usedSet. Used as a fallback once the curated palette is exhausted
 * so suggestions never repeat an already-used color.
 */
function generateUnusedColor(usedSet: ReadonlySet<string>): string {
  const GOLDEN_ANGLE = 137.508;
  for (let i = 0; i < 360; i++) {
    const hue = (i * GOLDEN_ANGLE) % 360;
    const candidate = hslToHex(hue, 70, 55);
    if (!usedSet.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return SUGGESTED_TAG_COLORS[0]!;
}

/**
 * Returns the first color from SUGGESTED_TAG_COLORS not already in usedColors.
 * Once the palette is exhausted, generates a fresh vivid color that is not in
 * usedColors so suggestions never repeat an already-used color.
 */
export function suggestTagColor(usedColors: readonly string[]): string {
  const usedSet = new Set(usedColors.map((c) => c.toLowerCase()));
  const suggestion = SUGGESTED_TAG_COLORS.find((c) => !usedSet.has(c.toLowerCase()));
  return suggestion ?? generateUnusedColor(usedSet);
}

export function createTag(params: CreateTagParams): Tag {
  const name = params.name.trim();
  if (name === '') {
    throw new Error('Tag name is required');
  }

  const color = params.color ?? DEFAULT_TAG_COLOR;
  if (!HEX_COLOR_REGEX.test(color)) {
    throw new Error(`Invalid hex color: "${color}". Expected format: #RRGGBB`);
  }

  return {
    id: params.id,
    name,
    color,
  };
}
