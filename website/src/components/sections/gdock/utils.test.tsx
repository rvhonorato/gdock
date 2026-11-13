import { describe, it, expect } from 'vitest';
import { readFileAsText, readFileAsArrayBuffer } from './utils';
import { Th } from './Th';

// ── readFileAsText ────────────────────────────────────────────────────────────
describe('readFileAsText', () => {
  it('reads text content from a file', async () => {
    const file = new File(['hello world'], 'test.txt', { type: 'text/plain' });
    const result = await readFileAsText(file);
    expect(result).toBe('hello world');
  });

  it('handles empty files', async () => {
    const file = new File([], 'empty.txt', { type: 'text/plain' });
    const result = await readFileAsText(file);
    expect(result).toBe('');
  });

  it('handles multi-line text', async () => {
    const file = new File(['line1\nline2\nline3'], 'multiline.txt', { type: 'text/plain' });
    const result = await readFileAsText(file);
    expect(result).toBe('line1\nline2\nline3');
  });
});

// ── readFileAsArrayBuffer ─────────────────────────────────────────────────────
describe('readFileAsArrayBuffer', () => {
  it('reads binary content from a file', async () => {
    const content = 'test content';
    const file = new File([content], 'test.bin', { type: 'application/octet-stream' });
    const result = await readFileAsArrayBuffer(file);
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(result)).toBe(content);
  });

  it('handles empty files', async () => {
    const file = new File([], 'empty.bin', { type: 'application/octet-stream' });
    const result = await readFileAsArrayBuffer(file);
    expect(result.byteLength).toBe(0);
  });

  it('preserves binary data', async () => {
    const uint8 = new Uint8Array([0, 1, 2, 3, 255]);
    const file = new File([uint8], 'binary.bin', { type: 'application/octet-stream' });
    const result = await readFileAsArrayBuffer(file);
    expect(new Uint8Array(result)).toEqual(uint8);
  });
});

// ── Th component ─────────────────────────────────────────────────────────────
describe('Th component', () => {
  it('renders basic table header', () => {
    // This is a visual component, so we just test it doesn't throw
    expect(() => Th({ label: 'Test', tooltip: 'Test tooltip' })).not.toThrow();
  });

  it('accepts different alignment options', () => {
    expect(() => Th({ label: 'Left', tooltip: 'tooltip', align: 'left' })).not.toThrow();
    expect(() => Th({ label: 'Right', tooltip: 'tooltip', align: 'right' })).not.toThrow();
    expect(() => Th({ label: 'Center', tooltip: 'tooltip', align: 'center' })).not.toThrow();
  });

  it('accepts sort parameters', () => {
    expect(() => Th({ label: 'Sortable', tooltip: 'tooltip', onSort: () => {}, sortDir: 'asc' })).not.toThrow();
    expect(() => Th({ label: 'Sortable', tooltip: 'tooltip', onSort: () => {}, sortDir: 'desc' })).not.toThrow();
    expect(() => Th({ label: 'Sortable', tooltip: 'tooltip', onSort: () => {}, sortDir: null })).not.toThrow();
  });
});