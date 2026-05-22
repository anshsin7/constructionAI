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
import { showPricesForUser } from '../lib/roles'
import { colors } from '../lib/theme'
import type { Order } from '../lib/types'
import type { RootStackParamList } from '../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'MyOrders'>

const STATUS_COLORS: Record<string, string> = {
  pending_approval: colors.primary,
  queued: '#BB86FC',
  approved: colors.success,
  rejected: colors.danger,
  po_sent: '#64B5F6',
  confirmed: colors.success
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending_approval: 'PENDING',
    queued: 'QUEUED',
    approved: 'APPROVED',
    rejected: 'REJECTED',
    po_sent: 'PO SENT',
    confirmed: 'CONFIRMED'
  }
  return labels[status] ?? status.replace(/_/g, ' ').toUpperCase()
}

export function MyOrdersScreen({ route }: Props) {
  const { user } = route.params
  const showPrices = showPricesForUser(user)
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
      <Text style={styles.title}>MY ORDERS</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>NO ORDERS YET</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.productName}>{item.products?.name ?? 'Product'}</Text>
              <Text style={styles.meta}>
                QTY {item.quantity}
                {showPrices && item.total_price != null ? ` · CHF ${item.total_price}` : ''}
              </Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: STATUS_COLORS[item.status] ?? colors.muted }
                ]}
              >
                <Text style={styles.badgeText}>{statusLabel(item.status)}</Text>
              </View>
              {item.po_pdf_url ? (
                <Pressable style={styles.pdfBtn} onPress={() => Linking.openURL(item.po_pdf_url!)}>
                  <Text style={styles.pdfBtnText}>VIEW PO PDF</Text>
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
  title: { fontSize: 28, fontWeight: '900', color: colors.text, padding: 20, letterSpacing: 1 },
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
  badge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  badgeText: { color: '#000', fontWeight: '900', fontSize: 16 },
  pdfBtn: { marginTop: 14, paddingVertical: 12, borderWidth: 2, borderColor: colors.primary, alignItems: 'center' },
  pdfBtnText: { fontSize: 16, color: colors.primary, fontWeight: '900' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40, fontSize: 20, fontWeight: '900' },
  error: { color: colors.danger, paddingHorizontal: 20, paddingBottom: 8, fontSize: 18, fontWeight: '700' }
})
