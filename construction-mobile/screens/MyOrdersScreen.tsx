import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { fetchOrders } from '../lib/api'
import { API_URL } from '../lib/config'
import { colors } from '../lib/theme'
import type { Order } from '../lib/types'
import type { RootStackParamList } from '../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'MyOrders'>

const STATUS_COLORS: Record<string, string> = {
  pending_approval: colors.primary,
  approved: colors.success,
  rejected: colors.danger,
  po_sent: '#3b82f6',
  confirmed: colors.success
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending_approval: 'Awaiting approval',
    approved: 'Approved',
    rejected: 'Rejected',
    po_sent: 'PO sent to supplier',
    confirmed: 'Confirmed by supplier'
  }
  return labels[status] ?? status.replace(/_/g, ' ')
}

export function MyOrdersScreen({ route }: Props) {
  const { user } = route.params
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const { orders: data } = await fetchOrders({ requestor_id: user.id })
      setOrders(data)
    } catch (e) {
      setOrders([])
      setError(e instanceof Error ? e.message : 'Could not load orders')
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

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>My Orders ({user.name})</Text>
      {error && (
        <Text style={styles.error}>
          {error}
          {'\n'}API: {API_URL}
        </Text>
      )}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No orders yet.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.productName}>{item.products?.name ?? 'Product'}</Text>
              <Text style={styles.meta}>
                Qty {item.quantity} · CHF {item.total_price}
              </Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: STATUS_COLORS[item.status] ?? colors.muted }
                ]}
              >
                <Text style={styles.badgeText}>{statusLabel(item.status)}</Text>
              </View>
              {item.approval_note && (
                <Text style={styles.note}>Note: {item.approval_note}</Text>
              )}
              {item.status === 'po_sent' && (
                <Text style={styles.hint}>Waiting for supplier to confirm.</Text>
              )}
              {item.status === 'confirmed' && (
                <Text style={styles.hint}>Supplier confirmed this order.</Text>
              )}
              {item.po_pdf_url ? (
                <Pressable onPress={() => Linking.openURL(item.po_pdf_url!)}>
                  <Text style={styles.pdfLink}>View PO PDF</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, padding: 20 },
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
  badge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  badgeText: { color: '#000', fontWeight: '700', fontSize: 13, textTransform: 'capitalize' },
  note: { fontSize: 14, color: colors.muted, marginTop: 8 },
  hint: { fontSize: 14, color: colors.primary, marginTop: 8 },
  pdfLink: { fontSize: 16, color: colors.primary, fontWeight: '700', marginTop: 10 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40, fontSize: 16 },
  error: { color: colors.danger, paddingHorizontal: 20, paddingBottom: 8, fontSize: 15 }
})
