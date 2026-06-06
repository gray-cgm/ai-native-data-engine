import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureVideoFrame, captureVideoFrames } from './video-frame'

type FakeVideo = {
  crossOrigin: string
  muted: boolean
  preload: string
  videoWidth: number
  videoHeight: number
  duration: number
  currentTime: number
  src: string
  onerror: (() => void) | null
  onloadeddata: (() => void) | null
  onseeked: (() => void) | null
  removeAttribute: ReturnType<typeof vi.fn>
  load: ReturnType<typeof vi.fn>
}

function makeFakeVideo(opts: Partial<FakeVideo> = {}): FakeVideo {
  return {
    crossOrigin: '',
    muted: false,
    preload: '',
    videoWidth: opts.videoWidth ?? 320,
    videoHeight: opts.videoHeight ?? 240,
    duration: opts.duration ?? 0,
    currentTime: 0,
    src: '',
    onerror: null,
    onloadeddata: null,
    onseeked: null,
    removeAttribute: vi.fn(),
    load: vi.fn(),
  }
}

function makeFakeCanvas() {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage: vi.fn() })),
    toDataURL: vi.fn(() => 'data:image/png;base64,xxx'),
  }
}

function stubCreateElement(video: FakeVideo, canvas = makeFakeCanvas()) {
  return vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'video') return video as unknown as HTMLElement
    if (tag === 'canvas') return canvas as unknown as HTMLElement
    return {} as HTMLElement
  })
}

afterEach(() => vi.restoreAllMocks())

describe('captureVideoFrame', () => {
  it('grabs the first frame when duration is zero', async () => {
    const video = makeFakeVideo({ duration: 0 })
    stubCreateElement(video)
    const promise = captureVideoFrame('http://clip.mp4')
    // drive the lifecycle
    video.onloadeddata?.()
    await expect(promise).resolves.toMatch(/^data:image\/png/)
    expect(video.crossOrigin).toBe('anonymous')
  })

  it('seeks to ratio then grabs on seeked', async () => {
    const video = makeFakeVideo({ duration: 10 })
    stubCreateElement(video)
    const promise = captureVideoFrame('http://clip.mp4', 0.5)
    video.onloadeddata?.()
    expect(video.currentTime).toBe(5)
    video.onseeked?.()
    await expect(promise).resolves.toMatch(/^data:image/)
  })

  it('rejects on video error', async () => {
    const video = makeFakeVideo()
    stubCreateElement(video)
    const promise = captureVideoFrame('http://bad.mp4')
    video.onerror?.()
    await expect(promise).rejects.toThrow(/video load failed/)
  })

  it('rejects on zero dimensions', async () => {
    const video = makeFakeVideo({ videoWidth: 0, videoHeight: 0, duration: 0 })
    stubCreateElement(video)
    const promise = captureVideoFrame('http://clip.mp4')
    video.onloadeddata?.()
    await expect(promise).rejects.toThrow(/zero dimensions/)
  })
})

describe('captureVideoFrames', () => {
  it('samples N frames across the duration and reports progress', async () => {
    const video = makeFakeVideo({ duration: 8 })
    stubCreateElement(video)
    const progress: Array<[number, number]> = []
    const promise = captureVideoFrames('http://clip.mp4', 4, (d, t) => progress.push([d, t]))

    video.onloadeddata?.()
    // simulate 4 seeked events
    for (let i = 0; i < 4; i += 1) {
      video.onseeked?.()
    }
    const frames = await promise
    expect(frames).toHaveLength(4)
    expect(progress[progress.length - 1]).toEqual([4, 4])
  })

  it('grabs a single frame when duration unknown', async () => {
    const video = makeFakeVideo({ duration: 0 })
    stubCreateElement(video)
    const promise = captureVideoFrames('http://clip.mp4', 4)
    video.onloadeddata?.()
    const frames = await promise
    expect(frames).toHaveLength(1)
  })

  it('rejects on load error', async () => {
    const video = makeFakeVideo()
    stubCreateElement(video)
    const promise = captureVideoFrames('http://bad.mp4')
    video.onerror?.()
    await expect(promise).rejects.toThrow(/video load failed/)
  })
})
