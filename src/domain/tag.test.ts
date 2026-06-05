import { describe, it, expect } from 'vitest';
import { createTag } from './tag.ts';

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
