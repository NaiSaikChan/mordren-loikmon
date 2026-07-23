import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
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
  const player = useAudioPlayer(null, { updateInterval: 250 })
  const status = useAudioPlayerStatus(player)
  const currentTrackRef = useRef<AudioTrack | null>(null)
  const [current, setCurrent] = useState<AudioTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [positionMillis, setPositionMillis] = useState(0)
  const [durationMillis, setDurationMillis] = useState(0)

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!currentTrackRef.current) return
    setIsPlaying(status.playing)
    setPositionMillis(Math.max(0, Math.floor(status.currentTime * 1000)))
    setDurationMillis(Math.max(0, Math.floor(status.duration * 1000)))
    setIsLoading(!status.isLoaded || status.isBuffering)
  }, [status])

  const play = useCallback(async (track: AudioTrack) => {
    currentTrackRef.current = track
    setCurrent(track)
    setIsLoading(true)
    player.replace(track.url)
    player.play()
  }, [player])

  const toggle = useCallback(async () => {
    if (!currentTrackRef.current) return
    if (player.playing) player.pause()
    else player.play()
  }, [player])

  const seek = useCallback(async (millis: number) => {
    if (!currentTrackRef.current) return
    await player.seekTo(Math.max(0, millis / 1000))
  }, [player])

  const stop = useCallback(async () => {
    player.pause()
    player.replace(null)
    currentTrackRef.current = null
    setCurrent(null)
    setIsPlaying(false)
    setIsLoading(false)
    setPositionMillis(0)
    setDurationMillis(0)
  }, [player])

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
