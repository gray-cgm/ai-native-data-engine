function getBrowserOrigin() {
  if (typeof window === 'undefined') {
    return 'http://localhost'
  }

  return window.location.origin
}

function getBrowserHostname() {
  if (typeof window === 'undefined') {
    return 'localhost'
  }

  return window.location.hostname
}

function getProtocol() {
  if (typeof window === 'undefined') {
    return 'http:'
  }

  return window.location.protocol
}

export function resolveToolBaseUrl(port: number, envValue?: string) {
  if (envValue && envValue.trim()) {
    return envValue
  }

  const protocol = getProtocol()
  const hostname = getBrowserHostname()
  return `${protocol}//${hostname}:${port}`
}

export function toAbsoluteUrl(baseUrl: string, pathname = '') {
  return new URL(pathname, `${baseUrl.replace(/\/$/, '')}/`).toString()
}

export function resolveGatewayPath(pathname: string) {
  return new URL(pathname, getBrowserOrigin()).pathname
}