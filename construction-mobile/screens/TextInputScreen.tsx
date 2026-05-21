import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { classify } from '../lib/api'
import { colors } from '../lib/theme'
import type { RootStackParamList } from '../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'TextInput'>

export function TextInputScreen({ navigation, route }: Props) {
  const { user } = route.params
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { classification, products } = await classify('text', text.trim())
      navigation.replace('Results', {
        user,
        inputMethod: 'text',
        classification,
        products
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>What do you need?</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. I need screws for concrete"
        placeholderTextColor={colors.muted}
        value={text}
        onChangeText={setText}
        multiline
        editable={!loading}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={submit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.buttonText}>Find Products</Text>
        )}
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: 24 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 16 },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 20,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top'
  },
  error: { color: colors.danger, marginTop: 12, fontSize: 16 },
  button: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center'
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 20, fontWeight: '800', color: '#000' }
})
