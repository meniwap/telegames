export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeAngle(angle: number) {
  const wrapped = ((angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return wrapped - Math.PI;
}

export function lerp(start: number, end: number, alpha: number) {
  return start + (end - start) * alpha;
}
