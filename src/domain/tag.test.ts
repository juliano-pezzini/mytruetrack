import { describe, it, expect } from 'vitest';
import { createTag, suggestTagColor, SUGGESTED_TAG_COLORS } from './tag.ts';

describe('Tag', () => {
  it('creates a tag with default color', () => {
    const tag = createTag({ id: 'tag-1', name: 'Travel' });
    expect(tag.id).toBe('tag-1');
    expect(tag.name).toBe('Travel');
    expect(tag.color).toBe('#808080');
  });

  it('creates a tag with custom color', () => {
    const tag = createTag({ id: 'tag-2', name: 'Urgent', color: '#FF0000' });
    expect(tag.color).toBe('#FF0000');
  });

  it('trims whitespace from name', () => {
    const tag = createTag({ id: 'tag-3', name: '  Monthly  ' });
    expect(tag.name).toBe('Monthly');
  });

  it('rejects empty name', () => {
    expect(() => createTag({ id: 'tag-4', name: '' })).toThrow('name is required');
  });

  it('rejects invalid hex color', () => {
    expect(() => createTag({ id: 'tag-5', name: 'Bad', color: 'red' })).toThrow('Invalid hex');
  });

  it('rejects short hex color', () => {
    expect(() => createTag({ id: 'tag-6', name: 'Bad', color: '#FFF' })).toThrow('Invalid hex');
  });
});

describe('suggestTagColor', () => {
  it('returns the first palette color when no colors are used', () => {
    expect(suggestTagColor([])).toBe(SUGGESTED_TAG_COLORS[0]);
  });

  it('returns the first unused palette color', () => {
    const used = [SUGGESTED_TAG_COLORS[0]!, SUGGESTED_TAG_COLORS[1]!];
    expect(suggestTagColor(used)).toBe(SUGGESTED_TAG_COLORS[2]);
  });

  it('is case-insensitive when comparing used colors', () => {
    const used = [SUGGESTED_TAG_COLORS[0]!.toLowerCase()];
    expect(suggestTagColor(used)).toBe(SUGGESTED_TAG_COLORS[1]);
  });

  it('generates a fresh unused color when the whole palette is taken', () => {
    const used = [...SUGGESTED_TAG_COLORS];
    const suggestion = suggestTagColor(used);
    expect(suggestion).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(used.map((c) => c.toLowerCase())).not.toContain(suggestion.toLowerCase());
  });

  it('never repeats a color across a growing used-set', () => {
    const used: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < SUGGESTED_TAG_COLORS.length + 10; i++) {
      const next = suggestTagColor(used);
      const key = next.toLowerCase();
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      used.push(next);
    }
  });
});
