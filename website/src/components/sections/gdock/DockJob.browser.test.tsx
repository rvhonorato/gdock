import { describe, it, expect } from 'vitest';
import { render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { DockJob } from './DockJob';
import receptorRaw from '../../../__fixtures__/2oob_A.pdb?raw';
import ligandRaw from '../../../__fixtures__/2oob_B.pdb?raw';

function makePdbFile(name: string, content: string): File {
  return new File([content], name, { type: 'chemical/x-pdb' });
}

// Only .pdb inputs (not the .gdock restore input)
function getPdbInputs(container: HTMLElement) {
  return container.querySelectorAll<HTMLInputElement>('input[type="file"][accept=".pdb"]');
}

function getSelects(container: HTMLElement) {
  return container.querySelectorAll<HTMLSelectElement>('select');
}

// Upload both files and add the first available restraint pair.
// Returns the container after setup.
async function uploadAndAddRestraint(
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
) {
  await user.upload(getPdbInputs(container)[0], makePdbFile('2oob_A.pdb', receptorRaw));
  await user.upload(getPdbInputs(container)[1], makePdbFile('2oob_B.pdb', ligandRaw));

  await waitFor(() => {
    const sels = getSelects(container);
    expect(sels[0]).not.toBeDisabled();
    expect(sels[1]).not.toBeDisabled();
  });

  const sels = getSelects(container);
  await user.selectOptions(sels[0], sels[0].options[1].value);
  await user.selectOptions(sels[1], sels[1].options[1].value);
  await user.click(within(container).getByRole('button', { name: 'Add' }));
}

describe('DockJob (real WASM)', () => {
  it('renders description, upload areas, restraints section and disabled dock button', () => {
    const { container } = render(<DockJob />);
    expect(within(container).getByText(/upload a receptor and ligand pdb/i)).toBeInTheDocument();
    expect(within(container).getByText('Receptor')).toBeInTheDocument();
    expect(within(container).getByText('Ligand')).toBeInTheDocument();
    expect(within(container).getByText('Restraints')).toBeInTheDocument();
    expect(within(container).getByRole('button', { name: /dock/i })).toBeDisabled();
  });

  it('shows filename after uploading receptor', async () => {
    const user = userEvent.setup();
    const { container } = render(<DockJob />);
    await user.upload(getPdbInputs(container)[0], makePdbFile('2oob_A.pdb', receptorRaw));
    expect(await within(container).findByText('2oob_A.pdb')).toBeInTheDocument();
  });

  it('shows filename after uploading ligand', async () => {
    const user = userEvent.setup();
    const { container } = render(<DockJob />);
    await user.upload(getPdbInputs(container)[1], makePdbFile('2oob_B.pdb', ligandRaw));
    expect(await within(container).findByText('2oob_B.pdb')).toBeInTheDocument();
  });

  it('populates receptor residue select after upload', async () => {
    const user = userEvent.setup();
    const { container } = render(<DockJob />);
    expect(getSelects(container)[0]).toBeDisabled();
    await user.upload(getPdbInputs(container)[0], makePdbFile('2oob_A.pdb', receptorRaw));
    await waitFor(() => expect(getSelects(container)[0]).not.toBeDisabled());
    expect(getSelects(container)[0].options.length).toBeGreaterThan(1);
  });

  it('populates ligand residue select after upload', async () => {
    const user = userEvent.setup();
    const { container } = render(<DockJob />);
    expect(getSelects(container)[1]).toBeDisabled();
    await user.upload(getPdbInputs(container)[1], makePdbFile('2oob_B.pdb', ligandRaw));
    await waitFor(() => expect(getSelects(container)[1]).not.toBeDisabled());
    expect(getSelects(container)[1].options.length).toBeGreaterThan(1);
  });

  it('shows restraint pair and enables dock button after adding pair', async () => {
    const user = userEvent.setup();
    const { container } = render(<DockJob />);
    await uploadAndAddRestraint(user, container);
    expect(within(container).getByText('↔')).toBeInTheDocument();
    expect(within(container).getByRole('button', { name: /dock/i })).not.toBeDisabled();
  });

  it('clears all restraints when Clear all is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<DockJob />);
    await uploadAndAddRestraint(user, container);
    expect(within(container).getByText('↔')).toBeInTheDocument();
    await user.click(within(container).getByRole('button', { name: /clear all/i }));
    expect(within(container).queryByText('↔')).not.toBeInTheDocument();
    expect(within(container).getByRole('button', { name: /dock/i })).toBeDisabled();
  });

  it('runs docking and shows results table with clustered and ranked poses', async () => {
    const user = userEvent.setup();
    const { container } = render(<DockJob />);
    await uploadAndAddRestraint(user, container);

    await user.click(within(container).getByRole('button', { name: /dock/i }));

    await within(container).findByText('Results', {}, { timeout: 240_000 });

    // Stats panel
    expect(within(container).getByText('generations')).toBeInTheDocument();
    expect(within(container).getByText('total runtime')).toBeInTheDocument();

    // At least one clustered pose row
    expect(within(container).getByText('model_1.pdb')).toBeInTheDocument();

    // At least one ranked pose row
    expect(within(container).getByText('ranked_1.pdb')).toBeInTheDocument();

    // Numeric cells (fitness, vdw, elec, desolv, air) should contain finite numbers.
    // The cluster column for ranked poses shows '—' — skip those.
    const cells = Array.from(container.querySelectorAll<HTMLElement>('td.font-mono.tabular-nums'))
      .filter(c => c.textContent !== '—');
    expect(cells.length).toBeGreaterThan(0);
    cells.forEach(cell => {
      expect(isFinite(parseFloat(cell.textContent ?? ''))).toBe(true);
    });
  }, 250_000);
});
