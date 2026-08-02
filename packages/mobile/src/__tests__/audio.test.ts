import { toTrack, toChapterTrack, chaptersToTracks } from '@/lib/audio'

describe('toTrack', () => {
  it('builds a track from audio_url and normalises the URL', () => {
    const track = toTrack({ id: 5, title: 'Song', audio_url: '/media/a.mp3', artist: 'X' })
    expect(track).not.toBeNull()
    expect(track?.url).toBe('https://loikmon.org/media/a.mp3')
    expect(track?.title).toBe('Song')
    expect(track?.artist).toBe('X')
  })

  it('falls back to authorname/author for the artist', () => {
    expect(toTrack({ id: 1, title: 'T', file: 'x.mp3', authorname: 'Nai' })?.artist).toBe('Nai')
  })

  it('returns null when there is no audio source', () => {
    expect(toTrack({ id: 1, title: 'T' })).toBeNull()
  })

  it('falls back to audio_file and stream_url fields', () => {
    const track = toTrack({ id: 1, title: 'T', audio_file: '/media/b.mp3' })
    expect(track?.url).toBe('https://loikmon.org/media/b.mp3')
  })
})

describe('toChapterTrack', () => {
  it('builds a track from an audio chapter', () => {
    const track = toChapterTrack(
      { id: 'c1', title: 'Chapter 1', audio: '/media/c1.mp3' },
      'My Book',
    )
    expect(track?.url).toBe('https://loikmon.org/media/c1.mp3')
    expect(track?.title).toBe('My Book – Chapter 1')
  })

  it('uses chapter_title when title is missing', () => {
    const track = toChapterTrack({ id: 'c2', chapter_title: 'Intro', stream_url: '/media/c2.mp3' })
    expect(track?.title).toBe('Intro')
  })

  it('returns null when no audio URL is present', () => {
    expect(toChapterTrack({ id: 'c3', title: 'Silent' })).toBeNull()
  })
})

describe('chaptersToTracks', () => {
  it('extracts tracks from a top-level array', () => {
    const tracks = chaptersToTracks([
      { id: 1, title: 'A', audio: '/a.mp3' },
      { id: 2, title: 'B', audio_file: '/b.mp3' },
    ])
    expect(tracks).toHaveLength(2)
    expect(tracks[0].url).toBe('https://loikmon.org/a.mp3')
  })

  it('unwraps chapters from data wrapper', () => {
    const tracks = chaptersToTracks({ data: [{ id: 1, title: 'A', audio: '/a.mp3' }] })
    expect(tracks).toHaveLength(1)
  })

  it('skips chapters without audio URLs', () => {
    const tracks = chaptersToTracks([{ id: 1, title: 'A' }, { id: 2, audio: '/a.mp3' }])
    expect(tracks).toHaveLength(1)
  })
})
