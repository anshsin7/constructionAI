// iOS Simulator: localhost | Android emulator: 10.0.0.2 | Physical device: your Mac's LAN IP
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'
