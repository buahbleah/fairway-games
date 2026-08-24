import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Android wrapper config. `npx cap add android` generates the native project
 * from this; the web build in dist/ is what actually runs inside it.
 */
const config: CapacitorConfig = {
  appId: 'ch.fairwaygames.app',
  appName: 'Fairway Games',
  webDir: 'dist',
  android: {
    backgroundColor: '#0E2B21',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 600,
      backgroundColor: '#0E2B21',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
}

export default config
