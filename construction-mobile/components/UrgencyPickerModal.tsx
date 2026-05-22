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
          <Text style={styles.title}>How urgent is this?</Text>
          <Text style={styles.product}>
            {quantity}× {productName}
            {lineTotalLabel ? ` · ${lineTotalLabel}` : ''}
          </Text>
          <Text style={styles.hint}>
            Choose whether this goes out immediately or waits for sourcing’s daily batch.
          </Text>

          <Pressable
            style={[styles.bigBtn, styles.urgentBtn, loading && styles.btnDisabled]}
            onPress={onUrgent}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={styles.bigBtnTitle}>Urgent</Text>
                <Text style={styles.bigBtnSub}>Approval or straight to supplier</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={[styles.bigBtn, styles.batchBtn, loading && styles.btnDisabled]}
            onPress={onBatch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={[styles.bigBtnTitle, styles.batchBtnTitle]}>Not urgent</Text>
                <Text style={[styles.bigBtnSub, styles.batchBtnSub]}>Queued for daily batch send</Text>
              </>
            )}
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
    padding: 20,
    paddingBottom: 36
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center'
  },
  product: {
    fontSize: 17,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '700'
  },
  hint: {
    fontSize: 15,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 22
  },
  bigBtn: {
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginBottom: 12,
    alignItems: 'center',
    minHeight: 88,
    justifyContent: 'center'
  },
  urgentBtn: {
    backgroundColor: colors.primary
  },
  batchBtn: {
    backgroundColor: colors.success
  },
  btnDisabled: { opacity: 0.7 },
  bigBtnTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000'
  },
  bigBtnSub: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.65)',
    marginTop: 4,
    fontWeight: '600'
  },
  batchBtnTitle: { color: '#000' },
  batchBtnSub: { color: 'rgba(0,0,0,0.65)' },
  cancelBtn: {
    marginTop: 4,
    paddingVertical: 14,
    alignItems: 'center'
  },
  cancelText: {
    fontSize: 17,
    color: colors.muted,
    fontWeight: '600'
  }
})
