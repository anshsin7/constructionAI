import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { showPricesForUser } from '../lib/roles'
import { colors } from '../lib/theme'
import type { RootStackParamList } from '../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'OrderConfirm'>

export function OrderConfirmScreen({ navigation, route }: Props) {
  const { user, product, quantity, order, needsApproval, queued, batchSendTime } = route.params
  const name = order.products?.name ?? product.name
  const poSent = order.status === 'po_sent' || order.status === 'confirmed'
  const priceBit =
    showPricesForUser(user) && order.total_price != null ? ` (CHF ${order.total_price})` : ''
  const batchHint = batchSendTime ? ` around ${batchSendTime}` : ''

  const statusText = queued
    ? 'QUEUED'
    : needsApproval
      ? 'AWAITING APPROVAL'
      : poSent
        ? 'PO SENT'
        : 'CONFIRMED'

  const statusColor = queued
    ? colors.primary
    : needsApproval
      ? colors.primary
      : colors.success

  const bodyText = queued
    ? `${quantity}× ${name}${priceBit} queued for batch send${batchHint}.`
    : needsApproval
      ? `${quantity}× ${name}${priceBit} pending approval.`
      : poSent
        ? `PO sent to supplier. Waiting for confirmation.`
        : `${quantity}× ${name}${priceBit} approved.`

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.statusBanner, { borderColor: statusColor }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
      </View>
      <Text style={styles.body}>{bodyText}</Text>
      <Pressable style={styles.button} onPress={() => navigation.popToTop()}>
        <Text style={styles.buttonText}>BACK TO HOME</Text>
      </Pressable>
      <Pressable style={styles.linkBtn} onPress={() => navigation.navigate('MyOrders', { user: route.params.user })}>
        <Text style={styles.linkText}>VIEW MY ORDERS</Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusBanner: {
    borderWidth: 4,
    paddingVertical: 20,
    paddingHorizontal: 32,
    marginBottom: 24
  },
  statusText: { fontSize: 32, fontWeight: '900', letterSpacing: 2 },
  body: { fontSize: 20, color: colors.text, textAlign: 'center', lineHeight: 30, fontWeight: '700' },
  button: {
    marginTop: 40,
    backgroundColor: colors.primary,
    paddingVertical: 22,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center'
  },
  buttonText: { fontSize: 22, fontWeight: '900', color: '#000', letterSpacing: 1 },
  linkBtn: { marginTop: 20, paddingVertical: 16 },
  linkText: { fontSize: 18, color: colors.muted, fontWeight: '900' }
})
