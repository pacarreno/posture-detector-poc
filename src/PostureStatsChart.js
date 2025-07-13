import React from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

Chart.register(
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend
);

export default function PostureStatsChart({ stats, history }) {
  // stats: { [label]: count }
  // history: [{ time, issues: [label, ...] }]
  const labels = Object.keys(stats);
  const data = labels.map((l) => stats[l]);
  // Correcciones: veces que pasó de error a postura correcta
  let corrections = 0;
  let lastHadError = true;
  history.forEach((h) => {
    if (h.issues.length === 0 && lastHadError) corrections++;
    lastHadError = h.issues.length > 0;
  });
  // Tiempo en postura correcta (estimado, 1 entrada = 1 ciclo)
  const correctStreak = history.findIndex((h) => h.issues.length > 0);
  const correctTime = correctStreak === -1 ? history.length : correctStreak;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <h4>Errores más frecuentes</h4>
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: "Veces detectado",
              data,
              backgroundColor: "#ff5252",
            },
          ],
        }}
        options={{
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, precision: 0 } },
        }}
        height={180}
      />
      <h4 style={{ marginTop: 24 }}>
        Correcciones y tiempo en postura correcta
      </h4>
      <Doughnut
        data={{
          labels: ["Correcciones", "Tiempo correcto"],
          datasets: [
            {
              data: [corrections, correctTime],
              backgroundColor: ["#2979ff", "#00e676"],
            },
          ],
        }}
        options={{
          plugins: { legend: { position: "bottom" } },
        }}
        height={180}
      />
      <div style={{ fontSize: 15, marginTop: 12 }}>
        <b>Correcciones:</b> {corrections} &nbsp;|&nbsp; <b>Tiempo correcto:</b>{" "}
        {correctTime} ciclos
      </div>
    </div>
  );
}
