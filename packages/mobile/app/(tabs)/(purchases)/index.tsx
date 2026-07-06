// requires: npx expo install expo-document-picker
import { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '@/hooks/use-auth';
import { apiGet, apiPost } from '@/constants/api';
import { colors } from '@/theme/colors';
import type { CoinPackage } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LibraryItem {
  id: number | string;
  name?: string;
  title?: string;
  thumbnail?: string;
  type?: string;
}

// ─── Multipart proof-of-payment POST (manual — apiPost uses text/plain) ───────

async function submitProof(
  user: { email: string },
  pkg: CoinPackage,
  fileUri: string,
  fileName: string,
): Promise<{ status: string; message?: string }> {
  const formData = new FormData();
  formData.append('email', user.email);
  formData.append('packageid', String(pkg.id));
  formData.append('package', pkg.name);
  formData.append('amount', String(pkg.amount));
  formData.append('file', { uri: fileUri, name: fileName, type: 'image/jpeg' } as any);

  const res = await fetch('https://loikmon.org/webapis/proofofpayment', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LibraryCard({ item }: { item: LibraryItem }) {
  const thumbUri = item.thumbnail
    ? `https://loikmon.org/webapis/uploads/thumbnails/${item.thumbnail}`
    : null;
  return (
    <View style={[styles.libraryCard, { backgroundColor: colors.background }]}>
      {thumbUri ? (
        <Image source={{ uri: thumbUri }} style={styles.libraryThumb} contentFit="cover" />
      ) : (
        <View style={[styles.libraryThumb, styles.libraryThumbFallback]}>
          <Text style={{ fontSize: 22 }}>📖</Text>
        </View>
      )}
      <Text style={[styles.libraryItemName, { color: colors.label }]} numberOfLines={2}>
        {item.title ?? item.name ?? 'Untitled'}
      </Text>
    </View>
  );
}

function CoinCard({ pkg, onPress }: { pkg: CoinPackage; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.coinCard,
        { backgroundColor: colors.background, opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={styles.coinCardLeft}>
        <Text style={[styles.coinName, { color: colors.label }]}>{pkg.name}</Text>
        <Text style={[styles.coinAmount, { color: colors.brand }]}>
          🪙 {pkg.amount.toLocaleString()} coins
        </Text>
      </View>
      <View style={[styles.coinPriceBadge, { backgroundColor: colors.brandLight }]}>
        <Text style={[styles.coinPrice, { color: colors.brand }]}>
          {pkg.value.toLocaleString()} MMK
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

interface PaymentModalProps {
  visible: boolean;
  pkg: CoinPackage | null;
  userEmail: string;
  onClose: () => void;
}

function PaymentModal({ visible, pkg, userEmail, onClose }: PaymentModalProps) {
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Reset state when a new package is selected
  useEffect(() => {
    if (visible) {
      setPickedFile(null);
      setSubmitting(false);
      setSubmitted(false);
    }
  }, [visible, pkg?.id]);

  const pickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setPickedFile({ uri: asset.uri, name: asset.name ?? 'proof.jpg' });
      }
    } catch {
      Alert.alert('Error', 'Could not pick file. Please try again.');
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!pkg || !pickedFile) return;
    setSubmitting(true);
    try {
      const res = await submitProof(
        { email: userEmail },
        pkg,
        pickedFile.uri,
        pickedFile.name,
      );
      if (res.status === 'ok' || res.status === 'success') {
        setSubmitted(true);
      } else {
        Alert.alert('Submission Failed', res.message ?? 'Please try again.');
      }
    } catch (e) {
      Alert.alert('Network Error', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [pkg, pickedFile, userEmail]);

  if (!pkg) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.groupedBackground }]}>
        {/* Handle bar */}
        <View style={[styles.modalHandle, { backgroundColor: colors.separator }]} />

        <ScrollView
          contentContainerStyle={styles.modalContent}
          keyboardShouldPersistTaps="handled"
        >
          {submitted ? (
            // ── Success state ──
            <View style={styles.successContainer}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={[styles.successTitle, { color: colors.label }]}>
                Proof Submitted!
              </Text>
              <Text style={[styles.successBody, { color: colors.secondaryLabel }]}>
                Your payment proof has been received. Your coins will be credited after verification.
              </Text>
              <Pressable
                style={[styles.primaryButton, { backgroundColor: colors.brand }]}
                onPress={onClose}
              >
                <Text style={styles.primaryButtonText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Title */}
              <Text style={[styles.modalTitle, { color: colors.label }]}>
                Buy {pkg.name}
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.secondaryLabel }]}>
                🪙 {pkg.amount.toLocaleString()} coins · {pkg.value.toLocaleString()} MMK
              </Text>

              {/* Payment instructions */}
              <View style={[styles.instructionsCard, { backgroundColor: colors.background }]}>
                <Text style={[styles.instructionsTitle, { color: colors.label }]}>
                  Payment Instructions
                </Text>
                <Text style={[styles.instructionsBody, { color: colors.secondaryLabel }]}>
                  Transfer to KBZ Bank{'\n'}
                  Account Number: 123456{'\n\n'}
                  Amount: {pkg.value.toLocaleString()} MMK{'\n\n'}
                  After transfer, take a screenshot or photo of the receipt and upload it below.
                </Text>
              </View>

              {/* File picker */}
              <Text style={[styles.sectionLabel, { color: colors.secondaryLabel }]}>
                UPLOAD PROOF
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.uploadButton,
                  {
                    backgroundColor: colors.background,
                    borderColor: pickedFile ? colors.brand : colors.separator,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={pickFile}
              >
                <Text style={{ fontSize: 24 }}>{pickedFile ? '📎' : '📁'}</Text>
                <Text
                  style={[
                    styles.uploadButtonText,
                    { color: pickedFile ? colors.brand : colors.secondaryLabel },
                  ]}
                  numberOfLines={1}
                >
                  {pickedFile ? pickedFile.name : 'Choose file (image or PDF)'}
                </Text>
              </Pressable>

              {/* Submit */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: pickedFile ? colors.brand : colors.separator,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={handleSubmit}
                disabled={!pickedFile || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Submit Proof</Text>
                )}
              </Pressable>

              {/* Cancel */}
              <Pressable style={styles.cancelButton} onPress={onClose}>
                <Text style={[styles.cancelButtonText, { color: colors.secondaryLabel }]}>
                  Cancel
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PurchasesScreen() {
  const { user } = useAuth();

  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const [coins, setCoins] = useState<CoinPackage[]>([]);
  const [coinsLoading, setCoinsLoading] = useState(false);
  const [coinsError, setCoinsError] = useState<string | null>(null);

  const [selectedPkg, setSelectedPkg] = useState<CoinPackage | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Fetch library when user is logged in
  useEffect(() => {
    if (!user) {
      setLibrary([]);
      return;
    }
    setLibraryLoading(true);
    setLibraryError(null);
    apiPost<{ status: string; items?: LibraryItem[]; body?: { items?: LibraryItem[] } }>(
      'getlibrary',
      {},
    )
      .then((res) => {
        const items = res.items ?? res.body?.items ?? [];
        setLibrary(items);
      })
      .catch((e) => setLibraryError((e as Error).message))
      .finally(() => setLibraryLoading(false));
  }, [user]);

  // Fetch coin packages on mount
  useEffect(() => {
    setCoinsLoading(true);
    setCoinsError(null);
    apiGet<{ coins: CoinPackage[] }>('fetchcoins')
      .then((res) => setCoins(res.coins ?? []))
      .catch((e) => setCoinsError((e as Error).message))
      .finally(() => setCoinsLoading(false));
  }, []);

  const openPayment = useCallback((pkg: CoinPackage) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to purchase coins.');
      return;
    }
    setSelectedPkg(pkg);
    setModalVisible(true);
  }, [user]);

  return (
    <>
      <Stack.Screen options={{ title: 'Purchases' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.groupedBackground }}
        contentContainerStyle={styles.screenContainer}
      >
        {/* ── My Library ── */}
        <Text style={[styles.sectionTitle, { color: colors.label }]}>📚 My Library</Text>

        {!user ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.emptyText, { color: colors.secondaryLabel }]}>
              Sign in to view your library.
            </Text>
          </View>
        ) : libraryLoading ? (
          <ActivityIndicator color={colors.brand} style={{ marginVertical: 20 }} />
        ) : libraryError ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.emptyText, { color: colors.error }]}>{libraryError}</Text>
          </View>
        ) : library.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.emptyText, { color: colors.secondaryLabel }]}>
              Your library is empty. Purchase items to see them here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={library}
            keyExtractor={(item) => String(item.id)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.libraryRow}
            renderItem={({ item }) => <LibraryCard item={item} />}
            scrollEnabled
          />
        )}

        {/* ── Buy Coins ── */}
        <Text style={[styles.sectionTitle, { color: colors.label }]}>🪙 Buy Coins</Text>

        {coinsLoading ? (
          <ActivityIndicator color={colors.brand} style={{ marginVertical: 20 }} />
        ) : coinsError ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.emptyText, { color: colors.error }]}>{coinsError}</Text>
          </View>
        ) : coins.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.emptyText, { color: colors.secondaryLabel }]}>
              No coin packages available.
            </Text>
          </View>
        ) : (
          <FlatList
            data={coins}
            keyExtractor={(item) => String(item.id)}
            scrollEnabled={false}
            contentContainerStyle={styles.coinList}
            renderItem={({ item }) => (
              <CoinCard pkg={item} onPress={() => openPayment(item)} />
            )}
            ItemSeparatorComponent={() => (
              <View style={[styles.coinSeparator, { backgroundColor: colors.separator }]} />
            )}
            style={[styles.coinFlatList, { backgroundColor: colors.background }]}
          />
        )}
      </ScrollView>

      {/* Payment sheet */}
      <PaymentModal
        visible={modalVisible}
        pkg={selectedPkg}
        userEmail={user?.email ?? ''}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screenContainer: {
    paddingBottom: 48,
    paddingTop: 8,
  },

  // ── Sections ──
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 16,
  },

  // ── Library ──
  libraryRow: {
    paddingHorizontal: 12,
    gap: 12,
  },
  libraryCard: {
    width: 110,
    borderRadius: 10,
    overflow: 'hidden',
    padding: 8,
  },
  libraryThumb: {
    width: 94,
    height: 130,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  libraryThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryItemName: {
    fontSize: 11,
    marginTop: 6,
    lineHeight: 15,
  },

  // ── Coin list ──
  coinFlatList: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  coinList: {},
  coinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  coinCardLeft: { flex: 1 },
  coinName: { fontSize: 15, fontWeight: '600' },
  coinAmount: { fontSize: 13, marginTop: 2 },
  coinPriceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 12,
  },
  coinPrice: { fontSize: 13, fontWeight: '700' },
  coinSeparator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },

  // ── Empty / error ──
  emptyCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // ── Modal ──
  modalContainer: { flex: 1, paddingTop: 8 },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    paddingTop: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  instructionsCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  instructionsBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  uploadButtonText: { fontSize: 14, flex: 1 },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 15 },

  // ── Success ──
  successContainer: { alignItems: 'center', paddingTop: 48 },
  successIcon: { fontSize: 56, marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  successBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
});
