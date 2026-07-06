import { Stack } from 'expo-router/stack';
import { colors } from '@/theme/colors';

export default function HomeLayout() {
  return (
    <Stack screenOptions={{
      headerLargeTitle: true,
      headerTransparent: true,
      headerBlurEffect: 'regular',
      headerBackButtonDisplayMode: 'minimal',
      headerTitleStyle: { color: colors.label as string },
    }}>
      <Stack.Screen name="index" options={{ title: 'Loikmon' }} />
      <Stack.Screen name="book/[id]" options={{ title: '', headerLargeTitle: false }} />
      <Stack.Screen name="article/[id]" options={{ title: '', headerLargeTitle: false }} />
    </Stack>
  );
}
