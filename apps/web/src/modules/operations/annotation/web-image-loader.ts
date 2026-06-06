import { registerImageLoader, metaData, type Types } from '@cornerstonejs/core'

// cornerstone3D 原生只带 DICOM / volume loader；要渲染普通 web 图片（jpg/png/webp/dataURL）
// 必须自己注册：(1) 一个 image loader，(2) 一个 metaData provider。约定 imageId 形如 `web:<url>`。
//
// 关键：StackViewport 在设置相机时若拿不到 imagePlaneModule 会直接 return（→ 纯黑不渲染），
// 且 getImageDataMetadata 会解构 imagePixelModule / generalSeriesModule（缺失则抛错）。
// 所以光给 IImage 不够，必须配套 metaData provider。
//
// v4 加载管线会在 loader resolve 后自动跑 ensureVoxelManager(image)：用 getPixelData()
// + width + height + numberOfComponents 建 voxelManager，并 `delete image.imageFrame.pixelData`，
// 故返回的 IImage 必须带一个 imageFrame 对象。

const WEB_SCHEME = 'web'

// 复用同一张离屏 canvas 做像素抽取，避免每帧重建。
const scratch = document.createElement('canvas')
let lastDrawnImageId = ''

// 图像尺寸缓存：metaData provider 是同步的，dims 在 loader onload 时落缓存；
// setStack 会先 await 图像加载再查 metadata，所以查询时 dims 一定已就位。
const dimById = new Map<string, { rows: number; columns: number }>()

export function toWebImageId(url: string): string {
  return url.startsWith(`${WEB_SCHEME}:`) ? url : `${WEB_SCHEME}:${url}`
}

function drawToScratch(img: HTMLImageElement, imageId: string): CanvasRenderingContext2D {
  const ctx = scratch.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('web-image-loader: 2d context unavailable')
  if (lastDrawnImageId !== imageId) {
    scratch.width = img.naturalWidth
    scratch.height = img.naturalHeight
    ctx.drawImage(img, 0, 0)
    lastDrawnImageId = imageId
  }
  return ctx
}

function buildImage(img: HTMLImageElement, imageId: string): Types.IImage {
  const columns = img.naturalWidth
  const rows = img.naturalHeight
  const numberOfComponents = 3 // RGB（剥掉 alpha，cornerstone color 走 3 通道最稳）
  dimById.set(imageId, { rows, columns })

  const getPixelData = (): Uint8Array => {
    const ctx = drawToScratch(img, imageId)
    const { data } = ctx.getImageData(0, 0, columns, rows) // RGBA
    const rgb = new Uint8Array(columns * rows * 3)
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      rgb[j] = data[i]
      rgb[j + 1] = data[i + 1]
      rgb[j + 2] = data[i + 2]
    }
    return rgb
  }

  const getCanvas = (): HTMLCanvasElement => {
    drawToScratch(img, imageId)
    return scratch
  }

  return {
    imageId,
    color: true,
    rgba: false,
    numberOfComponents,
    columns,
    rows,
    width: columns,
    height: rows,
    columnPixelSpacing: 1,
    rowPixelSpacing: 1,
    sizeInBytes: columns * rows * numberOfComponents,
    minPixelValue: 0,
    maxPixelValue: 255,
    slope: 1,
    intercept: 0,
    windowCenter: 128,
    windowWidth: 256,
    invert: false,
    dataType: 'Uint8Array',
    getPixelData,
    getCanvas,
    imageFrame: {} as Types.IImageFrame,
  } as unknown as Types.IImage
}

function loadWebImage(imageId: string): Types.IImageLoadObject {
  const url = imageId.slice(WEB_SCHEME.length + 1)
  const promise = new Promise<Types.IImage>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(buildImage(img, imageId))
    img.onerror = () => reject(new Error(`web-image-loader: failed to load ${url}`))
    img.src = url
  })
  return { promise }
}

// metaData provider：为 web: imageId 提供 StackViewport 渲染所需的三个模块。
function webMetadataProvider(type: string, imageId: unknown): unknown {
  if (typeof imageId !== 'string' || !imageId.startsWith(`${WEB_SCHEME}:`)) return undefined
  const dim = dimById.get(imageId) ?? { rows: 1, columns: 1 }

  if (type === 'imagePixelModule') {
    return {
      samplesPerPixel: 3,
      photometricInterpretation: 'RGB',
      planarConfiguration: 0,
      rows: dim.rows,
      columns: dim.columns,
      bitsAllocated: 8,
      bitsStored: 8,
      highBit: 7,
      pixelRepresentation: 0,
      windowWidth: 256,
      windowCenter: 128,
    }
  }
  if (type === 'imagePlaneModule') {
    return {
      frameOfReferenceUID: 'WEB_IMAGE_FRAME_OF_REFERENCE',
      rows: dim.rows,
      columns: dim.columns,
      imageOrientationPatient: [1, 0, 0, 0, 1, 0],
      rowCosines: [1, 0, 0],
      columnCosines: [0, 1, 0],
      imagePositionPatient: [0, 0, 0],
      pixelSpacing: [1, 1],
      rowPixelSpacing: 1,
      columnPixelSpacing: 1,
    }
  }
  if (type === 'generalSeriesModule') {
    return { modality: 'SC' } // Secondary Capture
  }
  if (type === 'voiLutModule') {
    return { windowWidth: [256], windowCenter: [128] }
  }
  return undefined
}

let registered = false

export function registerWebImageLoader(): void {
  if (registered) return
  registerImageLoader(WEB_SCHEME, loadWebImage as never)
  metaData.addProvider(webMetadataProvider as never)
  registered = true
}
