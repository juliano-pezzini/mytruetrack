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

export const SUGGESTED_TAG_COLORS: readonly string[] = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F59E0B', // amber
  '#6366F1', // indigo
  '#84CC16', // lime
];

/**
 * Returns the first color from SUGGESTED_TAG_COLORS not already in usedColors.
 * Falls back to the first palette color if all are taken.
 */
export function suggestTagColor(usedColors: readonly string[]): string {
  const usedSet = new Set(usedColors.map((c) => c.toLowerCase()));
  const suggestion = SUGGESTED_TAG_COLORS.find((c) => !usedSet.has(c.toLowerCase()));
  return suggestion ?? SUGGESTED_TAG_COLORS[0]!;
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
