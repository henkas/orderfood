import { describe, test, expect } from 'vitest';
import {
  toPattern,
  groupByPattern,
  renderMarkdown,
  type CapturedEntry,
} from '../parse_captured.js';

const makeEntry = (overrides: Partial<CapturedEntry> = {}): CapturedEntry => ({
  method: 'GET',
  url: 'https://api.ubereats.com/v1/feed',
  request_headers: {},
  request_body: '',
  response_status: 200,
  response_body: '{}',
  ...overrides,
});

describe('toPattern', () => {
  test('replaces UUID path segments with {id}', () => {
    const url =
      'https://api.ubereats.com/v1/restaurants/550e8400-e29b-41d4-a716-446655440000/menu';
    expect(toPattern(url)).toBe(
      'https://api.ubereats.com/v1/restaurants/{id}/menu',
    );
  });

  test('replaces long numeric path segments with {id}', () => {
    const url = 'https://api.ubereats.com/v1/orders/12345678/status';
    expect(toPattern(url)).toBe(
      'https://api.ubereats.com/v1/orders/{id}/status',
    );
  });

  test('preserves short numeric query params', () => {
    const url = 'https://api.ubereats.com/v2/feed?page=1&limit=20';
    expect(toPattern(url)).toBe(
      'https://api.ubereats.com/v2/feed?page=1&limit=20',
    );
  });

  test('handles URLs with no IDs unchanged', () => {
    const url = 'https://api.ubereats.com/v1/categories';
    expect(toPattern(url)).toBe('https://api.ubereats.com/v1/categories');
  });
});

describe('groupByPattern', () => {
  test('collapses entries with same method+pattern into one group', () => {
    const entries: CapturedEntry[] = [
      makeEntry({ url: 'https://api.ubereats.com/v1/restaurants/550e8400-e29b-41d4-a716-446655440000/menu' }),
      makeEntry({ url: 'https://api.ubereats.com/v1/restaurants/660f9511-f3ac-52e5-b827-557766551111/menu' }),
    ];
    const groups = groupByPattern(entries);
    expect(groups.size).toBe(1);
    expect([...groups.values()][0].examples).toHaveLength(2);
  });

  test('separates GET and POST to same URL', () => {
    const entries: CapturedEntry[] = [
      makeEntry({ method: 'GET', url: 'https://api.ubereats.com/v1/cart' }),
      makeEntry({ method: 'POST', url: 'https://api.ubereats.com/v1/cart' }),
    ];
    const groups = groupByPattern(entries);
    expect(groups.size).toBe(2);
  });

  test('keys are formatted as "METHOD url-pattern"', () => {
    const groups = groupByPattern([makeEntry()]);
    expect([...groups.keys()][0]).toBe(
      'GET https://api.ubereats.com/v1/feed',
    );
  });
});

describe('renderMarkdown', () => {
  test('includes platform name in heading', () => {
    const md = renderMarkdown('ubereats', groupByPattern([makeEntry()]));
    expect(md).toContain('# ubereats API Reference');
  });

  test('includes endpoint method and pattern', () => {
    const md = renderMarkdown('ubereats', groupByPattern([makeEntry()]));
    expect(md).toContain('GET https://api.ubereats.com/v1/feed');
  });

  test('includes response status', () => {
    const md = renderMarkdown(
      'ubereats',
      groupByPattern([makeEntry({ response_status: 200 })]),
    );
    expect(md).toContain('200');
  });

  test('renders valid JSON response body as fenced block', () => {
    const md = renderMarkdown(
      'ubereats',
      groupByPattern([makeEntry({ response_body: '{"name":"test"}' })]),
    );
    expect(md).toContain('```json');
    expect(md).toContain('"name"');
  });
});
