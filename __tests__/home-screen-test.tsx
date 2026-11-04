import { render, screen } from '@testing-library/react-native';

import HomeScreen from '@/app/index';

describe('HomeScreen', () => {
  it('shows the app name', async () => {
    await render(<HomeScreen />);
    expect(screen.getByRole('header', { name: 'Treker' })).toBeOnTheScreen();
  });

  it('links to the component catalog in development', async () => {
    await render(<HomeScreen />);
    expect(screen.getByRole('button', { name: 'Component catalog' })).toBeOnTheScreen();
  });
});
