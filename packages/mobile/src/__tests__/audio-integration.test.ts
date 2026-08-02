import { describe, it, expect } from '@jest/globals'
import { chaptersToTracks } from '@/lib/audio'

describe('chaptersToTracks with real getBookChapters shape', () => {
  it('prefers full https audio url over bare filename', () => {
    const payload = {
      status: 'success',
      msg: 'Chapters loaded.',
      data: [
        {
          id: '30',
          book_id: '72',
          chapter_number: '1',
          chapter_title: '  The Game',
          audio_file: 'gameoflife01_scovelshinn_64kb.mp3',
          duration: '16:03',
          audio: 'https://loikmon.org/webapis/uploads/books/audios/gameoflife01_scovelshinn_64kb.mp3',
        },
        {
          id: '31',
          book_id: '72',
          chapter_number: '2',
          chapter_title: 'The Law of Prosperity',
          audio_file: 'gameoflife02_scovelshinn_64kb.mp3',
          duration: '13:48',
          audio: 'https://loikmon.org/webapis/uploads/books/audios/gameoflife02_scovelshinn_64kb.mp3',
        },
        {
          id: '32',
          chapter_title: 'No audio',
        },
      ],
    }

    const tracks = chaptersToTracks(payload, 'The Game of Life')

    expect(tracks).toHaveLength(2)
    expect(tracks[0].title).toContain('The Game of Life')
    expect(tracks[0].url).toBe('https://loikmon.org/webapis/uploads/books/audios/gameoflife01_scovelshinn_64kb.mp3')
    expect(tracks[1].url).toBe('https://loikmon.org/webapis/uploads/books/audios/gameoflife02_scovelshinn_64kb.mp3')
  })

  it('resolves a relative audio_file path to a full loikmon.org URL', () => {
    const payload = {
      data: [
        {
          id: '1',
          chapter_title: 'Intro',
          audio_file: '/webapis/uploads/books/audios/intro.mp3',
        },
      ],
    }

    const tracks = chaptersToTracks(payload)
    expect(tracks).toHaveLength(1)
    expect(tracks[0].url).toBe('https://loikmon.org/webapis/uploads/books/audios/intro.mp3')
  })
})
