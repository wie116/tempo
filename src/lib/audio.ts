let ctx: AudioContext | null = null;

/**
 * Los navegadores móviles bloquean el audio hasta que hay un gesto del usuario.
 * Llamamos a esto en el primer click/tecla y dejamos el contexto vivo.
 */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export type ChimeId = 'bell' | 'chime' | 'bowl' | 'marimba' | 'soft' | 'blip' | 'digital' | 'gong' | 'wood' | 'sparkle';

export const CHIMES: { id: ChimeId; name: string }[] = [
  { id: 'bell', name: 'Campana' },
  { id: 'chime', name: 'Campanita' },
  { id: 'bowl', name: 'Cuenco' },
  { id: 'marimba', name: 'Marimba' },
  { id: 'soft', name: 'Suave' },
  { id: 'blip', name: 'Bip' },
  { id: 'digital', name: 'Digital' },
  { id: 'gong', name: 'Gong profundo' },
  { id: 'wood', name: 'Madera' },
  { id: 'sparkle', name: 'Destello' },
];

interface Recipe {
  notes: number[];
  type: OscillatorType;
  decay: number;
  gap: number;
  /** Segundo oscilador una quinta arriba, más callado: da cuerpo metálico. */
  shimmer?: boolean;
  gain?: number;
}

const RECIPES: Record<ChimeId, Recipe> = {
  bell:    { notes: [880, 1318.5], type: 'sine', decay: 1.7, gap: 0.14, shimmer: true },
  chime:   { notes: [1567.98, 2093, 2637], type: 'sine', decay: 0.9, gap: 0.085, shimmer: true, gain: 0.8 },
  bowl:    { notes: [196, 293.66], type: 'sine', decay: 3.4, gap: 0.05, shimmer: true, gain: 1.2 },
  marimba: { notes: [659.25, 987.77, 1318.5], type: 'triangle', decay: 0.42, gap: 0.11 },
  soft:    { notes: [523.25, 659.25, 783.99], type: 'triangle', decay: 1.1, gap: 0.18 },
  blip:    { notes: [1046.5, 1046.5], type: 'square', decay: 0.16, gap: 0.12, gain: 0.6 },
  digital: { notes: [783.99, 1046.5, 1318.5], type: 'square', decay: 0.12, gap: 0.09, gain: 0.45 },
  gong:    { notes: [130.81, 196, 261.63], type: 'sine', decay: 4.2, gap: 0.035, shimmer: true, gain: 1.15 },
  wood:    { notes: [440, 523.25], type: 'triangle', decay: 0.24, gap: 0.16, gain: 0.8 },
  sparkle: { notes: [1318.5, 1760, 2349.32, 3135.96], type: 'sine', decay: 0.72, gap: 0.065, shimmer: true, gain: 0.65 },
};

/** Sonidos generados con Web Audio: cero archivos, cero latencia. */
export function playChime(kind: ChimeId = 'bell', volume = 0.6, repeats = 1) {
  unlockAudio();
  if (!ctx) return;
  const r = RECIPES[kind] ?? RECIPES.bell;
  const t0 = ctx.currentTime + 0.02;
  const peak = Math.max(0.001, volume * 0.32 * (r.gain ?? 1));

  const voice = (freq: number, at: number, amp: number) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = r.type;
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(amp, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + r.decay);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(at);
    osc.stop(at + r.decay + 0.05);
  };

  for (let rep = 0; rep < repeats; rep++) {
    const base = t0 + rep * (r.gap * r.notes.length + 0.4);
    r.notes.forEach((f, i) => {
      const at = base + i * r.gap;
      voice(f, at, peak);
      if (r.shimmer) voice(f * 1.5, at, peak * 0.22);
    });
  }
}
