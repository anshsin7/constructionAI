import Constants from 'expo-constants'
import { Platform } from 'react-native'

/** Metro / Expo Go host (your Mac on the same Wi‑Fi as the phone). */
function getExpoDevHost(): string | null {
  const raw =
    Constants.expoConfig?.hostUri ??
    (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig
      ?.debuggerHost

  if (!raw) return null

  const withoutScheme = raw.replace(/^exp:\/\//, '').split('/')[0]
  const host = withoutScheme.split(':')[0]
  if (!host || host === 'localhost' || host === '127.0.0.1') return null
  return host
}

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL
  const devHost = getExpoDevHost()

  if (fromEnv) {
    if (devHost && /localhost|127\.0\.0\.1/.test(fromEnv)) {
      return fromEnv.replace(/localhost|127\.0\.0\.1/g, devHost)
    }
    return fromEnv
  }

  if (devHost) return `http://${devHost}:3001`
  if (Platform.OS === 'android') return 'http://10.0.2.2:3001'
  return 'http://localhost:3001'
}

export const API_URL = resolveApiUrl()
