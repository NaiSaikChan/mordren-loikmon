import { Stack } from 'expo-router/stack';
import { colors } from '@/theme/colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerBlurEffect: 'regular',
        headerBackButtonDisplayMode: 'minimal',
        headerTitleStyle: { color: colors.label as string },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Account' }} />
    </Stack>
  );
}
