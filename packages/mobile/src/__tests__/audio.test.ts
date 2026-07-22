import { toTrack } from '@/lib/audio'

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
})
