import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '../lib/theme'

type Props = {
  visible: boolean
  productName: string
  quantity: number
  lineTotalLabel?: string | null
  loading?: boolean
  onUrgent: () => void
  onBatch: () => void
  onCancel: () => void
}

export function UrgencyPickerModal({
  visible,
  productName,
  quantity,
  lineTotalLabel,
  loading,
  onUrgent,
  onBatch,
  onCancel
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={loading ? undefined : onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>HOW URGENT?</Text>
          <Text style={styles.product}>
            {quantity}× {productName}
            {lineTotalLabel ? ` · ${lineTotalLabel}` : ''}
          </Text>

          <Pressable
            style={[styles.bigBtn, styles.urgentBtn, loading && styles.btnDisabled]}
            onPress={onUrgent}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" size="large" />
            ) : (
              <Text style={styles.bigBtnTitle}>URGENT</Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.bigBtn, styles.batchBtn, loading && styles.btnDisabled]}
            onPress={onBatch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" size="large" />
            ) : (
              <Text style={styles.bigBtnTitle}>NOT URGENT</Text>
            )}
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
            <Text style={styles.cancelText}>CANCEL</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 32
  },
  sheet: {
    backgroundColor: colors.card,
    padding: 24,
    borderWidth: 3,
    borderColor: colors.border
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 1
  },
  product: {
    fontSize: 20,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '900'
  },
  bigBtn: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  urgentBtn: {
    backgroundColor: colors.primary
  },
  batchBtn: {
    backgroundColor: colors.success
  },
  btnDisabled: { opacity: 0.5 },
  bigBtnTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1
  },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.muted
  },
  cancelText: {
    fontSize: 20,
    color: colors.muted,
    fontWeight: '900'
  }
})
