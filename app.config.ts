const baseUrl = process.env.EXPO_BASE_URL ?? '';

export default {
  name: 'Diana',
  slug: 'diana',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'diana',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#F8F9FA',
      foregroundImage: './assets/images/android-icon-foreground.png',
    },
    package: 'com.diana.app',
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png',
    name: 'Diana',
    shortName: 'Diana',
    backgroundColor: '#F8F9FA',
    themeColor: '#008060',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F8F9FA',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      'expo-font',
      {
        fonts: ['./assets/fonts/Manrope-VariableFont.ttf'],
      },
    ],
  ],
  ...(baseUrl ? { experiments: { baseUrl } } : {}),
};
