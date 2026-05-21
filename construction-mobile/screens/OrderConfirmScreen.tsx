import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../lib/theme'
import type { RootStackParamList } from '../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'OrderConfirm'>

export function OrderConfirmScreen({ navigation, route }: Props) {
  const { product, quantity, order, needsApproval } = route.params
  const name = order.products?.name ?? product.name
  const poSent = order.status === 'po_sent' || order.status === 'confirmed'

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.emoji}>{needsApproval ? '⏳' : poSent ? '📧' : '✅'}</Text>
      <Text style={styles.title}>
        {needsApproval ? 'Awaiting Approval' : poSent ? 'PO Sent' : 'Order Confirmed'}
      </Text>
      <Text style={styles.body}>
        {needsApproval
          ? `Your order for ${quantity}× ${name} (CHF ${order.total_price}) is pending Sara's approval.`
          : poSent
            ? `PO emailed to the supplier. Waiting for supplier confirmation.`
            : `Your order for ${quantity}× ${name} (CHF ${order.total_price}) was approved. PO is being generated.`}
      </Text>
      <Pressable style={styles.button} onPress={() => navigation.popToTop()}>
        <Text style={styles.buttonText}>Back to Home</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('MyOrders', { user: route.params.user })}>
        <Text style={styles.link}>View My Orders</Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center' },
  body: { fontSize: 18, color: colors.muted, textAlign: 'center', marginTop: 16, lineHeight: 26 },
  button: {
    marginTop: 32,
    backgroundColor: colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center'
  },
  buttonText: { fontSize: 18, fontWeight: '800', color: '#000' },
  link: { marginTop: 20, fontSize: 17, color: colors.primary, fontWeight: '600' }
})
