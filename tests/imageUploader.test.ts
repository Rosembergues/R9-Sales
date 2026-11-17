import { describe, expect, it } from 'vitest';
import { checkImageSize } from '../src/utils/imageUploader';

describe('image upload validation', () => {
  it('accepts supported image MIME types under the limit', () => {
    const file = new File(['image'], 'banner.png', { type: 'image/png' });
    const result = checkImageSize(file);
    expect(result.valid).toBe(true);
  });

  it('rejects non-image uploads', () => {
    const file = new File(['text'], 'payload.html', { type: 'text/html' });
    const result = checkImageSize(file);
    expect(result.valid).toBe(false);
  });

  it('rejects oversized images', () => {
    const file = new File([new Uint8Array(6 * 1024 * 1024)], 'large.png', { type: 'image/png' });
    const result = checkImageSize(file);
    expect(result.valid).toBe(false);
  });
});
