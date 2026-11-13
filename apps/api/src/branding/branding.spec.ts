import { normalizeAssetUrl } from './branding.module';

describe('normalizeAssetUrl', () => {
  it('rewrites legacy absolute localhost upload URLs to relative', () => {
    expect(normalizeAssetUrl('http://localhost:4000/uploads/2026/11/0f6b3651471385b4fb381cca.jpg')).toBe(
      '/uploads/2026/11/0f6b3651471385b4fb381cca.jpg',
    );
  });

  it('rewrites absolute upload URLs on any host', () => {
    expect(normalizeAssetUrl('https://api.example.com/uploads/2026/11/logo.png')).toBe('/uploads/2026/11/logo.png');
  });

  it('keeps external image URLs untouched', () => {
    expect(normalizeAssetUrl('https://cdn.example.com/brand/logo.png')).toBe('https://cdn.example.com/brand/logo.png');
  });

  it('keeps relative URLs and defaults untouched', () => {
    expect(normalizeAssetUrl('/uploads/2026/11/logo.png')).toBe('/uploads/2026/11/logo.png');
    expect(normalizeAssetUrl('/brand/logo.svg')).toBe('/brand/logo.svg');
  });

  it('keeps empty values untouched', () => {
    expect(normalizeAssetUrl('')).toBe('');
  });
});
