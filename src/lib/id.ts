export const uid = (): string =>
  (globalThis.crypto?.randomUUID?.() as string | undefined) ??
  Math.random().toString(36).slice(2) + Date.now().toString(36);
