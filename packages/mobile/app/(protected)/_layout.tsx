import { Redirect, Slot } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { ActivityIndicator, View } from 'react-native'

export default function ProtectedLayout() {
  const { isLoggedIn, loading } = useAuth()

  if (loading) {
    return (
      <View className='flex-1 items-center justify-center bg-slate-900'>
        <ActivityIndicator size='large' />
      </View>
    )
  }

  if (!isLoggedIn) {
    return <Redirect href='/(auth)/login' />
  }

  return <Slot />
}
