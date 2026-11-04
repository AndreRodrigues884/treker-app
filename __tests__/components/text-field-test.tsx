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

  it('is labelled and uses the decimal keypad when numeric', async () => {
    await render(<TextField label="Weight" numeric />);

    expect(screen.getByLabelText('Weight')).toHaveProp('keyboardType', 'decimal-pad');
  });
});
