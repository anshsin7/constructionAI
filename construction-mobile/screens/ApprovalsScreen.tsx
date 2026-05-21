import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { approveOrder, fetchOrders, rejectOrder } from '../lib/api'
import { colors } from '../lib/theme'
import type { Order } from '../lib/types'
import type { RootStackParamList } from '../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'Approvals'>

export function ApprovalsScreen({ route }: Props) {
  const { user } = route.params
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const { orders: data } = await fetchOrders({
        approver_id: user.id,
        status: 'pending_approval'
      })
      setOrders(data)
    } catch (e) {
      setOrders([])
      setError(e instanceof Error ? e.message : 'Could not load approvals')
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      load()
    }, [load])
  )

  async function act(id: string, action: 'approve' | 'reject') {
    setActingId(id)
    try {
      if (action === 'approve') await approveOrder(id, user.id, note || undefined)
      else await rejectOrder(id, user.id, note || undefined)
      setNote('')
      await load()
    } finally {
      setActingId(null)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Pending Approvals</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <TextInput
        style={styles.noteInput}
        placeholder="Optional note for all actions"
        placeholderTextColor={colors.muted}
        value={note}
        onChangeText={setNote}
      />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No pending requests.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.productName}>{item.products?.name ?? 'Product'}</Text>
              <Text style={styles.meta}>
                Qty {item.quantity} · CHF {item.total_price}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.approve, actingId === item.id && styles.disabled]}
                  onPress={() => act(item.id, 'approve')}
                  disabled={!!actingId}
                >
                  <Text style={styles.actionText}>Approve</Text>
                </Pressable>
                <Pressable
                  style={[styles.reject, actingId === item.id && styles.disabled]}
                  onPress={() => act(item.id, 'reject')}
                  disabled={!!actingId}
                >
                  <Text style={styles.actionText}>Reject</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, padding: 20, paddingBottom: 8 },
  noteInput: {
    marginHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border
  },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  productName: { fontSize: 20, fontWeight: '700', color: colors.text },
  meta: { fontSize: 15, color: colors.muted, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 14 },
  approve: {
    flex: 1,
    backgroundColor: colors.success,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center'
  },
  reject: {
    flex: 1,
    backgroundColor: colors.danger,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center'
  },
  actionText: { fontWeight: '800', fontSize: 16, color: '#fff' },
  disabled: { opacity: 0.5 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
  error: { color: colors.danger, paddingHorizontal: 20, paddingBottom: 8, fontSize: 15 }
})
