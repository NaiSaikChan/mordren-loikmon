import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.label }]}>Page not found</Text>
        <Link href="/" style={[styles.link, { color: colors.accent }]}>
          Go to Home
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  link: { fontSize: 16, textDecorationLine: 'underline' },
});
