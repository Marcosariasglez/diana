import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHistoryStore } from '@/store/useHistoryStore';
import { createDefaultProfile, useProfileStore } from '@/store/useProfileStore';

/** Borra las claves `diana.*` de AsyncStorage y devuelve los stores al estado inicial. */
export async function resetPrototype(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith('diana.'));
    if (mine.length > 0) await AsyncStorage.multiRemove(mine);
  } catch {
    // Sin almacenamiento disponible: basta con resetear en memoria.
  }
  useHistoryStore.setState({ entries: [], watched: [] });
  useProfileStore.setState({ profile: createDefaultProfile(), hasOnboarded: false });
}
