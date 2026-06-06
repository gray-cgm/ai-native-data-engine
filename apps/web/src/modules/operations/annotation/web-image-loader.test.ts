import { beforeEach, describe, expect, it, vi } from 'vitest'

const registerImageLoader = vi.fn()
const addProvider = vi.fn()
vi.mock('@cornerstonejs/core', () => ({
  registerImageLoader: (...a: unknown[]) => registerImageLoader(...a),
  metaData: { addProvider: (...a: unknown[]) => addProvider(...a) },
}))

import { registerWebImageLoader, toWebImageId } from './web-image-loader'

function getRegistered() {
  const loader = registerImageLoader.mock.calls[0][1] as (id: string) => { promise: Promise<unknown> }
  const provider = addProvider.mock.calls[0][0] as (type: string, id: unknown) => unknown
  return { loader, provider }
}

beforeEach(() => {
  // a controllable Image that fires onload synchronously when src is set
  class FakeImage {
    crossOrigin = ''
    naturalWidth = 4
    naturalHeight = 2
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_v: string) {
      queueMicrotask(() => this.onload?.())
    }
  }
  ;(globalThis as unknown as { Image: unknown }).Image = FakeImage

  // canvas getContext returning a fake 2d ctx with getImageData
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4).fill(120),
    }),
  } as unknown as CanvasRenderingContext2D)
})

describe('toWebImageId', () => {
  it('adds the web: scheme idempotently', () => {
    expect(toWebImageId('http://x/a.png')).toBe('web:http://x/a.png')
    expect(toWebImageId('web:abc')).toBe('web:abc')
  })
})

describe('registerWebImageLoader', () => {
  it('registers the loader and metadata provider once', () => {
    registerWebImageLoader()
    registerWebImageLoader()
    expect(registerImageLoader).toHaveBeenCalledTimes(1)
    expect(registerImageLoader).toHaveBeenCalledWith('web', expect.any(Function))
    expect(addProvider).toHaveBeenCalledTimes(1)
  })

  it('the registered loader builds a color IImage with pixel data', async () => {
    registerWebImageLoader()
    const { loader } = getRegistered()
    const { promise } = loader('web:http://x/a.png')
    const image = (await promise) as {
      columns: number
      rows: number
      color: boolean
      getPixelData: () => Uint8Array
      getCanvas: () => HTMLCanvasElement
    }
    expect(image.columns).toBe(4)
    expect(image.rows).toBe(2)
    expect(image.color).toBe(true)
    expect(image.getPixelData().length).toBe(4 * 2 * 3)
    expect(image.getCanvas()).toBeInstanceOf(HTMLCanvasElement)
  })

  it('the metadata provider returns modules for web image ids', async () => {
    registerWebImageLoader()
    const { loader, provider } = getRegistered()
    // resolve once so dimById is populated
    await loader('web:http://x/a.png').promise
    expect(provider('imagePixelModule', 'web:http://x/a.png')).toMatchObject({ rows: 2, columns: 4 })
    expect(provider('imagePlaneModule', 'web:http://x/a.png')).toMatchObject({ rows: 2 })
    expect(provider('generalSeriesModule', 'web:http://x/a.png')).toMatchObject({ modality: 'SC' })
    expect(provider('voiLutModule', 'web:http://x/a.png')).toBeTruthy()
    expect(provider('unknownModule', 'web:http://x/a.png')).toBeUndefined()
    // non-web ids are ignored
    expect(provider('imagePixelModule', 'dicom:1')).toBeUndefined()
    expect(provider('imagePixelModule', 123)).toBeUndefined()
  })
})
