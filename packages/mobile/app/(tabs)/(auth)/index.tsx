import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import { useAuth } from '@/hooks/use-auth';
import { colors } from '@/theme/colors';

export default function AccountScreen() {
  const { user, loading, error, login, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      await login(email, password);
    } catch {
      // error is surfaced via store's error field
    }
  };

  const avatarUri =
    user?.thumbnail
      ? `https://loikmon.org/webapis/uploads/thumbnails/${user.thumbnail}`
      : user?.avatar ?? null;

  // ─── Logged-in view ───────────────────────────────────────────────────────
  if (user) {
    return (
      <>
        <Stack.Screen options={{ title: 'Account' }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: colors.groupedBackground }}
          contentContainerStyle={styles.profileContainer}
        >
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>
                  {(user.firstname?.[0] ?? user.name?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Name */}
          <Text style={[styles.profileName, { color: colors.label }]}>
            {user.firstname && user.lastname
              ? `${user.firstname} ${user.lastname}`
              : user.name}
          </Text>

          {/* Email */}
          <Text style={[styles.profileEmail, { color: colors.secondaryLabel }]}>
            {user.email}
          </Text>

          {/* Info cards */}
          <View style={[styles.card, { backgroundColor: colors.background }]}>
            <View style={styles.cardRow}>
              <Text style={[styles.cardLabel, { color: colors.secondaryLabel }]}>
                Coin Balance
              </Text>
              <Text style={[styles.cardValue, { color: colors.label }]}>
                🪙 {user.coins ?? 0}
              </Text>
            </View>
            <View style={[styles.cardDivider, { backgroundColor: colors.separator }]} />
            <View style={styles.cardRow}>
              <Text style={[styles.cardLabel, { color: colors.secondaryLabel }]}>
                Devices
              </Text>
              <Text style={[styles.cardValue, { color: colors.label }]}>
                {user.devices_in_use ?? 0} / {user.device_limit ?? '—'}
              </Text>
            </View>
          </View>

          {/* Logout */}
          <Pressable
            style={({ pressed }) => [
              styles.logoutButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => logout()}
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </ScrollView>
      </>
    );
  }

  // ─── Login form ───────────────────────────────────────────────────────────
  return (
    <>
      <Stack.Screen options={{ title: 'Account' }} />
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: colors.groupedBackground }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.formContainer}
        >
          <Text style={[styles.formTitle, { color: colors.label }]}>
            Sign In
          </Text>
          <Text style={[styles.formSubtitle, { color: colors.secondaryLabel }]}>
            Sign in to access your library and purchases.
          </Text>

          {/* Input group */}
          <View style={[styles.inputGroup, { backgroundColor: colors.background }]}>
            <TextInput
              style={[styles.textInput, { color: colors.label }]}
              placeholder="Email"
              placeholderTextColor={colors.secondaryLabel as string}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              textContentType="emailAddress"
              returnKeyType="next"
            />
            <View style={[styles.inputDivider, { backgroundColor: colors.separator }]} />
            <TextInput
              style={[styles.textInput, { color: colors.label }]}
              placeholder="Password"
              placeholderTextColor={colors.secondaryLabel as string}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>

          {/* Error */}
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          {/* Login button */}
          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              { backgroundColor: colors.brand, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // ── Profile ──
  profileContainer: {
    paddingBottom: 48,
    paddingTop: 24,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  avatarWrapper: {
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  profileEmail: {
    fontSize: 14,
    marginTop: 4,
    marginBottom: 24,
  },
  card: {
    width: '100%',
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardLabel: { fontSize: 15 },
  cardValue: { fontSize: 15, fontWeight: '600' },
  cardDivider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  logoutButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Login form ──
  formContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 48,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    marginBottom: 28,
    lineHeight: 20,
  },
  inputGroup: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  inputDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 12,
    marginLeft: 4,
  },
  loginButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
