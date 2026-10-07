import { Platform } from 'react-native';
import { File } from 'expo-file-system';

export interface OpenedFile {
  size: number;
  text(): Promise<string>;
  bytes(): Promise<Uint8Array>;
}

/** Abre un archivo elegido con expo-document-picker en nativo (File de expo-file-system) y en web (blob:). */
export async function openFile(uri: string): Promise<OpenedFile> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    return {
      size: blob.size,
      text: () => blob.text(),
      bytes: async () => new Uint8Array(await blob.arrayBuffer()),
    };
  }
  const f = new File(uri);
  return { size: f.size, text: () => f.text(), bytes: () => f.bytes() };
}
