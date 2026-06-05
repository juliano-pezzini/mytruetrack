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
