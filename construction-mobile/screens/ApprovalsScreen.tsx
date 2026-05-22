import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
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
    setError(null)
    try {
      if (action === 'approve') {
        const { order, po } = await approveOrder(id, user.id)
        const msg = po?.email_sent
          ? `PO emailed to supplier.\nStatus: ${order.status}`
          : po?.po_pdf_url
            ? `PO saved (status: ${order.status}).\nEmail skipped.`
            : `Approved.\nStatus: ${order.status}`
        Alert.alert('Approved', msg)
      } else {
        await rejectOrder(id, user.id)
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setActingId(null)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>APPROVALS</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>NO PENDING REQUESTS</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.productName}>{item.products?.name ?? 'Product'}</Text>
              <Text style={styles.meta}>
                QTY {item.quantity} · CHF {item.total_price}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.approve, actingId === item.id && styles.disabled]}
                  onPress={() => act(item.id, 'approve')}
                  disabled={!!actingId}
                >
                  {actingId === item.id ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.actionText}>APPROVE</Text>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.reject, actingId === item.id && styles.disabled]}
                  onPress={() => act(item.id, 'reject')}
                  disabled={!!actingId}
                >
                  <Text style={styles.rejectText}>REJECT</Text>
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
  title: { fontSize: 28, fontWeight: '900', color: colors.text, padding: 20, paddingBottom: 12, letterSpacing: 1 },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.card,
    padding: 20,
    marginBottom: 14,
    borderWidth: 3,
    borderColor: colors.border
  },
  productName: { fontSize: 22, fontWeight: '900', color: colors.text },
  meta: { fontSize: 18, color: colors.muted, marginTop: 6, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 14, marginTop: 18 },
  approve: {
    flex: 1,
    backgroundColor: colors.success,
    paddingVertical: 20,
    alignItems: 'center'
  },
  reject: {
    flex: 1,
    backgroundColor: colors.danger,
    paddingVertical: 20,
    alignItems: 'center'
  },
  actionText: { fontWeight: '900', fontSize: 18, color: '#000' },
  rejectText: { fontWeight: '900', fontSize: 18, color: '#FFF' },
  disabled: { opacity: 0.5 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40, fontSize: 20, fontWeight: '900' },
  error: { color: colors.danger, paddingHorizontal: 20, paddingBottom: 8, fontSize: 18, fontWeight: '700' }
})
