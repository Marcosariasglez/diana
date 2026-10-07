import { Link } from 'expo-router';
import { Text } from 'react-native';
import { Screen } from '@/components/ui/Screen';

export default function NotFound() {
  return (
    <Screen>
      <Text>Esta pantalla no existe.</Text>
      <Link href="/">Volver al inicio</Link>
    </Screen>
  );
}
