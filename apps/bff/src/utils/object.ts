export function removeUndefinedKeys<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) {
      delete value[key]
    }
  }
  return value
}