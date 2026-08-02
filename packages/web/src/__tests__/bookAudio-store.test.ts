import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBookAudioStore } from '@/stores/bookAudio'
import { setClient } from '@loikmon/api'
import axios from 'axios'

describe('useBookAudioStore', () => {
  let instance: ReturnType<typeof axios.create>

  beforeEach(() => {
    setActivePinia(createPinia())
    instance = axios.create()
    setClient(instance)
  })

  afterEach(() => {
    setClient(null)
    vi.restoreAllMocks()
  })

  it('exposes audio tracks from fetched chapters', async () => {
    const store = useBookAudioStore()
    vi.spyOn(instance, 'post').mockResolvedValue({
      data: {
        data: [
          { id: 'c1', title: 'Chapter 1', audio: '/c1.mp3' },
          { id: 'c2', chapter_title: 'Chapter 2', audio_file: '/c2.mp3' },
          { id: 'c3', title: 'No audio' },
        ],
      },
    })

    await store.fetchChapters('42', 'Book')

    expect(store.tracks).toHaveLength(2)
    expect(store.tracks[0].title).toBe('Book – Chapter 1')
    expect(store.tracks[0].url).toBe('https://loikmon.org/c1.mp3')
    expect(store.tracks[1].title).toBe('Book – Chapter 2')
  })

  it('unwraps chapters from data.chapters wrapper', async () => {
    const store = useBookAudioStore()
    vi.spyOn(instance, 'post').mockResolvedValue({
      data: {
        data: {
          chapters: [{ id: 'c1', title: 'A', stream_url: '/a.mp3' }],
        },
      },
    })

    await store.fetchChapters('7')
    expect(store.tracks).toHaveLength(1)
    expect(store.tracks[0].url).toBe('https://loikmon.org/a.mp3')
  })

  it('clears tracks on error', async () => {
    const store = useBookAudioStore()
    vi.spyOn(instance, 'post').mockRejectedValue(new Error('network'))

    await store.fetchChapters('1')
    expect(store.tracks).toHaveLength(0)
    expect(store.error).toBe('network')
  })
})
