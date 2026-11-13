import { describe, it, expect } from 'vitest';
import { render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { ScoreJob } from './ScoreJob';
import receptorRaw from '../../../__fixtures__/2oob_A.pdb?raw';
import ligandRaw from '../../../__fixtures__/2oob_B.pdb?raw';

function makePdbFile(name: string, content: string): File {
  return new File([content], name, { type: 'chemical/x-pdb' });
}

// Scope file input queries to the current render's container to avoid
// picking up inputs from previous accumulated renders in the browser DOM.
function getInputs(container: HTMLElement) {
  return container.querySelectorAll<HTMLInputElement>('input[type="file"]');
}

describe('ScoreJob (real WASM)', () => {
  it('renders description and upload areas', () => {
    const { container } = render(<ScoreJob />);
    expect(within(container).getByText(/upload a receptor and ligand pdb/i)).toBeInTheDocument();
    expect(within(container).getByText('Receptor')).toBeInTheDocument();
    expect(within(container).getByText('Ligand')).toBeInTheDocument();
  });

  it('shows filename after uploading receptor', async () => {
    const user = userEvent.setup();
    const { container } = render(<ScoreJob />);
    await user.upload(getInputs(container)[0], makePdbFile('2oob_A.pdb', receptorRaw));
    expect(await within(container).findByText('2oob_A.pdb')).toBeInTheDocument();
  });

  it('shows filename after uploading ligand', async () => {
    const user = userEvent.setup();
    const { container } = render(<ScoreJob />);
    await user.upload(getInputs(container)[1], makePdbFile('2oob_B.pdb', ligandRaw));
    expect(await within(container).findByText('2oob_B.pdb')).toBeInTheDocument();
  });

  it('shows Mol* viewer container after uploading a file', async () => {
    const user = userEvent.setup();
    const { container } = render(<ScoreJob />);
    // MolstarViewer renders a div with an explicit height style — absent before any upload
    expect(container.querySelector('div[style*="height"]')).toBeNull();
    await user.upload(getInputs(container)[0], makePdbFile('2oob_A.pdb', receptorRaw));
    await waitFor(() =>
      expect(container.querySelector('div[style*="height"]')).toBeTruthy()
    );
  });

  it('returns numeric energy scores after uploading both files', async () => {
    const user = userEvent.setup();
    const { container } = render(<ScoreJob />);
    await user.upload(getInputs(container)[0], makePdbFile('2oob_A.pdb', receptorRaw));
    await user.upload(getInputs(container)[1], makePdbFile('2oob_B.pdb', ligandRaw));

    // Wait for the results table — WASM initialises on first call
    await within(container).findByText('VDW', {}, { timeout: 15000 });

    expect(within(container).getByText('Electrostatic')).toBeInTheDocument();
    expect(within(container).getByText('Desolvation')).toBeInTheDocument();
    expect(within(container).getByText('Total (weighted)')).toBeInTheDocument();
    expect(within(container).getByText(/Weights: VDW×0\.4/)).toBeInTheDocument();

    // All five value cells must contain finite numbers at 4 d.p.
    const cells = container.querySelectorAll<HTMLElement>('td.font-mono');
    expect(cells.length).toBe(5);
    cells.forEach(cell => {
      expect(isFinite(parseFloat(cell.textContent ?? ''))).toBe(true);
    });
  });

  it('total equals the weighted sum VDW×0.4 + Elec×0.05 + Desolv×3.4 + Clash×1', async () => {
    const user = userEvent.setup();
    const { container } = render(<ScoreJob />);
    await user.upload(getInputs(container)[0], makePdbFile('2oob_A.pdb', receptorRaw));
    await user.upload(getInputs(container)[1], makePdbFile('2oob_B.pdb', ligandRaw));

    await within(container).findByText('VDW', {}, { timeout: 15000 });

    const cells = container.querySelectorAll<HTMLElement>('td.font-mono');
    const [vdw, elec, desolv, clash, total] = Array.from(cells).map(c => parseFloat(c.textContent ?? ''));
    const expected = vdw * 0.4 + elec * 0.05 + desolv * 3.4 + clash;
    expect(total).toBeCloseTo(expected, 3);
  });

  it('re-scores when the receptor is replaced', async () => {
    const user = userEvent.setup();
    const { container } = render(<ScoreJob />);
    await user.upload(getInputs(container)[0], makePdbFile('2oob_A.pdb', receptorRaw));
    await user.upload(getInputs(container)[1], makePdbFile('2oob_B.pdb', ligandRaw));
    await within(container).findByText('VDW', {}, { timeout: 15000 });

    const firstTotal = parseFloat(
      container.querySelectorAll<HTMLElement>('td.font-mono')[3].textContent ?? ''
    );

    // Replace receptor with a shifted version (translate all X coords by +10)
    const shiftedReceptor = receptorRaw.replace(
      /^(ATOM|HETATM)(.{26})(\s+-?\d+\.\d+)/gm,
      (_, rec, mid, x) => `${rec}${mid}${(parseFloat(x) + 10).toFixed(3).padStart(x.length)}`
    );
    await user.upload(getInputs(container)[0], makePdbFile('shifted.pdb', shiftedReceptor));
    await within(container).findByText('shifted.pdb');
    await within(container).findByText('VDW', {}, { timeout: 15000 });

    const secondTotal = parseFloat(
      container.querySelectorAll<HTMLElement>('td.font-mono')[3].textContent ?? ''
    );

    expect(firstTotal).not.toBeCloseTo(secondTotal, 1);
  });
});
