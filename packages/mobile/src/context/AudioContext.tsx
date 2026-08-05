import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { type AudioTrack, toTrack } from '@/lib/audio'

export { toTrack, type AudioTrack }

interface AudioContextValue {
  current: AudioTrack | null
  queue: AudioTrack[]
  currentIndex: number
  isPlaying: boolean
  isLoading: boolean
  positionMillis: number
  durationMillis: number
  play: (track: AudioTrack, queue?: AudioTrack[]) => Promise<void>
  toggle: () => Promise<void>
  seek: (millis: number) => Promise<void>
  stop: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
}

const AudioContext = createContext<AudioContextValue | undefined>(undefined)

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 250 })
  const status = useAudioPlayerStatus(player)
  const currentTrackRef = useRef<AudioTrack | null>(null)
  const queueRef = useRef<AudioTrack[]>([])
  const indexRef = useRef<number>(-1)
  const [current, setCurrent] = useState<AudioTrack | null>(null)
  const [queue, setQueue] = useState<AudioTrack[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
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

  const syncMeta = useCallback(() => {
    const track = currentTrackRef.current
    setCurrent(track)
    setQueue(queueRef.current)
    setCurrentIndex(indexRef.current)
    setIsPlaying(false)
    setPositionMillis(0)
    setDurationMillis(0)
    setIsLoading(!!track)
  }, [])

  const playAtIndex = useCallback(
    async (index: number) => {
      const track = queueRef.current[index]
      if (!track) return
      indexRef.current = index
      currentTrackRef.current = track
      syncMeta()
      setIsLoading(true)
      try {
        await player.replace(track.url)
        player.play()
      } catch {
        setIsLoading(false)
      }
    },
    [player, syncMeta],
  )

  const play = useCallback(
    async (track: AudioTrack, autoQueue?: AudioTrack[]) => {
      queueRef.current = autoQueue ?? []
      const idx = queueRef.current.findIndex((t) => t.url === track.url)
      indexRef.current = idx >= 0 ? idx : 0
      if (idx < 0) {
        // Track is not in queue; make it the sole item
        queueRef.current = [track]
        indexRef.current = 0
      }
      currentTrackRef.current = track
      syncMeta()
      setIsLoading(true)
      try {
        await player.replace(track.url)
        player.play()
      } catch {
        setIsLoading(false)
      }
    },
    [player, syncMeta],
  )

  const toggle = useCallback(async () => {
    if (!currentTrackRef.current) return
    if (player.playing) player.pause()
    else player.play()
  }, [player])

  const seek = useCallback(
    async (millis: number) => {
      if (!currentTrackRef.current) return
      await player.seekTo(Math.max(0, millis / 1000))
    },
    [player],
  )

  const stop = useCallback(async () => {
    try {
      player.pause()
      player.replace(null)
    } catch {
      // Even if the native player errors, still clear app-level playback state.
    }
    currentTrackRef.current = null
    queueRef.current = []
    indexRef.current = -1
    setCurrent(null)
    setQueue([])
    setCurrentIndex(0)
    setIsPlaying(false)
    setIsLoading(false)
    setPositionMillis(0)
    setDurationMillis(0)
  }, [player])

  const next = useCallback(async () => {
    if (queueRef.current.length === 0) return
    const nextIndex = indexRef.current + 1
    if (nextIndex < queueRef.current.length) {
      await playAtIndex(nextIndex)
    }
  }, [playAtIndex])

  const previous = useCallback(async () => {
    if (queueRef.current.length === 0) return
    const prevIndex = indexRef.current - 1
    if (prevIndex >= 0) {
      await playAtIndex(prevIndex)
    }
  }, [playAtIndex])

  // Auto-advance to next track when the current one finishes.
  useEffect(() => {
    if (
      status.playing === false &&
      status.currentTime > 0 &&
      status.duration > 0 &&
      status.currentTime + 0.25 >= status.duration
    ) {
      void next()
    }
  }, [status, next])

  const value = useMemo<AudioContextValue>(
    () => ({
      current,
      queue,
      currentIndex,
      isPlaying,
      isLoading,
      positionMillis,
      durationMillis,
      play,
      toggle,
      seek,
      stop,
      next,
      previous,
    }),
    [current, queue, currentIndex, isPlaying, isLoading, positionMillis, durationMillis, play, toggle, seek, stop, next, previous],
  )

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext)
  if (!ctx) throw new Error('useAudio must be used within an AudioProvider')
  return ctx
}
