import { render, screen } from '@testing-library/react-native';

import HomeScreen from '@/app/index';

describe('HomeScreen', () => {
  it('shows the app name', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('Treker')).toBeOnTheScreen();
  });
});
