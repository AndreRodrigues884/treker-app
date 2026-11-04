import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/components';

describe('Button', () => {
  it('calls onPress when enabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled and does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} disabled />);

    const button = screen.getByRole('button', { name: 'Save' });
    await fireEvent.press(button);

    expect(button).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('is busy, disabled and shows a spinner while loading', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} loading />);

    const button = screen.getByRole('button', { name: 'Save' });
    await fireEvent.press(button);

    expect(button).toBeBusy();
    expect(button).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });
});
