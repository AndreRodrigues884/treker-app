import { render, screen } from '@testing-library/react-native';

import { TextField } from '@/components';

describe('TextField', () => {
  it('shows the error as an alert', async () => {
    await render(<TextField label="Reps" error="Enter at least 1 rep." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Enter at least 1 rep.');
  });

  it('shows no error when there is none', async () => {
    await render(<TextField label="Reps" />);

    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('is labelled and uses the decimal keypad for decimals', async () => {
    await render(<TextField label="Weight" kind="decimal" />);

    expect(screen.getByLabelText('Weight')).toHaveProp('keyboardType', 'decimal-pad');
  });
});

describe('TextField kinds', () => {
  it.each([
    ['email', 'email-address'],
    ['integer', 'number-pad'],
    ['text', 'default'],
  ] as const)('%s uses the %s keyboard', async (kind, keyboardType) => {
    await render(<TextField label="Field" kind={kind} />);

    expect(screen.getByLabelText('Field')).toHaveProp('keyboardType', keyboardType);
  });
});
