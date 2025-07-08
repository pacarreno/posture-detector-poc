import React, { useRef, useEffect, useState } from "react";
import SecondaryCameraView from "./SecondaryCameraView";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { Pose } from "@mediapipe/pose";
import MusculatureOverlay from "./MusculatureOverlay";

// --- Posture Checks ---
const postureChecks = [
  {
    key: "neck",
    label: "Cuello adelantado",
    check: (landmarks) => {
      const nose = landmarks[0];
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const avgShoulderX = (leftShoulder.x + rightShoulder.x) / 2;
      return Math.abs(nose.x - avgShoulderX) > 0.1;
    },
    message: "Corrige tu cuello",
    guide:
      "Alinea tu cabeza con tus hombros, mantén la barbilla paralela al suelo.",
  },
  {
    key: "shoulders",
    label: "Hombros caídos",
    check: (landmarks) => {
      // Mejor lógica: compara la línea de hombros con la de caderas para compensar inclinación de cámara
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];
      if (leftShoulder && rightShoulder && leftHip && rightHip) {
        // Vector hombros
        const dxShoulders = rightShoulder.x - leftShoulder.x;
        const dyShoulders = rightShoulder.y - leftShoulder.y;
        // Vector caderas
        const dxHips = rightHip.x - leftHip.x;
        const dyHips = rightHip.y - leftHip.y;
        // Ángulo de hombros y caderas respecto a horizontal
        const angleShoulders = Math.atan2(dyShoulders, dxShoulders);
        const angleHips = Math.atan2(dyHips, dxHips);
        // Diferencia de ángulos (en grados)
        const angleDiffDeg = Math.abs(
          ((angleShoulders - angleHips) * 180) / Math.PI
        );
        // Si la diferencia angular es mayor a cierto umbral, hay inclinación real de hombros respecto a caderas
        // Umbral tolerante: 7 grados
        return angleDiffDeg > 7;
      } else if (leftShoulder && rightShoulder) {
        // Fallback: diferencia de altura simple, pero con umbral más alto
        return Math.abs(leftShoulder.y - rightShoulder.y) > 0.1;
      }
      return false;
    },
    message: "Evita hombros caídos",
    guide:
      "Relaja los hombros y mantenlos alineados, no los dejes caer hacia adelante o abajo.",
  },
  {
    key: "tilt",
    label: "Inclinación lateral de hombros",
    check: (landmarks) => {
      // Mejor lógica: compara la línea hombros con la línea caderas y calcula el ángulo
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];
      if (!leftShoulder || !rightShoulder) return false;
      // Vector hombros
      const dxShoulders = (rightShoulder.x - leftShoulder.x) * 640;
      const dyShoulders = (rightShoulder.y - leftShoulder.y) * 480;
      // Si hay caderas, usar como referencia para compensar inclinación de cámara
      if (leftHip && rightHip) {
        const dxHips = (rightHip.x - leftHip.x) * 640;
        const dyHips = (rightHip.y - leftHip.y) * 480;
        // Ángulo de hombros y caderas respecto a horizontal
        const angleShoulders =
          Math.atan2(dyShoulders, dxShoulders) * (180 / Math.PI);
        const angleHips = Math.atan2(dyHips, dxHips) * (180 / Math.PI);
        // Diferencia de ángulos (compensa inclinación de cámara)
        const diff = Math.abs(angleShoulders - angleHips);
        return diff > 6; // umbral en grados, ajustable (6° es tolerante)
      } else {
        // Si no hay caderas, usar solo diferencia de altura pero con umbral mayor
        return Math.abs(dyShoulders) > 0.12 * 480; // 0.12 es más tolerante
      }
    },
    message: "Evita inclinarte de lado (hombros)",
    guide: "Mantén ambos hombros a la misma altura y el tronco recto.",
  },
  {
    key: "trunk-tilt",
    label: "Inclinación lateral del tronco",
    check: (landmarks) => {
      // Usar caderas y hombros para estimar inclinación del tronco
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];
      if (!leftShoulder || !rightShoulder || !leftHip || !rightHip)
        return false;
      // Vector hombros
      const midShoulder = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
      };
      // Vector caderas
      const midHip = {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2,
      };
      // Diferencia horizontal entre hombros y caderas
      const dx = (midShoulder.x - midHip.x) * 640; // en px
      // Si el centro de hombros está desplazado respecto al centro de caderas
      return Math.abs(dx) > 30; // umbral ajustable
    },
    message: "Evita inclinar el tronco hacia un lado",
    guide: "Alinea tus hombros con tus caderas para mantener el tronco recto.",
  },
];

export default function PosturaDetector() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [secondaryDeviceId, setSecondaryDeviceId] = useState("");
  const streamRef = useRef(null);
  const poseRef = useRef(null);
  const animationRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({});
  const [currentLandmarks, setCurrentLandmarks] = useState(null);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );
      setDevices(videoDevices);
      if (videoDevices.length > 0) {
        // Buscar la primera cámara cuyo label comience con "Logi"
        const logiCam = videoDevices.find(
          (d) => d.label && d.label.startsWith("Logi")
        );
        setSelectedDeviceId(
          (prev) =>
            prev || (logiCam ? logiCam.deviceId : videoDevices[0].deviceId)
        );
        // Selecciona la primera cámara adicional como secundaria si existe
        const mainDeviceId = logiCam
          ? logiCam.deviceId
          : videoDevices[0].deviceId;
        const secondary = videoDevices.find(
          (d) => d.deviceId !== (selectedDeviceId || mainDeviceId)
        );
        setSecondaryDeviceId(
          (prev) => prev || (secondary && secondary.deviceId) || ""
        );
      }
    });
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!selectedDeviceId) return;
    // Detener stream anterior
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (poseRef.current) {
      poseRef.current.close();
      poseRef.current = null;
    }
    // Obtener stream de la cámara seleccionada
    navigator.mediaDevices
      .getUserMedia({
        video: {
          deviceId: { exact: selectedDeviceId },
          width: 640,
          height: 480,
        },
      })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            startPoseDetection();
          };
        }
      });
    // eslint-disable-next-line
  }, [selectedDeviceId]);

  const startPoseDetection = () => {
    if (!videoRef.current) return;
    const pose = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    pose.onResults(onResults);
    poseRef.current = pose;
    // Procesar frames manualmente
    const detect = async () => {
      if (
        videoRef.current &&
        !videoRef.current.paused &&
        !videoRef.current.ended
      ) {
        await pose.send({ image: videoRef.current });
      }
      animationRef.current = requestAnimationFrame(detect);
    };
    detect();
  };

  // Dibuja la guía visual de la mejor posición cervical y expansión torácica
  function drawOptimalNeckGuide(ctx, landmarks, postureDetected) {
    if (!landmarks) return;
    // Promedio de hombros
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    if (!leftShoulder || !rightShoulder) return;
    const midShoulder = {
      x: ((leftShoulder.x + rightShoulder.x) / 2) * 640,
      y: ((leftShoulder.y + rightShoulder.y) / 2) * 480,
    };
    // Altura ideal de la cabeza: usar distancia media hombro-oreja y proyectar hacia arriba
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    let earY = null;
    if (leftEar && rightEar) {
      earY = ((leftEar.y + rightEar.y) / 2) * 480;
    } else if (leftEar) {
      earY = leftEar.y * 480;
    } else if (rightEar) {
      earY = rightEar.y * 480;
    }
    // Si no hay orejas, estimar altura de cabeza
    let headY = earY !== null ? earY : midShoulder.y - 80;
    // Proyectar "posición ideal" de la cabeza: justo encima de los hombros, a una distancia estándar
    const idealHeadY = midShoulder.y - 90;
    const idealHeadX = midShoulder.x;
    // Dibuja línea guía cuello
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(midShoulder.x, midShoulder.y);
    ctx.lineTo(idealHeadX, idealHeadY + 20); // cuello
    ctx.strokeStyle = postureDetected ? "#00e676" : "#00c853";
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    // Flecha/área de expansión torácica frontal
    // Dibuja una flecha desde el esternón hacia adelante (frontal)
    // Estimar esternón como punto medio entre hombros, desplazado un poco hacia abajo
    const sternum = { x: midShoulder.x, y: midShoulder.y + 32 };
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(sternum.x, sternum.y);
    ctx.lineTo(sternum.x, sternum.y + 38);
    ctx.strokeStyle = "#2979ff";
    ctx.lineWidth = 5;
    ctx.stroke();
    // Cabeza de flecha
    ctx.beginPath();
    ctx.moveTo(sternum.x - 10, sternum.y + 28);
    ctx.lineTo(sternum.x, sternum.y + 38);
    ctx.lineTo(sternum.x + 10, sternum.y + 28);
    ctx.strokeStyle = "#2979ff";
    ctx.lineWidth = 4;
    ctx.stroke();
    // Texto guía
    ctx.globalAlpha = 0.95;
    ctx.font = "18px Arial";
    ctx.fillStyle = "#00c853";
    ctx.fillText(
      "Cuello relajado, cabeza alineada",
      idealHeadX - 90,
      idealHeadY - 44
    );
    ctx.font = "16px Arial";
    ctx.fillStyle = "#2979ff";
    ctx.fillText("Expande el pecho al frente", sternum.x - 80, sternum.y + 60);
    ctx.restore();
  }

  function drawEarShoulderGuides(ctx, landmarks) {
    // Landmarks: 7 = left ear, 8 = right ear, 11 = left shoulder, 12 = right shoulder
    if (!landmarks) return;
    const pairs = [
      { ear: 7, shoulder: 11 },
      { ear: 8, shoulder: 12 },
    ];
    pairs.forEach(({ ear, shoulder }) => {
      if (landmarks[ear] && landmarks[shoulder]) {
        // Convert normalized coordinates to canvas
        const x1 = landmarks[ear].x * 640;
        const y1 = landmarks[ear].y * 480;
        const x2 = landmarks[shoulder].x * 640;
        const y2 = landmarks[shoulder].y * 480;
        // Distancia vertical
        const dist = Math.abs(y2 - y1);
        // Rango de referencia (ajustable)
        const minDist = 60; // px (verde)
        const maxDist = 120; // px (naranja)
        let color = "#00FF00";
        if (dist > maxDist) color = "#FF3D00";
        else if (dist > minDist) color = "#FFAB00";
        // Dibuja la línea
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.stroke();
        // Dibuja el área objetivo (verde)
        ctx.beginPath();
        ctx.moveTo(x1 - 10, y1 + minDist);
        ctx.lineTo(x1 + 10, y1 + minDist);
        ctx.lineTo(x1 + 10, y1 + maxDist);
        ctx.lineTo(x1 - 10, y1 + maxDist);
        ctx.closePath();
        ctx.fillStyle = "rgba(0,255,0,0.15)";
        ctx.fill();
      }
    });
  }

  function onResults(results) {
    const canvasCtx = canvasRef.current.getContext("2d");
    canvasCtx.save();
    canvasCtx.clearRect(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
    canvasCtx.drawImage(
      results.image,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
    let detected = [];
    if (results.poseLandmarks) {
      setCurrentLandmarks(results.poseLandmarks);
      postureChecks.forEach((check) => {
        if (check.check(results.poseLandmarks)) {
          detected.push(check);
        }
      });
      // Solo guía visual de la mejor posición cervical y expansión torácica
      // Si hay cuello adelantado, resalta la guía
      const neckIssue = detected.find((d) => d.key === "neck");
      drawOptimalNeckGuide(canvasCtx, results.poseLandmarks, !!neckIssue);
      // Solo dibujar landmarks de cabeza y hombros
      const headAndShouldersIdx = [0, 7, 8, 11, 12];
      const filteredLandmarks = results.poseLandmarks.filter((_, idx) =>
        headAndShouldersIdx.includes(idx)
      );
      drawLandmarks(canvasCtx, filteredLandmarks, {
        color: detected.length === 0 ? "#00FF00" : "#FF0000",
        lineWidth: 3,
      });

      if (detected.length > 0) {
        detected.forEach((check, idx) => {
          canvasCtx.font = "20px Arial";
          // Si es inclinación lateral del tronco, resalta en naranja
          canvasCtx.fillStyle = check.key === "trunk-tilt" ? "#ff9900" : "red";
          canvasCtx.fillText(check.message, 10, 30 + idx * 30);
          // Mostrar guía textual en el canvas
          canvasCtx.font = "16px Arial";
          canvasCtx.fillStyle =
            check.key === "trunk-tilt" ? "#ff9900" : "#3333ff";
          canvasCtx.fillText(check.guide, 10, 50 + idx * 30);
        });
        // Actualizar historial y estadísticas
        setHistory((prev) => [
          {
            time: new Date().toLocaleTimeString(),
            issues: detected.map((d) => d.label),
          },
          ...prev.slice(0, 19),
        ]);
        setStats((prev) => {
          const newStats = { ...prev };
          detected.forEach((d) => {
            newStats[d.label] = (newStats[d.label] || 0) + 1;
          });
          return newStats;
        });
      }
    }
    canvasCtx.restore();
  }

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Detector de Postura</h2>
      <div
        style={{
          marginBottom: 10,
          display: "flex",
          justifyContent: "center",
          gap: 40,
        }}
      >
        <div>
          <label htmlFor="camera-select">Selecciona la cámara: </label>
          <select
            id="camera-select"
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
          >
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Cámara ${device.deviceId}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="secondary-camera-select">Cámara secundaria: </label>
          <select
            id="secondary-camera-select"
            value={secondaryDeviceId}
            onChange={(e) => setSecondaryDeviceId(e.target.value)}
            disabled={devices.length < 2}
          >
            <option value="">(Ninguna)</option>
            {devices
              .filter((d) => d.deviceId !== selectedDeviceId)
              .map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Cámara ${device.deviceId}`}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
        <div
          style={{
            position: "relative",
            width: 640,
            height: 480,
            display: "block",
          }}
        >
          <video ref={videoRef} style={{ display: "none" }} playsInline></video>
          <canvas
            ref={canvasRef}
            width="640"
            height="480"
            style={{
              border: "1px solid black",
              position: "absolute",
              top: 0,
              left: 0,
              zIndex: 1,
            }}
          />
          <MusculatureOverlay poseLandmarks={currentLandmarks} />
        </div>
        <div>
          <SecondaryCameraView
            deviceId={secondaryDeviceId}
            placeholder="No hay más cámaras disponibles"
          />
        </div>
      </div>
      <div
        style={{
          marginTop: 20,
          textAlign: "left",
          maxWidth: 640,
          margin: "20px auto",
        }}
      >
        <h3>Estadísticas de correcciones</h3>
        <ul>
          {postureChecks.map((check) => (
            <li key={check.key}>
              {check.label}: {stats[check.label] || 0}
              <br />
              <span style={{ color: "#3333ff", fontSize: "0.95em" }}>
                {check.guide}
              </span>
            </li>
          ))}
        </ul>
        <h3>Historial reciente</h3>
        <ul>
          {history.map((h, idx) => (
            <li key={idx}>
              [{h.time}] {h.issues.join(", ")}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
