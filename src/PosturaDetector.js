import React, { useRef, useEffect, useState } from "react";
import SecondaryCameraView from "./SecondaryCameraView";
import { drawLandmarks } from "@mediapipe/drawing_utils";
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
  const [detectedIssues, setDetectedIssues] = useState([]);
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
        // Si existe una cámara cuyo label comienza con "GENERAL", usarla como secundaria
        const generalCam = videoDevices.find(
          (d) => d.label && d.label.startsWith("GENERAL")
        );
        if (generalCam) {
          setSecondaryDeviceId(generalCam.deviceId);
        } else {
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

  // ...existing code...

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
      setDetectedIssues(detected);

      // --- DIBUJAR SILUETA DE REFERENCIA (STICKMAN) ---
      // Solo mostrar si hay errores posturales
      if (detected.length > 0) {
        drawReferenceStickman(canvasCtx, results.poseLandmarks);
      }

      // Guía visual de la mejor posición cervical y expansión torácica
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
      // Dibuja un stickman de referencia (verde semitransparente) alineado a la pose ideal
      function drawReferenceStickman(ctx, userLandmarks) {
        if (!userLandmarks) return;
        // Definir proporciones ideales (centrado y erguido)
        // Usar la posición media de caderas y hombros del usuario para alinear la silueta
        const leftShoulder = userLandmarks[11];
        const rightShoulder = userLandmarks[12];
        const leftHip = userLandmarks[23];
        const rightHip = userLandmarks[24];
        const nose = userLandmarks[0];
        if (!leftShoulder || !rightShoulder || !leftHip || !rightHip || !nose)
          return;
        // Centro de hombros y caderas del usuario
        const midShoulder = {
          x: ((leftShoulder.x + rightShoulder.x) / 2) * 640,
          y: ((leftShoulder.y + rightShoulder.y) / 2) * 480,
        };
        const midHip = {
          x: ((leftHip.x + rightHip.x) / 2) * 640,
          y: ((leftHip.y + rightHip.y) / 2) * 480,
        };
        // Altura ideal: distancia hombros-caderas del usuario
        const torsoLen = Math.abs(midShoulder.y - midHip.y);
        // Altura cabeza-mentón
        const headLen = torsoLen * 0.5;
        // Coordenadas ideales para stickman (alineado a usuario)
        const stick = {
          head: { x: midShoulder.x, y: midShoulder.y - headLen },
          neck: { x: midShoulder.x, y: midShoulder.y - headLen * 0.3 },
          leftShoulder: { x: midShoulder.x - 40, y: midShoulder.y },
          rightShoulder: { x: midShoulder.x + 40, y: midShoulder.y },
          leftHip: { x: midHip.x - 30, y: midHip.y },
          rightHip: { x: midHip.x + 30, y: midHip.y },
          torso: { x: midShoulder.x, y: midHip.y },
        };
        ctx.save();
        ctx.globalAlpha = 0.32;
        ctx.strokeStyle = "#00e676";
        ctx.lineWidth = 10;
        ctx.lineCap = "round";
        // Cabeza (círculo)
        ctx.beginPath();
        ctx.arc(stick.head.x, stick.head.y, 28, 0, 2 * Math.PI);
        ctx.stroke();
        // Cuello
        ctx.beginPath();
        ctx.moveTo(stick.head.x, stick.head.y + 28);
        ctx.lineTo(stick.neck.x, stick.neck.y);
        ctx.stroke();
        // Hombros
        ctx.beginPath();
        ctx.moveTo(stick.leftShoulder.x, stick.leftShoulder.y);
        ctx.lineTo(stick.rightShoulder.x, stick.rightShoulder.y);
        ctx.stroke();
        // Torso
        ctx.beginPath();
        ctx.moveTo(stick.neck.x, stick.neck.y);
        ctx.lineTo(stick.torso.x, stick.torso.y);
        ctx.stroke();
        // Caderas
        ctx.beginPath();
        ctx.moveTo(stick.leftHip.x, stick.leftHip.y);
        ctx.lineTo(stick.rightHip.x, stick.rightHip.y);
        ctx.stroke();
        // Unir hombros con caderas (costados)
        ctx.beginPath();
        ctx.moveTo(stick.leftShoulder.x, stick.leftShoulder.y);
        ctx.lineTo(stick.leftHip.x, stick.leftHip.y);
        ctx.moveTo(stick.rightShoulder.x, stick.rightShoulder.y);
        ctx.lineTo(stick.rightHip.x, stick.rightHip.y);
        ctx.stroke();
        ctx.restore();
      }

      if (detected.length > 0) {
        detected.forEach((check, idx) => {
          // --- FEEDBACK VISUAL EN CANVAS ---
          // Parámetros comunes
          canvasCtx.save();
          let color =
            check.key === "trunk-tilt"
              ? "#ff9900"
              : check.key === "neck"
              ? "#2979ff"
              : "#FF0000";
          // Flecha sobre el mentón si debe subir la cabeza
          if (check.key === "neck") {
            const nose = results.poseLandmarks[0];
            if (nose) {
              // Flecha hacia arriba sobre el mentón
              const x = nose.x * 640;
              const y = nose.y * 480;
              drawArrow(canvasCtx, x, y + 20, x, y - 40, color, 8, true);
            }
          }
          // Flecha sobre hombros si están caídos
          if (check.key === "shoulders") {
            const leftShoulder = results.poseLandmarks[11];
            const rightShoulder = results.poseLandmarks[12];
            if (leftShoulder && rightShoulder) {
              // Flechas hacia arriba sobre cada hombro
              [leftShoulder, rightShoulder].forEach((s) => {
                const x = s.x * 640;
                const y = s.y * 480;
                drawArrow(canvasCtx, x, y + 20, x, y - 40, color, 8, true);
              });
            }
          }
          // Flecha lateral sobre hombro bajo si hay inclinación
          if (check.key === "tilt") {
            const leftShoulder = results.poseLandmarks[11];
            const rightShoulder = results.poseLandmarks[12];
            if (leftShoulder && rightShoulder) {
              const lY = leftShoulder.y;
              const rY = rightShoulder.y;
              // Flecha hacia arriba sobre el hombro más bajo
              let s = lY > rY ? leftShoulder : rightShoulder;
              const x = s.x * 640;
              const y = s.y * 480;
              drawArrow(canvasCtx, x, y + 20, x, y - 40, color, 8, true);
            }
          }
          // Flecha lateral sobre el tronco si hay inclinación
          if (check.key === "trunk-tilt") {
            const leftShoulder = results.poseLandmarks[11];
            const rightShoulder = results.poseLandmarks[12];
            const leftHip = results.poseLandmarks[23];
            const rightHip = results.poseLandmarks[24];
            if (leftShoulder && rightShoulder && leftHip && rightHip) {
              // Centro de hombros y caderas
              const midShoulder = {
                x: ((leftShoulder.x + rightShoulder.x) / 2) * 640,
                y: ((leftShoulder.y + rightShoulder.y) / 2) * 480,
              };
              const midHip = {
                x: ((leftHip.x + rightHip.x) / 2) * 640,
                y: ((leftHip.y + rightHip.y) / 2) * 480,
              };
              // Flecha azul desde caderas hacia hombros
              drawArrow(
                canvasCtx,
                midHip.x,
                midHip.y,
                midShoulder.x,
                midShoulder.y,
                color,
                8,
                true
              );
            }
          }
          // Ícono de advertencia (círculo rojo) cerca de la parte afectada
          let iconX = 30,
            iconY = 30 + idx * 40;
          if (check.key === "neck" && results.poseLandmarks[0]) {
            iconX = results.poseLandmarks[0].x * 640 - 20;
            iconY = results.poseLandmarks[0].y * 480 - 60;
          } else if (
            (check.key === "shoulders" || check.key === "tilt") &&
            results.poseLandmarks[11] &&
            results.poseLandmarks[12]
          ) {
            iconX =
              ((results.poseLandmarks[11].x + results.poseLandmarks[12].x) /
                2) *
                640 -
              20;
            iconY =
              ((results.poseLandmarks[11].y + results.poseLandmarks[12].y) /
                2) *
                480 -
              60;
          } else if (
            check.key === "trunk-tilt" &&
            results.poseLandmarks[23] &&
            results.poseLandmarks[24]
          ) {
            iconX =
              ((results.poseLandmarks[23].x + results.poseLandmarks[24].x) /
                2) *
                640 -
              20;
            iconY =
              ((results.poseLandmarks[23].y + results.poseLandmarks[24].y) /
                2) *
                480 +
              30;
          }
          // Dibuja círculo de advertencia
          canvasCtx.beginPath();
          canvasCtx.arc(iconX, iconY, 16, 0, 2 * Math.PI);
          canvasCtx.fillStyle = color;
          canvasCtx.globalAlpha = 0.7;
          canvasCtx.fill();
          // Dibuja el mensaje textual sobre el ícono
          canvasCtx.globalAlpha = 1.0;
          canvasCtx.font = "bold 16px Arial";
          canvasCtx.fillStyle = "#fff";
          canvasCtx.textAlign = "center";
          canvasCtx.fillText("!", iconX, iconY + 6);
          canvasCtx.restore();
        });

        // --- GUÍA PASO A PASO ---
        // Orden de prioridad: cuello, cabeza, hombros, tronco
        const pasos = [];
        if (detected.find((d) => d.key === "neck")) {
          pasos.push("1. Sube el mentón.");
        }
        if (detected.find((d) => d.key === "tilt")) {
          pasos.push("2. Endereza la cabeza (alinear hombros).");
        }
        if (detected.find((d) => d.key === "shoulders")) {
          pasos.push("3. Relaja y sube los hombros.");
        }
        if (detected.find((d) => d.key === "trunk-tilt")) {
          pasos.push("4. Alinea el tronco con las caderas.");
        }
        if (pasos.length > 0) {
          // Fondo translúcido para la guía
          canvasCtx.save();
          canvasCtx.globalAlpha = 0.85;
          canvasCtx.fillStyle = "#fff";
          canvasCtx.fillRect(400, 20, 220, 36 + pasos.length * 28);
          canvasCtx.globalAlpha = 1.0;
          canvasCtx.font = "bold 18px Arial";
          canvasCtx.fillStyle = "#2979ff";
          canvasCtx.fillText("Guía paso a paso:", 510, 44);
          canvasCtx.font = "16px Arial";
          canvasCtx.fillStyle = "#222";
          pasos.forEach((p, i) => {
            canvasCtx.fillText(p, 410, 72 + i * 24);
          });
          canvasCtx.restore();
        }

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
      // Dibuja una flecha en el canvas de (x1, y1) a (x2, y2) con color y tamaño dados
      function drawArrow(
        ctx,
        x1,
        y1,
        x2,
        y2,
        color = "#FF0000",
        width = 6,
        animated = false
      ) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        // Flecha (cabeza)
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headlen = 18;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
          x2 - headlen * Math.cos(angle - Math.PI / 7),
          y2 - headlen * Math.sin(angle - Math.PI / 7)
        );
        ctx.lineTo(
          x2 - headlen * Math.cos(angle + Math.PI / 7),
          y2 - headlen * Math.sin(angle + Math.PI / 7)
        );
        ctx.lineTo(x2, y2);
        ctx.lineTo(
          x2 - headlen * Math.cos(angle - Math.PI / 7),
          y2 - headlen * Math.sin(angle - Math.PI / 7)
        );
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.95;
        ctx.fill();
        ctx.restore();
      }
    }
    canvasCtx.restore();
  }

  // Estado para el indicador numérico
  const [indicatorValue, setIndicatorValue] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const handleReset = () => {
    setIndicatorValue(0);
    setElapsedSeconds(0);
  };
  const detectedRef = useRef(detectedIssues);
  useEffect(() => {
    detectedRef.current = detectedIssues;
  }, [detectedIssues]);
  useEffect(() => {
    const interval = setInterval(() => {
      // Actualiza el indicador según la postura
      if (detectedRef.current && detectedRef.current.length === 0) {
        setIndicatorValue((v) => v + 1);
      } else {
        setIndicatorValue((v) => v - 3);
      }
      // Actualiza el tiempo transcurrido
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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

      {/* Franja de feedback postural */}
      <div
        style={{
          width: 640 * 2 + 24, // suma de ambos canvas y el gap
          height: 32,
          margin: "0 auto 16px auto",
          background:
            detectedIssues && detectedIssues.length === 0
              ? "#00c853"
              : "#ff5252",
          transition: "background 0.3s",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          color: "#fff",
          fontWeight: 600,
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}
      >
        {detectedIssues && detectedIssues.length === 0
          ? "¡Postura correcta!"
          : "Corrige tu postura"}
      </div>
      <div
        style={{
          marginTop: 20,
          textAlign: "center",
          maxWidth: 640,
          margin: "20px auto",
        }}
      >
        <h3>Indicador de postura</h3>
        <div
          style={{
            margin: "32px auto 12px auto",
            fontSize: 48,
            fontWeight: 700,
            width: 180,
            height: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 16,
            background:
              detectedIssues && detectedIssues.length === 0
                ? "#00c853"
                : "#ff5252",
            color: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            transition: "background 0.3s",
            marginBottom: 24,
            cursor: "pointer",
            userSelect: "none",
          }}
          title="Haz clic para reiniciar el contador"
          onClick={handleReset}
        >
          {indicatorValue}
        </div>
        <div style={{ fontSize: 18, color: "#222", marginTop: 8 }}>
          Tiempo transcurrido: {formatTime(elapsedSeconds)}
        </div>
        <div style={{ fontSize: 18, color: "#222", marginTop: 8 }}>
          {indicatorValue > 0
            ? "¡Buen trabajo! Mantén la postura."
            : "Corrige tu postura para mejorar el indicador."}
        </div>
      </div>
    </div>
  );
}

// Formatea segundos a hh:mm:ss
function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
