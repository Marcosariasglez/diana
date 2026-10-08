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
      backgroundColor: '#F4F3EF',
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
    backgroundColor: '#F4F3EF',
    themeColor: '#0B7A66',
  },
  plugins: [
    'expo-router',
    'expo-sharing',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F4F3EF',
        dark: {
          backgroundColor: '#0A0C0F',
        },
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      'expo-font',
      {
        fonts: [
          './assets/fonts/Manrope-SemiBold.ttf',
          './assets/fonts/Manrope-Bold.ttf',
          './assets/fonts/Manrope-ExtraBold.ttf',
          './assets/fonts/Inter-Regular.ttf',
          './assets/fonts/Inter-Medium.ttf',
          './assets/fonts/Inter-SemiBold.ttf',
          './assets/fonts/Inter-Bold.ttf',
        ],
      },
    ],
  ],
  ...(baseUrl ? { experiments: { baseUrl } } : {}),
};
