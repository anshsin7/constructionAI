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
import { UrgencyPickerModal } from '../components/UrgencyPickerModal'
import { createOrder } from '../lib/api'
import { showPricesForUser } from '../lib/roles'
import { colors } from '../lib/theme'
import type { Product } from '../lib/types'
import type { RootStackParamList } from '../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>

function ProductRow({
  product,
  quantity,
  onChangeQty,
  onOrder,
  ordering,
  showPrices
}: {
  product: Product
  quantity: number
  onChangeQty: (n: number) => void
  onOrder: () => void
  ordering: boolean
  showPrices: boolean
}) {
  const supplier = product.suppliers?.name ?? 'Supplier'
  const lineTotal =
    showPrices && product.unit_price != null
      ? Number(product.unit_price) * quantity
      : null

  return (
    <View style={styles.card}>
      <Text style={styles.productName}>{product.name}</Text>
      <Text style={styles.meta}>
        {showPrices && product.unit_price != null
          ? `CHF ${product.unit_price} / ${product.unit}`
          : product.unit}
        {' · '}{supplier}
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
          <Text style={styles.orderBtnText}>
            {lineTotal != null ? `ORDER · CHF ${lineTotal.toFixed(2)}` : 'ORDER'}
          </Text>
        )}
      </Pressable>
    </View>
  )
}

export function ResultsScreen({ navigation, route }: Props) {
  const { user, inputMethod, classification, products } = route.params
  const showPrices = showPricesForUser(user)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [orderingId, setOrderingId] = useState<string | null>(null)
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)

  function getQty(id: string) {
    return quantities[id] ?? 1
  }

  async function submitOrder(product: Product, isUrgent: boolean) {
    setOrderingId(product.id)
    setError(null)
    try {
      const result = await createOrder({
        requestor_id: user.id,
        product_id: product.id,
        quantity: getQty(product.id),
        input_method: inputMethod,
        ai_classification: classification,
        is_urgent: isUrgent
      })
      navigation.replace('OrderConfirm', {
        user,
        inputMethod,
        classification,
        product,
        quantity: getQty(product.id),
        order: result.order,
        needsApproval: result.needs_approval,
        queued: result.queued ?? false,
        batchSendTime: result.batch_send_time ?? null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Order failed')
      setPendingProduct(product)
    } finally {
      setOrderingId(null)
    }
  }

  const pendingQty = pendingProduct ? getQty(pendingProduct.id) : 0
  const pendingLineTotal =
    pendingProduct && showPrices && pendingProduct.unit_price != null
      ? `CHF ${(Number(pendingProduct.unit_price) * pendingQty).toFixed(2)}`
      : null

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.category}>{classification.category}</Text>
      </View>

      {products.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>NO PRODUCTS FOUND</Text>
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
              onOrder={() => setPendingProduct(item)}
              ordering={orderingId === item.id}
              showPrices={showPrices}
            />
          )}
        />
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      <UrgencyPickerModal
        visible={pendingProduct != null}
        productName={pendingProduct?.name ?? ''}
        quantity={pendingQty}
        lineTotalLabel={pendingLineTotal}
        loading={pendingProduct != null && orderingId === pendingProduct.id}
        onUrgent={() => pendingProduct && submitOrder(pendingProduct, true)}
        onBatch={() => pendingProduct && submitOrder(pendingProduct, false)}
        onCancel={() => !orderingId && setPendingProduct(null)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: 20, paddingBottom: 12 },
  category: { fontSize: 28, fontWeight: '900', color: colors.primary, letterSpacing: 1 },
  list: { padding: 16, gap: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.card,
    padding: 20,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: colors.border
  },
  productName: { fontSize: 24, fontWeight: '900', color: colors.text },
  meta: { fontSize: 18, color: colors.muted, marginTop: 8, fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 20 },
  qtyBtn: {
    width: 60,
    height: 60,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.text
  },
  qtyBtnText: { fontSize: 32, fontWeight: '900', color: colors.text },
  qtyValue: { fontSize: 28, fontWeight: '900', color: colors.text, minWidth: 50, textAlign: 'center' },
  orderBtn: {
    marginTop: 20,
    backgroundColor: colors.success,
    paddingVertical: 22,
    alignItems: 'center'
  },
  orderBtnDisabled: { opacity: 0.5 },
  orderBtnText: { fontSize: 20, fontWeight: '900', color: '#000', letterSpacing: 1 },
  empty: { flex: 1, justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 22, color: colors.text, textAlign: 'center', fontWeight: '900' },
  error: { color: colors.danger, textAlign: 'center', padding: 16, fontSize: 18, fontWeight: '700' }
})
