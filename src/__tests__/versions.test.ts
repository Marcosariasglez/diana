import fs from 'fs';
import path from 'path';
import semver from 'semver';

describe('Package versions', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'),
  );

  it('expo version is >= 57.0.17', () => {
    const expoVersion = pkg.dependencies.expo;
    // Remove range prefix (~ or ^) for comparison
    const clean = expoVersion.replace(/^[~^]/, '');
    expect(semver.gte(clean, '57.0.17')).toBe(true);
  });

  it('required packages are installed', () => {
    const required = [
      'expo',
      'expo-router',
      'expo-font',
      'expo-splash-screen',
      'expo-haptics',
      'expo-clipboard',
      'expo-file-system',
      'expo-document-picker',
      'nativewind',
      'tailwindcss',
      'zustand',
      '@shopify/flash-list',
      'lucide-react-native',
      'react-native-svg',
      'papaparse',
      'jszip',
      'jest-expo',
      '@testing-library/react-native',
      '@react-native-async-storage/async-storage',
    ];
    for (const name of required) {
      expect(pkg.dependencies[name]).toBeDefined();
    }
  });
});
