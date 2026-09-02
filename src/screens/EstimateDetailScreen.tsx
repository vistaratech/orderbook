import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import { Estimate, EstimateStatus, estimateTotal } from '../types/estimate';
import { getEstimate, deleteEstimate, setEstimateStatus } from '../storage/estimateStorage';
import { addDataListener } from '../storage/firebaseSync';
import { colors, fonts, radius, shadow } from '../theme/theme';
import { confirmAction } from '../utils/dialog';
import { formatCurrency, formatDate } from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';
import GlassBackButton from '../components/GlassBackButton';
import { getBusinessProfile, BusinessProfile } from '../storage/businessProfileStorage';
import { getInvoiceTemplateConfig } from '../storage/invoiceTemplateStorage';
import { generateEstimateHtml } from '../utils/invoiceGenerator';
import * as Print from 'expo-print';

type Props = NativeStackScreenProps<RootStackParamList, 'EstimateDetail'>;

const STATUS_COLORS: Record<EstimateStatus, string> = {
  Draft: colors.inkSoft,
  Sent: colors.duskDeep,
  Accepted: colors.success,
  Rejected: colors.danger,
  Expired: colors.pending,
};

export default function EstimateDetailScreen({ navigation, route }: Props) {
  const { estimateId } = route.params;
  const { t } = useLanguage();
  const [estimate, setEstimate] = useState<Estimate | null>(null);

  const loadData = useCallback(() => {
    getEstimate(estimateId).then((e) => {
      if (e) setEstimate(e);
    });
  }, [estimateId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    const unsub = addDataListener(() => loadData());
    return () => unsub();
  }, [loadData]);

  if (!estimate) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.content}>
          <View style={styles.topHeaderRow}>
            <GlassBackButton label={t('common.back', 'Back')} />
          </View>
          <Text style={styles.loading}>Loading estimate…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const total = estimateTotal(estimate);
  const statusColor = STATUS_COLORS[estimate.status] || colors.inkSoft;

  const handleStatusChange = async (newStatus: EstimateStatus) => {
    await setEstimateStatus(estimate.id, newStatus);
    loadData();
  };

  const handleConvertToOrder = () => {
    // Navigate to OrderForm with estimate data pre-filled
    navigation.navigate('OrderForm', {
      prefillCustomerName: estimate.customerName,
      prefillPhone: estimate.phoneNumber,
      fromEstimateId: estimate.id,
    });
  };

  const handleDelete = () => {
    confirmAction({
      title: 'Delete Estimate',
      message: `Remove estimate for ${estimate.customerName}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        await deleteEstimate(estimate.id);
        navigation.goBack();
      },
    });
  };

  const handleShare = async () => {
    const itemLines = estimate.items
      .filter((i) => i.name.trim())
      .map((item, idx) => `${idx + 1}. ${item.name} × ${item.qty} @ ${formatCurrency(item.price)} = ${formatCurrency(item.qty * item.price)}`)
      .join('\n');

    const text = `📋 ESTIMATE / QUOTATION
${estimate.estimateNumber}
Date: ${formatDate(estimate.estimateDate)}
${estimate.validUntil ? `Valid Until: ${formatDate(estimate.validUntil)}\n` : ''}
Customer: ${estimate.customerName}

Items:
${itemLines}

Total: ${formatCurrency(total)}
${estimate.customerNote ? `\nNote: ${estimate.customerNote}` : ''}`;

    await Share.share({ message: text, title: `Estimate ${estimate.estimateNumber}` });
  };

  const handlePrintPdf = async () => {
    if (!estimate) return;
    try {
      const [bp, cfg] = await Promise.all([
        getBusinessProfile(),
        getInvoiceTemplateConfig(),
      ]);
      const html = generateEstimateHtml(estimate, bp, cfg);

      if (Platform.OS === 'web') {
        if (typeof document !== 'undefined') {
          let iframe = document.getElementById('print-invoice-iframe') as HTMLIFrameElement | null;
          if (iframe) iframe.remove();
          iframe = document.createElement('iframe');
          iframe.id = 'print-invoice-iframe';
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = '0';
          iframe.style.visibility = 'hidden';
          document.body.appendChild(iframe);

          const doc = iframe.contentWindow?.document || iframe.contentDocument;
          if (doc) {
            doc.open();
            doc.write(html);
            doc.close();
            setTimeout(() => {
              iframe?.contentWindow?.focus();
              iframe?.contentWindow?.print();
            }, 300);
          }
        }
      } else {
        await Print.printAsync({ html });
      }
    } catch (err) {
      console.error('Error printing estimate:', err);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* ─── Static Top Header Bar ─── */}
      <View style={styles.headerWrapper}>
        <View style={styles.topHeaderRow}>
          <GlassBackButton label={t('common.back', 'Back')} />
          <View style={styles.topHeaderTitleWrap}>
            <Text style={styles.topHeaderTitle}>{t('estimates.estimateDetailsTitle', 'Estimate Details')}</Text>
            <Text style={styles.topHeaderSub}>{estimate.estimateNumber} • {estimate.customerName}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>

        {/* Header Card */}
        <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.estimateNum}>{estimate.estimateNumber}</Text>
            <Text style={styles.date}>{formatDate(estimate.estimateDate)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{estimate.status}</Text>
          </View>
        </View>

        <View style={styles.customerRow}>
          <Ionicons name="person-outline" size={16} color={colors.inkSoft} />
          <Text style={styles.customerName}>{estimate.customerName}</Text>
          {estimate.phoneNumber ? <Text style={styles.phone}>({estimate.phoneNumber})</Text> : null}
        </View>

        {estimate.validUntil && (
          <View style={styles.validRow}>
            <Ionicons name="time-outline" size={14} color={colors.pending} />
            <Text style={styles.validText}>Valid until: {formatDate(estimate.validUntil)}</Text>
          </View>
        )}
      </View>

      {/* Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {estimate.items.filter((i) => i.name.trim()).map((item, idx) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Text style={styles.itemName}>{idx + 1}. {item.name}</Text>
              <Text style={styles.itemMeta}>{item.qty} {item.unit || 'pcs'} × {formatCurrency(item.price)}</Text>
            </View>
            <Text style={styles.itemAmount}>{formatCurrency(item.qty * item.price)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Grand Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
        </View>
      </View>

      {estimate.customerNote ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.noteText}>{estimate.customerNote}</Text>
        </View>
      ) : null}

      {/* Status Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Update Status</Text>
        <View style={styles.statusRow}>
          {(['Draft', 'Sent', 'Accepted', 'Rejected'] as EstimateStatus[]).map((s) => (
            <Pressable
              key={s}
              style={[
                styles.statusBtn,
                estimate.status === s && { backgroundColor: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] },
              ]}
              onPress={() => handleStatusChange(s)}
            >
              <Text
                style={[
                  styles.statusBtnText,
                  estimate.status === s && { color: colors.white },
                ]}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.convertBtn, pressed && { opacity: 0.85 }]}
          onPress={handleConvertToOrder}
        >
          <Ionicons name="swap-horizontal-outline" size={18} color={colors.white} />
          <Text style={styles.actionBtnText}>Convert to Order</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.ink }, pressed && { opacity: 0.85 }]}
          onPress={handlePrintPdf}
        >
          <Ionicons name="print-outline" size={18} color={colors.white} />
          <Text style={styles.actionBtnText}>Print PDF</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.shareBtn, pressed && { opacity: 0.85 }]}
          onPress={handleShare}
        >
          <Ionicons name="share-social-outline" size={18} color={colors.white} />
          <Text style={styles.actionBtnText}>Share</Text>
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.editBtn, pressed && { opacity: 0.85 }]}
          onPress={() => navigation.navigate('EstimateForm', { estimateId: estimate.id })}
        >
          <Ionicons name="pencil-outline" size={18} color={colors.duskDeep} />
          <Text style={[styles.actionBtnText, { color: colors.duskDeep }]}>Edit</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.deleteBtn, pressed && { opacity: 0.85 }]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={[styles.actionBtnText, { color: colors.danger }]}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, paddingBottom: 80, width: '100%', maxWidth: 720, alignSelf: 'center' as any },
  headerWrapper: {
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: Platform.select({ web: 10, default: 8 }),
    zIndex: 10,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  topHeaderTitleWrap: {
    flex: 1,
  },
  topHeaderTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    lineHeight: 26,
  },
  topHeaderSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 1,
  },
  loading: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, textAlign: 'center', marginTop: 40 },
  headerCard: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 16,
    ...shadow.card,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  estimateNum: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.ink },
  date: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  statusBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  statusText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  customerName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  phone: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  validRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  validText: { fontFamily: fonts.body, fontSize: 12, color: colors.pending },
  section: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 16,
    ...shadow.card,
  },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.clayDeep, marginBottom: 12 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  itemLeft: { flex: 1 },
  itemName: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  itemMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  itemAmount: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: colors.clayDeep,
  },
  totalLabel: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  totalValue: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.clayDeep },
  noteText: { fontFamily: fonts.body, fontSize: 14, color: colors.ink, lineHeight: 20 },
  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.paper,
  },
  statusBtnText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius.md,
    ...shadow.card,
  },
  actionBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  convertBtn: { backgroundColor: colors.success },
  shareBtn: { backgroundColor: colors.duskDeep },
  editBtn: { backgroundColor: colors.paperCard, borderWidth: 1, borderColor: colors.duskDeep },
  deleteBtn: { backgroundColor: colors.paperCard, borderWidth: 1, borderColor: colors.danger },
});
