import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Audio, type AVPlaybackStatus } from 'expo-av'
import { type AudioTrack, toTrack } from '@/lib/audio'

export { toTrack, type AudioTrack }

interface AudioContextValue {
  current: AudioTrack | null
  isPlaying: boolean
  isLoading: boolean
  positionMillis: number
  durationMillis: number
  play: (track: AudioTrack) => Promise<void>
  toggle: () => Promise<void>
  seek: (millis: number) => Promise<void>
  stop: () => Promise<void>
}

const AudioContext = createContext<AudioContextValue | undefined>(undefined)

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const soundRef = useRef<Audio.Sound | null>(null)
  const [current, setCurrent] = useState<AudioTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [positionMillis, setPositionMillis] = useState(0)
  const [durationMillis, setDurationMillis] = useState(0)

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false }).catch(
      () => undefined,
    )
    return () => {
      soundRef.current?.unloadAsync().catch(() => undefined)
    }
  }, [])

  const onStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return
    setIsPlaying(status.isPlaying)
    setPositionMillis(status.positionMillis ?? 0)
    setDurationMillis(status.durationMillis ?? 0)
  }, [])

  const play = useCallback(
    async (track: AudioTrack) => {
      try {
        setIsLoading(true)
        if (soundRef.current) {
          await soundRef.current.unloadAsync()
          soundRef.current = null
        }
        const { sound } = await Audio.Sound.createAsync(
          { uri: track.url },
          { shouldPlay: true },
          onStatus,
        )
        soundRef.current = sound
        setCurrent(track)
      } finally {
        setIsLoading(false)
      }
    },
    [onStatus],
  )

  const toggle = useCallback(async () => {
    const sound = soundRef.current
    if (!sound) return
    const status = await sound.getStatusAsync()
    if (!status.isLoaded) return
    if (status.isPlaying) await sound.pauseAsync()
    else await sound.playAsync()
  }, [])

  const seek = useCallback(async (millis: number) => {
    await soundRef.current?.setPositionAsync(millis)
  }, [])

  const stop = useCallback(async () => {
    await soundRef.current?.unloadAsync()
    soundRef.current = null
    setCurrent(null)
    setIsPlaying(false)
    setPositionMillis(0)
    setDurationMillis(0)
  }, [])

  const value = useMemo<AudioContextValue>(
    () => ({
      current,
      isPlaying,
      isLoading,
      positionMillis,
      durationMillis,
      play,
      toggle,
      seek,
      stop,
    }),
    [current, isPlaying, isLoading, positionMillis, durationMillis, play, toggle, seek, stop],
  )

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext)
  if (!ctx) throw new Error('useAudio must be used within an AudioProvider')
  return ctx
}
