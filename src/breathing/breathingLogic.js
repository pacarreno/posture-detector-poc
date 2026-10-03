// --- Ejercicios de respiración ---
// Cada fase: { key, label, instruction, seconds }
export const exercises = {
  diafragmatica: {
    key: "diafragmatica",
    name: "Respiración diafragmática",
    description:
      "Inhala por la nariz inflando el abdomen (no el pecho) y exhala lento por la boca. Respirar con el pecho y por la boca, sobre todo con estrés, hace tragar más aire.",
    benefit: "Reduce los eructos y la sensación de hinchazón.",
    defaultMinutes: 5,
    phases: [
      {
        key: "inhale",
        label: "Inhala",
        instruction: "Por la nariz, inflando el abdomen",
        seconds: 4,
      },
      {
        key: "exhale",
        label: "Exhala",
        instruction: "Lento por la boca, el abdomen baja",
        seconds: 6,
      },
    ],
  },
  exhalacionLarga: {
    key: "exhalacionLarga",
    name: "Exhalación larga",
    description:
      "Exhala el doble de lo que inhalas (por ejemplo, 4 segundos adentro y 8 afuera).",
    benefit: "Relaja el abdomen y ayuda al tránsito del gas.",
    defaultMinutes: 5,
    phases: [
      {
        key: "inhale",
        label: "Inhala",
        instruction: "Por la nariz, abdomen hacia afuera",
        seconds: 4,
      },
      {
        key: "exhale",
        label: "Exhala",
        instruction: "Suave y el doble de largo",
        seconds: 8,
      },
    ],
  },
};

export const DAILY_GOAL = 3;

export function cycleSeconds(phases) {
  return phases.reduce((sum, p) => sum + p.seconds, 0);
}

// Devuelve la fase actual, el progreso dentro de ella (0..1),
// los segundos restantes de la fase y el número de ciclo (desde 1).
export function getPhaseAt(elapsedSeconds, phases) {
  const cycle = cycleSeconds(phases);
  const t = ((elapsedSeconds % cycle) + cycle) % cycle;
  let acc = 0;
  for (const phase of phases) {
    if (t < acc + phase.seconds) {
      const inPhase = t - acc;
      return {
        phase,
        progress: inPhase / phase.seconds,
        remaining: Math.ceil(phase.seconds - inPhase),
        cycleNumber: Math.floor(elapsedSeconds / cycle) + 1,
      };
    }
    acc += phase.seconds;
  }
  // No debería ocurrir, pero por robustez devolvemos la última fase completa
  const last = phases[phases.length - 1];
  return { phase: last, progress: 1, remaining: 0, cycleNumber: 1 };
}

// Escala del "abdomen" (círculo): crece al inhalar, baja al exhalar.
export function abdomenScale(phaseInfo, min = 0.6, max = 1) {
  const eased = (1 - Math.cos(Math.PI * phaseInfo.progress)) / 2;
  const k = phaseInfo.phase.key === "inhale" ? eased : 1 - eased;
  return min + (max - min) * k;
}

export function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
