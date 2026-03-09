export function parseDbJson<T>(value: T | string): T {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}
