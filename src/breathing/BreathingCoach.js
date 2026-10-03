import React, { useEffect, useRef, useState } from "react";
import {
  exercises,
  DAILY_GOAL,
  getPhaseAt,
  abdomenScale,
  formatMMSS,
  todayKey,
} from "./breathingLogic";
import "./BreathingCoach.css";

const TICK_MS = 100;
const STORAGE_KEY = "breathing-sessions";

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Sin almacenamiento disponible: el contador solo vive en memoria
  }
}

// Pitido corto para marcar el cambio de fase (tono más agudo al inhalar)
function beep(audioCtxRef, frequency) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio no disponible
  }
}

export default function BreathingCoach() {
  const [exerciseKey, setExerciseKey] = useState("diafragmatica");
  const [inhaleSeconds, setInhaleSeconds] = useState(4);
  const [minutes, setMinutes] = useState(5);
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finished, setFinished] = useState(false);
  const [sound, setSound] = useState(true);
  const [history, setHistory] = useState(loadHistory);
  const audioCtxRef = useRef(null);
  const lastPhaseRef = useRef(null);

  const exercise = exercises[exerciseKey];
  // En "exhalación larga" el usuario elige la inhalación y la exhalación es el doble
  const phases =
    exerciseKey === "exhalacionLarga"
      ? exercise.phases.map((p) => ({
          ...p,
          seconds: p.key === "inhale" ? inhaleSeconds : inhaleSeconds * 2,
        }))
      : exercise.phases;
  const totalSeconds = minutes * 60;
  const elapsedSeconds = elapsedMs / 1000;
  const info = getPhaseAt(elapsedSeconds, phases);
  const scale = running || elapsedMs > 0 ? abdomenScale(info) : 0.6;
  const todayCount = history[todayKey()] || 0;

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      setElapsedMs((ms) => ms + TICK_MS);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  // Fin de la sesión
  useEffect(() => {
    if (running && elapsedSeconds >= totalSeconds) {
      setRunning(false);
      setFinished(true);
      setHistory((h) => {
        const key = todayKey();
        const next = { ...h, [key]: (h[key] || 0) + 1 };
        saveHistory(next);
        return next;
      });
      if (sound) beep(audioCtxRef, 523);
    }
  }, [running, elapsedSeconds, totalSeconds, sound]);

  // Aviso sonoro / vibración en cada cambio de fase
  useEffect(() => {
    if (!running) {
      lastPhaseRef.current = null;
      return;
    }
    const marker = `${info.cycleNumber}-${info.phase.key}`;
    if (lastPhaseRef.current !== marker) {
      lastPhaseRef.current = marker;
      if (sound) beep(audioCtxRef, info.phase.key === "inhale" ? 440 : 330);
      if (navigator.vibrate) navigator.vibrate(60);
    }
  }, [running, info.cycleNumber, info.phase.key, sound]);

  const reset = () => {
    setRunning(false);
    setElapsedMs(0);
    setFinished(false);
  };

  const selectExercise = (key) => {
    reset();
    setExerciseKey(key);
    setMinutes(exercises[key].defaultMinutes);
  };

  const started = elapsedMs > 0;

  return (
    <div className="breathing">
      <h2>Respiración guiada</h2>

      <div className="breathing-tabs" role="tablist">
        {Object.values(exercises).map((ex) => (
          <button
            key={ex.key}
            role="tab"
            aria-selected={ex.key === exerciseKey}
            className={ex.key === exerciseKey ? "active" : ""}
            onClick={() => selectExercise(ex.key)}
          >
            {ex.name}
          </button>
        ))}
      </div>

      <p className="breathing-desc">{exercise.description}</p>
      <p className="breathing-benefit">{exercise.benefit}</p>

      <div className="breathing-settings">
        {exerciseKey === "exhalacionLarga" && (
          <label>
            Inhalar{" "}
            <select
              value={inhaleSeconds}
              disabled={started}
              onChange={(e) => setInhaleSeconds(Number(e.target.value))}
            >
              {[3, 4, 5, 6].map((s) => (
                <option key={s} value={s}>
                  {s} s / exhalar {s * 2} s
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Duración{" "}
          <select
            value={minutes}
            disabled={started}
            onChange={(e) => setMinutes(Number(e.target.value))}
          >
            {[1, 3, 5, 10].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={sound}
            onChange={(e) => setSound(e.target.checked)}
          />{" "}
          Sonido
        </label>
      </div>

      <div className="breathing-stage">
        <div
          className={`breathing-belly ${info.phase.key}`}
          data-testid="breathing-belly"
          style={{ transform: `scale(${scale})` }}
        />
        <div className="breathing-label" aria-live="polite">
          {finished ? (
            <strong>¡Sesión completa!</strong>
          ) : started ? (
            <>
              <strong>{info.phase.label}</strong>
              <span className="breathing-count">{info.remaining}</span>
              <small>{info.phase.instruction}</small>
            </>
          ) : (
            <>
              <strong>Listo</strong>
              <small>
                {phases.map((p) => `${p.label} ${p.seconds} s`).join(" · ")}
              </small>
            </>
          )}
        </div>
      </div>

      <div className="breathing-time">
        Restante: {formatMMSS(totalSeconds - elapsedSeconds)}
        {started && !finished && <> · Ciclo {info.cycleNumber}</>}
      </div>

      <div className="breathing-controls">
        {!running ? (
          <button
            className="primary"
            onClick={() => {
              if (finished) reset();
              setRunning(true);
            }}
          >
            {started && !finished ? "Continuar" : "Comenzar"}
          </button>
        ) : (
          <button onClick={() => setRunning(false)}>Pausar</button>
        )}
        {started && <button onClick={reset}>Reiniciar</button>}
      </div>

      <div className="breathing-goal">
        Sesiones hoy: {todayCount} / {DAILY_GOAL}
        <div className="breathing-dots">
          {Array.from({ length: DAILY_GOAL }).map((_, i) => (
            <span key={i} className={i < todayCount ? "done" : ""} />
          ))}
        </div>
        <small>Recomendado: unos 5 minutos, 2–3 veces al día.</small>
      </div>

      <ul className="breathing-tips">
        <li>Pon una mano en el pecho y otra en el abdomen: solo debe moverse la del abdomen.</li>
        <li>Inhala por la nariz; evita respirar por la boca para no tragar aire.</li>
        <li>Hombros relajados, mandíbula suelta.</li>
      </ul>
    </div>
  );
}
