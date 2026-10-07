import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Screen } from './Screen';

describe('Screen', () => {
  it('renderiza hijos con y sin safe area', async () => {
    await render(
      <Screen bg="#fff">
        <Text>Hola</Text>
      </Screen>,
    );
    expect(screen.getByText('Hola')).toBeTruthy();
    await render(
      <Screen safe={false}>
        <Text>Sin safe</Text>
      </Screen>,
    );
    expect(screen.getByText('Sin safe')).toBeTruthy();
  });
});
