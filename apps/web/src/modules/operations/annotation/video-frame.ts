// 客户端从 clip 的 mp4 抽一帧真实图像（无 ffmpeg/服务端依赖）。
// 浏览器解码 video → seek → 画到 canvas → 输出 dataURL，喂给 cornerstone web loader。
// 视频经 /api 同源代理，canvas 不会被 taint。

// atRatio 默认 0：抓首帧。大视频(可达上百 MB)seek 到中段会触发大范围下载，
// 首帧只需 moov + 首样本，最快最稳。需要更具代表性的帧时再传 atRatio。
export function captureVideoFrame(videoUrl: string, atRatio = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'

    let settled = false
    const cleanup = () => {
      video.removeAttribute('src')
      try { video.load() } catch { /* noop */ }
    }
    const fail = (msg: string) => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(msg))
    }

    video.onerror = () => fail(`video load failed: ${videoUrl}`)

    video.onloadeddata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      const target = duration > 0 ? Math.min(duration * atRatio, duration) : 0
      // 设置 currentTime 触发 seeked；首帧 target=0 时部分浏览器需直接抓
      if (target <= 0) {
        grab()
      } else {
        video.currentTime = target
      }
    }

    video.onseeked = () => grab()

    function grab() {
      if (settled) return
      try {
        const w = video.videoWidth
        const h = video.videoHeight
        if (!w || !h) return fail('video has zero dimensions')
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return fail('2d context unavailable')
        ctx.drawImage(video, 0, 0, w, h)
        const url = canvas.toDataURL('image/png')
        settled = true
        cleanup()
        resolve(url)
      } catch (err) {
        fail((err as Error).message)
      }
    }

    video.src = videoUrl
  })
}

// 抽取 N 帧均匀分布的真实帧，组成 cornerstone stack。大视频逐帧 seek 较慢，
// 故复用单个 <video>，顺序 seek+抓帧，并通过 onProgress 回报进度。
export function captureVideoFrames(
  videoUrl: string,
  count = 16,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'

    const frames: string[] = []
    let settled = false
    const canvas = document.createElement('canvas')

    const cleanup = () => {
      video.removeAttribute('src')
      try { video.load() } catch { /* noop */ }
    }
    const fail = (msg: string) => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(msg))
    }

    const grab = (): boolean => {
      const w = video.videoWidth
      const h = video.videoHeight
      if (!w || !h) return false
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return false
      ctx.drawImage(video, 0, 0, w, h)
      frames.push(canvas.toDataURL('image/jpeg', 0.85))
      onProgress?.(frames.length, count)
      return true
    }

    let times: number[] = []
    let cursor = 0

    const next = () => {
      if (settled) return
      if (cursor >= times.length) {
        settled = true
        cleanup()
        if (frames.length === 0) return reject(new Error('no frames captured'))
        return resolve(frames)
      }
      video.currentTime = times[cursor]
    }

    video.onerror = () => fail(`video load failed: ${videoUrl}`)

    video.onloadeddata = () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0
      if (duration <= 0) {
        // 拿不到时长就只抓首帧
        if (grab()) {
          settled = true
          cleanup()
          resolve(frames)
        } else {
          fail('video has zero dimensions')
        }
        return
      }
      // 均匀采样：避开最末尾（部分容器末帧解码异常）
      times = Array.from({ length: count }, (_, i) => (duration * i) / count)
      next()
    }

    video.onseeked = () => {
      if (settled) return
      grab()
      cursor += 1
      next()
    }

    video.src = videoUrl
  })
}
