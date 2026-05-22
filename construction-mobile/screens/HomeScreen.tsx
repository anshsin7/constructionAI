import { NativeStackScreenProps } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { classify } from '../lib/api'
import { API_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/types'
import { colors } from '../lib/theme'
import { MARCO, SARA, type DemoUser } from '../lib/users'

type Props = NativeStackScreenProps<RootStackParamList, 'Home'> & {
  user: DemoUser
  onSwitchUser: (user: DemoUser) => void
}

export function HomeScreen({ navigation, user, onSwitchUser }: Props) {
  const [cameraLoading, setCameraLoading] = useState(false)

  async function pickImage(base64: string) {
    setCameraLoading(true)
    try {
      const { classification, products } = await classify('image', base64, user.id)
      navigation.navigate('Results', {
        user,
        inputMethod: 'image',
        classification,
        products
      })
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Classification failed')
    } finally {
      setCameraLoading(false)
    }
  }

  async function openCamera() {
    Alert.alert('Add photo', 'Take a new photo or pick one from your library.', [
      {
        text: 'Take photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync()
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera access is required.')
            return
          }
          const result = await ImagePicker.launchCameraAsync({
            quality: 0.6,
            base64: true
          })
          if (result.canceled || !result.assets[0]?.base64) return
          await pickImage(result.assets[0].base64)
        }
      },
      {
        text: 'Photo library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Photo library access is required.')
            return
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            quality: 0.6,
            base64: true,
            mediaTypes: ['images']
          })
          if (result.canceled || !result.assets[0]?.base64) return
          await pickImage(result.assets[0].base64)
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ])
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>C-Flow</Text>
        <Text style={styles.subtitle}>
          Logged in as {user.name} ({user.role})
        </Text>
        <View style={styles.switchRow}>
          <Pressable
            style={[styles.chip, user.id === MARCO.id && styles.chipActive]}
            onPress={() => onSwitchUser(MARCO)}
          >
            <Text style={styles.chipText}>Marco</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, user.id === SARA.id && styles.chipActive]}
            onPress={() => onSwitchUser(SARA)}
          >
            <Text style={styles.chipText}>Sara</Text>
          </Pressable>
        </View>
      </View>

      {cameraLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Analyzing image…</Text>
        </View>
      ) : (
        <View style={styles.buttons}>
          <Pressable style={styles.bigButton} onPress={openCamera}>
            <Text style={styles.bigEmoji}>📷</Text>
            <Text style={styles.bigLabel}>Camera</Text>
            <Text style={styles.bigHint}>Photo of product or site</Text>
          </Pressable>

          <Pressable
            style={styles.bigButton}
            onPress={() => navigation.navigate('Voice', { user })}
          >
            <Text style={styles.bigEmoji}>🎤</Text>
            <Text style={styles.bigLabel}>Microphone</Text>
            <Text style={styles.bigHint}>Say what you need</Text>
          </Pressable>

          <Pressable
            style={styles.bigButton}
            onPress={() => navigation.navigate('TextInput', { user })}
          >
            <Text style={styles.bigEmoji}>⌨️</Text>
            <Text style={styles.bigLabel}>Text</Text>
            <Text style={styles.bigHint}>Type your request</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.apiHint}>API: {API_URL}</Text>
        <Pressable onPress={() => navigation.navigate('MyOrders', { user })}>
          <Text style={styles.link}>My Orders</Text>
        </Pressable>
        {user.role === 'approver' && (
          <Pressable onPress={() => navigation.navigate('Approvals', { user })}>
            <Text style={[styles.link, styles.linkAccent]}>Pending Approvals</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: 24, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 16, color: colors.muted, marginTop: 4 },
  switchRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border
  },
  chipActive: { borderColor: colors.primary, backgroundColor: '#422006' },
  chipText: { color: colors.text, fontWeight: '600' },
  buttons: { flex: 1, padding: 20, gap: 14, justifyContent: 'center' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: colors.muted, fontSize: 18 },
  bigButton: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: colors.border
  },
  bigEmoji: { fontSize: 36, marginBottom: 8 },
  bigLabel: { fontSize: 24, fontWeight: '800', color: colors.text },
  bigHint: { fontSize: 15, color: colors.muted, marginTop: 4 },
  footer: { padding: 24, gap: 12, alignItems: 'center' },
  apiHint: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  link: { fontSize: 18, color: colors.muted, fontWeight: '600' },
  linkAccent: { color: colors.primary }
})
