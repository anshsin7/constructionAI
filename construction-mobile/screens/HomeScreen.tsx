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
        <Text style={styles.title}>C-FLOW</Text>
        <View style={styles.switchRow}>
          <Pressable
            style={[styles.chip, user.id === MARCO.id && styles.chipActive]}
            onPress={() => onSwitchUser(MARCO)}
          >
            <Text style={[styles.chipText, user.id === MARCO.id && styles.chipTextActive]}>MARCO</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, user.id === SARA.id && styles.chipActive]}
            onPress={() => onSwitchUser(SARA)}
          >
            <Text style={[styles.chipText, user.id === SARA.id && styles.chipTextActive]}>SARA</Text>
          </Pressable>
        </View>
      </View>

      {cameraLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>ANALYZING...</Text>
        </View>
      ) : (
        <View style={styles.buttons}>
          <Pressable style={styles.bigButton} onPress={openCamera}>
            <Text style={styles.bigLabel}>CAMERA</Text>
          </Pressable>

          <Pressable
            style={styles.bigButton}
            onPress={() => navigation.navigate('Voice', { user })}
          >
            <Text style={styles.bigLabel}>VOICE</Text>
          </Pressable>

          <Pressable
            style={styles.bigButton}
            onPress={() => navigation.navigate('TextInput', { user })}
          >
            <Text style={styles.bigLabel}>TEXT</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.footer}>
        <Pressable style={styles.footerBtn} onPress={() => navigation.navigate('MyOrders', { user })}>
          <Text style={styles.footerBtnText}>MY ORDERS</Text>
        </Pressable>
        {user.role === 'approver' && (
          <Pressable style={[styles.footerBtn, styles.footerBtnAccent]} onPress={() => navigation.navigate('Approvals', { user })}>
            <Text style={styles.footerBtnTextAccent}>APPROVALS</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: 24, paddingBottom: 12 },
  title: { fontSize: 36, fontWeight: '900', color: colors.text, letterSpacing: 2 },
  switchRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '900', fontSize: 18 },
  chipTextActive: { color: '#000' },
  buttons: { flex: 1, padding: 20, gap: 16, justifyContent: 'center' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { color: colors.text, fontSize: 22, fontWeight: '900' },
  bigButton: {
    backgroundColor: colors.card,
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderWidth: 3,
    borderColor: colors.text
  },
  bigLabel: { fontSize: 28, fontWeight: '900', color: colors.text, textAlign: 'center', letterSpacing: 1 },
  footer: { padding: 20, gap: 12 },
  footerBtn: {
    borderWidth: 2,
    borderColor: colors.muted,
    paddingVertical: 16,
    alignItems: 'center'
  },
  footerBtnText: { fontSize: 18, fontWeight: '900', color: colors.text },
  footerBtnAccent: { borderColor: colors.primary },
  footerBtnTextAccent: { fontSize: 18, fontWeight: '900', color: colors.primary }
})
