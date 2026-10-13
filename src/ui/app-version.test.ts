import { describe, expect, it } from 'vitest';
import { formatAppVersion } from './app-version.ts';

describe('formatAppVersion', () => {
  it('places the deploy run number in the semver minor slot', () => {
    expect(formatAppVersion('1')).toBe('v1.1.0');
    expect(formatAppVersion('43')).toBe('v1.43.0');
    expect(formatAppVersion(' 7 ')).toBe('v1.7.0');
  });

  it('shows dev when no deploy number is set', () => {
    expect(formatAppVersion(undefined)).toBe('dev');
    expect(formatAppVersion('')).toBe('dev');
    expect(formatAppVersion('   ')).toBe('dev');
  });

  it('shows dev for values that are not a deploy run number', () => {
    expect(formatAppVersion('0')).toBe('dev');
    expect(formatAppVersion('01')).toBe('dev');
    expect(formatAppVersion('v42')).toBe('dev');
    expect(formatAppVersion('dev')).toBe('dev');
  });
});
