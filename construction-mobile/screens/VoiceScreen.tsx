import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system/legacy'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { classify, transcribe } from '../lib/api'
import { colors } from '../lib/theme'
import type { RootStackParamList } from '../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'Voice'>

export function VoiceScreen({ navigation, route }: Props) {
  const { user } = route.params
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Audio.requestPermissionsAsync()
  }, [])

  async function startRecording() {
    setError(null)

    const { status } = await Audio.requestPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow microphone access to use voice search.')
      return
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      })

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      setRecording(rec)
    } catch {
      Alert.alert(
        'Microphone unavailable',
        Platform.OS === 'ios'
          ? 'The iOS Simulator has no mic. Use Text, or run on a real iPhone.'
          : 'Could not start recording. Check microphone permission.'
      )
    }
  }

  async function stopAndClassify() {
    if (!recording) return
    setLoading(true)
    setError(null)
    try {
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      setRecording(null)
      if (!uri) throw new Error('No recording')

      const ext = uri.split('.').pop()?.toLowerCase() || 'm4a'
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      })
      if (!base64) throw new Error('Recording file was empty')

      const { text } = await transcribe(base64, `recording.${ext}`)
      const { classification, products } = await classify('text', text)
      navigation.replace('Results', {
        user,
        inputMethod: 'voice',
        classification,
        products
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Voice failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Hold to record</Text>
      <Text style={styles.subtitle}>
        Describe what you need on site{'\n'}
        (Requires a real device — simulator has no mic)
      </Text>

      {!recording ? (
        <Pressable style={styles.micButton} onPress={startRecording} disabled={loading}>
          <Text style={styles.micEmoji}>🎤</Text>
          <Text style={styles.micLabel}>Tap to Record</Text>
        </Pressable>
      ) : (
        <Pressable style={[styles.micButton, styles.recording]} onPress={stopAndClassify}>
          <Text style={styles.micEmoji}>⏹</Text>
          <Text style={styles.micLabel}>Tap to Stop & Search</Text>
        </Pressable>
      )}

      {loading && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />}
      {error && <Text style={styles.error}>{error}</Text>}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: 24, alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 16, color: colors.muted, marginTop: 8, marginBottom: 40 },
  micButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  recording: { borderColor: colors.danger, backgroundColor: '#450a0a' },
  micEmoji: { fontSize: 48 },
  micLabel: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
  error: { color: colors.danger, marginTop: 24, fontSize: 16, textAlign: 'center' }
})
