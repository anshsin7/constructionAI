import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { KeyboardDismissView } from '../components/KeyboardDismissView'
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
    Keyboard.dismiss()
    setLoading(true)
    setError(null)
    try {
      const { classification, products } = await classify('text', text.trim(), user.id)
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
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardDismissView>
        <Text style={styles.title}>WHAT DO YOU NEED?</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. screws for concrete"
          placeholderTextColor={colors.border}
          value={text}
          onChangeText={setText}
          multiline
          editable={!loading}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={Keyboard.dismiss}
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
            <Text style={styles.buttonText}>FIND PRODUCTS</Text>
          )}
        </Pressable>
      </KeyboardDismissView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingTop: 8 },
  title: { fontSize: 28, fontWeight: '900', color: colors.text, marginBottom: 16, letterSpacing: 1 },
  input: {
    minHeight: 140,
    backgroundColor: colors.card,
    padding: 20,
    fontSize: 22,
    color: colors.text,
    borderWidth: 3,
    borderColor: colors.text,
    textAlignVertical: 'top'
  },
  error: { color: colors.danger, marginTop: 16, fontSize: 18, fontWeight: '700' },
  button: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 24,
    alignItems: 'center'
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 22, fontWeight: '900', color: '#000', letterSpacing: 1 }
})
