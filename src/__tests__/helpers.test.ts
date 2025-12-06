import { describe, it, expect } from 'vitest';
import { formatBytes, formatFileSize } from '../utils/helpers';

describe('formatBytes', () => {
  it('formats bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(100)).toBe('100 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
  });

  it('handles large numbers', () => {
    expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe('5.00 GB');
  });
});

describe('formatFileSize', () => {
  it('formats file sizes correctly', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(1024 * 1024 * 5)).toBe('5.0 MB');
  });
});
