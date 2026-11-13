import { describe, it, expect } from 'vitest';
import {
  parseMd5Map,
  splitModels,
  detectChains,
  extractAndRename,
  extractOriginal,
} from './capriUtils';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ATOM_A = 'ATOM      1  CA  ALA A   1       1.000   2.000   3.000  1.00  0.00           C';
const ATOM_B = 'ATOM      2  CA  GLY B   2       4.000   5.000   6.000  1.00  0.00           C';
const HETATM_C = 'HETATM    3  O   HOH C   3       7.000   8.000   9.000  1.00  0.00           O';

function makePdb(...modelBlocks: { id: number; lines: string[] }[]): string {
  const parts: string[] = [];
  for (const { id, lines } of modelBlocks) {
    parts.push(`MODEL        ${id}`);
    parts.push(...lines);
    parts.push('ENDMDL');
  }
  return parts.join('\n');
}

// ── parseMd5Map ───────────────────────────────────────────────────────────────

describe('parseMd5Map', () => {
  it('parses REMARK 9 lines correctly', () => {
    const pdb = [
      'REMARK   9 MODEL 1 MD5 abc123',
      'REMARK   9 MODEL 2 MD5 def456',
      'REMARK   1 some other remark',
    ].join('\n');
    const map = parseMd5Map(pdb);
    expect(map.get(1)).toBe('abc123');
    expect(map.get(2)).toBe('def456');
    expect(map.size).toBe(2);
  });

  it('returns empty map when no REMARK 9 lines present', () => {
    const pdb = 'REMARK   1 foo\nATOM      1  CA  ALA A   1';
    expect(parseMd5Map(pdb).size).toBe(0);
  });
});

// ── splitModels ───────────────────────────────────────────────────────────────

describe('splitModels', () => {
  it('splits a two-model PDB correctly', () => {
    const pdb = makePdb(
      { id: 1, lines: [ATOM_A] },
      { id: 2, lines: [ATOM_B] },
    );
    const models = splitModels(pdb);
    expect(models).toHaveLength(2);
    expect(models[0].modelId).toBe(1);
    expect(models[0].lines).toContain(ATOM_A);
    expect(models[1].modelId).toBe(2);
    expect(models[1].lines).toContain(ATOM_B);
  });

  it('returns empty array for PDB with no MODEL blocks', () => {
    expect(splitModels(ATOM_A)).toHaveLength(0);
  });

  it('MODEL lines are not included in the lines array', () => {
    const pdb = makePdb({ id: 5, lines: [ATOM_A] });
    const models = splitModels(pdb);
    expect(models[0].lines.some(l => l.startsWith('MODEL'))).toBe(false);
    expect(models[0].lines.some(l => l.startsWith('ENDMDL'))).toBe(false);
  });
});

// ── detectChains ─────────────────────────────────────────────────────────────

describe('detectChains', () => {
  it('detects chains from first model ATOM/HETATM records', () => {
    const models = splitModels(
      makePdb({ id: 1, lines: [ATOM_A, ATOM_B, HETATM_C] }),
    );
    expect(detectChains(models)).toEqual(['A', 'B', 'C']);
  });

  it('returns sorted chain list', () => {
    const atomZ = ATOM_A.slice(0, 21) + 'Z' + ATOM_A.slice(22);
    const models = splitModels(
      makePdb({ id: 1, lines: [atomZ, ATOM_A] }),
    );
    expect(detectChains(models)).toEqual(['A', 'Z']);
  });

  it('returns empty array for empty models', () => {
    expect(detectChains([])).toEqual([]);
  });

  it('ignores lines shorter than 22 chars', () => {
    const shortLine = 'ATOM      1  CA';
    const models = [{ modelId: 1, lines: [shortLine] }];
    expect(detectChains(models)).toEqual([]);
  });
});

// ── extractAndRename ─────────────────────────────────────────────────────────

describe('extractAndRename', () => {
  it('filters to specified chains and renames them', () => {
    const lines = [ATOM_A, ATOM_B, HETATM_C];
    const result = extractAndRename(lines, ['A', 'B'], 'X');
    const resultLines = result.split('\n');
    expect(resultLines).toHaveLength(2);
    expect(resultLines.every(l => l[21] === 'X')).toBe(true);
  });

  it('excludes chains not in the list', () => {
    const lines = [ATOM_A, ATOM_B];
    const result = extractAndRename(lines, ['A'], 'R');
    expect(result.split('\n')).toHaveLength(1);
    expect(result[21]).toBe('R');
  });

  it('returns empty string when no matching chains', () => {
    expect(extractAndRename([ATOM_A], ['Z'], 'X')).toBe('');
  });

  it('preserves all other columns beyond position 21', () => {
    const lines = [ATOM_A];
    const result = extractAndRename(lines, ['A'], 'X');
    expect(result.slice(22)).toBe(ATOM_A.slice(22));
    expect(result.slice(0, 21)).toBe(ATOM_A.slice(0, 21));
  });
});

// ── extractOriginal ───────────────────────────────────────────────────────────

describe('extractOriginal', () => {
  it('keeps ATOM, HETATM, and TER lines for specified chains', () => {
    const terA = 'TER       5      ALA A   1';
    const lines = [ATOM_A, ATOM_B, terA];
    const result = extractOriginal(lines, ['A']);
    expect(result).toContain(ATOM_A);
    expect(result).toContain(terA);
    expect(result).not.toContain(ATOM_B);
  });

  it('does not rename chain IDs (original preserved)', () => {
    const result = extractOriginal([ATOM_A, ATOM_B], ['A', 'B']);
    // result is [ATOM_A, TER, ATOM_B, TER]
    expect(result[0][21]).toBe('A');
    expect(result[2][21]).toBe('B');
  });

  it('synthesizes TER after each chain when source has none', () => {
    const result = extractOriginal([ATOM_A, ATOM_B], ['A', 'B']);
    expect(result[1]).toBe('TER');  // after chain A
    expect(result[3]).toBe('TER');  // after chain B
  });

  it('excludes REMARK and other non-coordinate lines', () => {
    const remark = 'REMARK   1 foo';
    const result = extractOriginal([remark, ATOM_A], ['A']);
    expect(result).not.toContain(remark);
    expect(result).toContain(ATOM_A);
  });

  it('returns empty array when no chains match', () => {
    expect(extractOriginal([ATOM_A], ['Z'])).toHaveLength(0);
  });
});
