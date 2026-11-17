import { describe, it, expect } from 'vitest';
import { normalizeSupabaseUrl, normalizeSupabaseKey } from '../src/lib/supabase';

describe('Supabase configuration normalizer', () => {
  it('strips /rest/v1/ from Supabase Project URL', () => {
    const raw = 'https://gadfvrfqsnflpadotpou.supabase.co/rest/v1/';
    expect(normalizeSupabaseUrl(raw)).toBe('https://gadfvrfqsnflpadotpou.supabase.co');
  });

  it('strips /rest/v1 without trailing slash', () => {
    const raw = 'https://gadfvrfqsnflpadotpou.supabase.co/rest/v1';
    expect(normalizeSupabaseUrl(raw)).toBe('https://gadfvrfqsnflpadotpou.supabase.co');
  });

  it('strips /auth/v1/ and /auth/v1', () => {
    expect(normalizeSupabaseUrl('https://gadfvrfqsnflpadotpou.supabase.co/auth/v1/')).toBe('https://gadfvrfqsnflpadotpou.supabase.co');
    expect(normalizeSupabaseUrl('https://gadfvrfqsnflpadotpou.supabase.co/auth/v1')).toBe('https://gadfvrfqsnflpadotpou.supabase.co');
  });

  it('handles surrounding whitespace, quotes, and trailing slashes', () => {
    expect(normalizeSupabaseUrl('  "https://gadfvrfqsnflpadotpou.supabase.co/"  ')).toBe('https://gadfvrfqsnflpadotpou.supabase.co');
    expect(normalizeSupabaseUrl("'https://gadfvrfqsnflpadotpou.supabase.co/rest/v1/'")).toBe('https://gadfvrfqsnflpadotpou.supabase.co');
  });

  it('adds https:// if protocol is missing', () => {
    expect(normalizeSupabaseUrl('gadfvrfqsnflpadotpou.supabase.co/rest/v1')).toBe('https://gadfvrfqsnflpadotpou.supabase.co');
  });

  it('returns empty string for empty or invalid inputs', () => {
    expect(normalizeSupabaseUrl('')).toBe('');
    expect(normalizeSupabaseUrl(null)).toBe('');
    expect(normalizeSupabaseUrl(undefined)).toBe('');
  });

  it('normalizes anon key trimming quotes and spaces', () => {
    expect(normalizeSupabaseKey('  eyJhbGciOi...  ')).toBe('eyJhbGciOi...');
    expect(normalizeSupabaseKey('"eyJhbGciOi..."')).toBe('eyJhbGciOi...');
    expect(normalizeSupabaseKey("'eyJhbGciOi...'")).toBe('eyJhbGciOi...');
  });
});
