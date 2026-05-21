import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createOrder } from '../lib/api'
import { colors } from '../lib/theme'
import type { Product } from '../lib/types'
import type { RootStackParamList } from '../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>

function ProductRow({
  product,
  quantity,
  onChangeQty,
  onOrder,
  ordering
}: {
  product: Product
  quantity: number
  onChangeQty: (n: number) => void
  onOrder: () => void
  ordering: boolean
}) {
  const supplier = product.suppliers?.name ?? 'Supplier'
  const lineTotal = Number(product.unit_price) * quantity

  return (
    <View style={styles.card}>
      <Text style={styles.productName}>{product.name}</Text>
      <Text style={styles.meta}>
        CHF {product.unit_price} / {product.unit} · {supplier}
      </Text>
      <View style={styles.qtyRow}>
        <Pressable style={styles.qtyBtn} onPress={() => onChangeQty(Math.max(1, quantity - 1))}>
          <Text style={styles.qtyBtnText}>−</Text>
        </Pressable>
        <Text style={styles.qtyValue}>{quantity}</Text>
        <Pressable style={styles.qtyBtn} onPress={() => onChangeQty(quantity + 1)}>
          <Text style={styles.qtyBtnText}>+</Text>
        </Pressable>
      </View>
      <Pressable
        style={[styles.orderBtn, ordering && styles.orderBtnDisabled]}
        onPress={onOrder}
        disabled={ordering}
      >
        {ordering ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.orderBtnText}>Order · CHF {lineTotal.toFixed(2)}</Text>
        )}
      </Pressable>
    </View>
  )
}

export function ResultsScreen({ navigation, route }: Props) {
  const { user, inputMethod, classification, products } = route.params
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [orderingId, setOrderingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function getQty(id: string) {
    return quantities[id] ?? 1
  }

  async function placeOrder(product: Product) {
    setOrderingId(product.id)
    setError(null)
    try {
      const { order, needs_approval } = await createOrder({
        requestor_id: user.id,
        product_id: product.id,
        quantity: getQty(product.id),
        input_method: inputMethod,
        ai_classification: classification
      })
      navigation.replace('OrderConfirm', {
        user,
        inputMethod,
        classification,
        product,
        quantity: getQty(product.id),
        order,
        needsApproval: needs_approval
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Order failed')
    } finally {
      setOrderingId(null)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.category}>{classification.category}</Text>
        <Text style={styles.reasoning}>{classification.reasoning}</Text>
        {classification.matched_product_name && (
          <Text style={styles.match}>Match: {classification.matched_product_name}</Text>
        )}
      </View>

      {products.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No products in this category yet.</Text>
          <Text style={styles.emptyHint}>Run supabase/seed.sql in your Supabase project.</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              quantity={getQty(item.id)}
              onChangeQty={(n) => setQuantities((q) => ({ ...q, [item.id]: n }))}
              onOrder={() => placeOrder(item)}
              ordering={orderingId === item.id}
            />
          )}
        />
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: 20, paddingBottom: 8 },
  category: { fontSize: 24, fontWeight: '800', color: colors.primary },
  reasoning: { fontSize: 15, color: colors.muted, marginTop: 6 },
  match: { fontSize: 15, color: colors.text, marginTop: 4 },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  productName: { fontSize: 22, fontWeight: '800', color: colors.text },
  meta: { fontSize: 16, color: colors.muted, marginTop: 6 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 16 },
  qtyBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  qtyBtnText: { fontSize: 28, fontWeight: '700', color: colors.text },
  qtyValue: { fontSize: 24, fontWeight: '800', color: colors.text, minWidth: 40, textAlign: 'center' },
  orderBtn: {
    marginTop: 16,
    backgroundColor: colors.success,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center'
  },
  orderBtnDisabled: { opacity: 0.6 },
  orderBtnText: { fontSize: 18, fontWeight: '800', color: '#000' },
  empty: { flex: 1, justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 18, color: colors.text, textAlign: 'center' },
  emptyHint: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 8 },
  error: { color: colors.danger, textAlign: 'center', padding: 12 }
})
