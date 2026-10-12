/**
 * One definition of "the same name" for imported categories and tags.
 *
 * The stored label keeps the input's casing. The name key is that label
 * compared without case. Accents and punctuation stay in both.
 */

export function storedName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function nameKey(value: string): string {
  return storedName(value).toLowerCase();
}

export function splitTagNames(cell: string): readonly string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of cell.split(/[,;]/)) {
    const name = storedName(part);
    if (name === '') continue;
    const key = nameKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}
