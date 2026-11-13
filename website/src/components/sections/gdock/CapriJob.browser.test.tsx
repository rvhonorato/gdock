import { describe, it, expect } from 'vitest';
import { render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { CapriJob } from './CapriJob';
import ensembleRaw from '../../../__fixtures__/Target316_2models.pdb?raw';

function makeEnsembleFile(name: string, content: string): File {
  return new File([content], name, { type: 'chemical/x-pdb' });
}

function getEnsembleInput(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('input[type="file"][accept=".pdb,.gz"]')!;
}

function getNumberInputs(container: HTMLElement) {
  return container.querySelectorAll<HTMLInputElement>('input[type="number"]');
}

// Upload the 2-model ensemble, assign chain A as receptor and chain H as ligand,
// then set minClusterSize=1 so clustering works with only 2 models.
// Target316_2models.pdb contains chains A, H, L.
async function uploadAndAssignChains(
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
) {
  await user.upload(getEnsembleInput(container), makeEnsembleFile('Target316.pdb', ensembleRaw));

  // Wait for chain buttons to appear
  await waitFor(() => expect(within(container).getByRole('button', { name: 'A' })).toBeInTheDocument());

  // Click A once: none → receptor (button name becomes "AReceptor")
  await user.click(within(container).getByRole('button', { name: 'A' }));
  // Click H twice: none → receptor → ligand (button name: "H" → "HReceptor" → "HLigand")
  await user.click(within(container).getByRole('button', { name: 'H' }));
  await user.click(within(container).getByRole('button', { name: 'HReceptor' }));

  // Lower min cluster size to 1 so 2-model ensemble always produces clusters
  const [, minSizeInput] = getNumberInputs(container);
  await user.tripleClick(minSizeInput);
  await user.type(minSizeInput, '1');
}

describe('CapriJob (real WASM)', () => {
  it('renders description and upload area', () => {
    const { container } = render(<CapriJob />);
    expect(within(container).getByText(/upload a capri multi-model ensemble pdb/i)).toBeInTheDocument();
    expect(within(container).getByText('Ensemble')).toBeInTheDocument();
    expect(within(container).getByRole('button', { name: /cluster & score/i })).toBeDisabled();
  });

  it('shows filename and chain buttons after upload', async () => {
    const user = userEvent.setup();
    const { container } = render(<CapriJob />);
    await user.upload(getEnsembleInput(container), makeEnsembleFile('Target316.pdb', ensembleRaw));

    expect(await within(container).findByText('Target316.pdb')).toBeInTheDocument();
    // Target316_2models.pdb contains chains A, H, L
    await waitFor(() => {
      expect(within(container).getByRole('button', { name: 'A' })).toBeInTheDocument();
      expect(within(container).getByRole('button', { name: 'H' })).toBeInTheDocument();
      expect(within(container).getByRole('button', { name: 'L' })).toBeInTheDocument();
    });
  });

  it('enables run button after assigning receptor and ligand chains', async () => {
    const user = userEvent.setup();
    const { container } = render(<CapriJob />);
    await uploadAndAssignChains(user, container);

    expect(within(container).getByRole('button', { name: /cluster & score/i })).not.toBeDisabled();
  });

  it('chain button label reflects assigned role', async () => {
    const user = userEvent.setup();
    const { container } = render(<CapriJob />);
    await user.upload(getEnsembleInput(container), makeEnsembleFile('Target316.pdb', ensembleRaw));
    await waitFor(() => expect(within(container).getByRole('button', { name: 'A' })).toBeInTheDocument());

    // A: click once → receptor (accessible name becomes "AReceptor" — no space in DOM)
    await user.click(within(container).getByRole('button', { name: 'A' }));
    await waitFor(() =>
      expect(within(container).getByRole('button', { name: 'AReceptor' })).toBeInTheDocument()
    );

    // H: click twice → ligand
    await user.click(within(container).getByRole('button', { name: 'H' }));
    await user.click(within(container).getByRole('button', { name: 'HReceptor' }));
    await waitFor(() =>
      expect(within(container).getByRole('button', { name: 'HLigand' })).toBeInTheDocument()
    );
  });

});
