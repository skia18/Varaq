import { describe, expect, it } from 'vitest';
import { validateMediaFile } from './storage';

function file(type: string, size: number) {
  return { type, size } as File;
}

describe('media upload validation', () => {
  it('accepts supported images and audio within their limits', () => {
    expect(() =>
      validateMediaFile(file('image/jpeg', 10 * 1024 * 1024), 'photography'),
    ).not.toThrow();
    expect(() => validateMediaFile(file('image/webp', 1), 'artwork')).not.toThrow();
    expect(() => validateMediaFile(file('audio/mpeg', 25 * 1024 * 1024), 'audio')).not.toThrow();
  });

  it('rejects mismatched types, empty files, and oversized files', () => {
    expect(() => validateMediaFile(file('text/html', 100), 'photography')).toThrow();
    expect(() => validateMediaFile(file('audio/mpeg', 100), 'artwork')).toThrow();
    expect(() => validateMediaFile(file('image/png', 0), 'photography')).toThrow();
    expect(() =>
      validateMediaFile(file('image/png', 10 * 1024 * 1024 + 1), 'photography'),
    ).toThrow();
    expect(() => validateMediaFile(file('audio/wav', 25 * 1024 * 1024 + 1), 'audio')).toThrow();
  });
});
