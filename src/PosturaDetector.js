import React, { useRef, useEffect, useState } from "react";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { Pose } from "@mediapipe/pose";

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
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftEar = landmarks[7];
      const rightEar = landmarks[8];
      // Si la distancia vertical entre hombro y oreja es muy grande, hombros caídos
      const leftDist = Math.abs(leftShoulder.y - leftEar.y);
      const rightDist = Math.abs(rightShoulder.y - rightEar.y);
      return leftDist > 0.25 || rightDist > 0.25;
    },
    message: "Evita hombros caídos",
    guide:
      "Relaja los hombros y mantenlos alineados, no los dejes caer hacia adelante o abajo.",
  },
  {
    key: "tilt",
    label: "Inclinación lateral",
    check: (landmarks) => {
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      // Si la diferencia de altura entre hombros es significativa
      return Math.abs(leftShoulder.y - rightShoulder.y) > 0.08;
    },
    message: "Evita inclinarte de lado",
    guide: "Mantén ambos hombros a la misma altura y el tronco recto.",
  },
];

export default function PosturaDetector() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const streamRef = useRef(null);
  const poseRef = useRef(null);
  const animationRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({});

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );
      setDevices(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedDeviceId((prev) => prev || videoDevices[0].deviceId);
      }
    });
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
      postureChecks.forEach((check) => {
        if (check.check(results.poseLandmarks)) {
          detected.push(check);
        }
      });
      // Cambia el color de los landmarks según la postura
      drawConnectors(canvasCtx, results.poseLandmarks, Pose.POSE_CONNECTIONS, {
        color: detected.length === 0 ? "#00FF00" : "#FF0000",
        lineWidth: 4,
      });
      drawLandmarks(canvasCtx, results.poseLandmarks, {
        color: detected.length === 0 ? "#00FF00" : "#FF0000",
        lineWidth: 2,
      });
      if (detected.length > 0) {
        detected.forEach((check, idx) => {
          canvasCtx.font = "20px Arial";
          canvasCtx.fillStyle = "red";
          canvasCtx.fillText(check.message, 10, 30 + idx * 30);
          // Mostrar guía textual en el canvas
          canvasCtx.font = "16px Arial";
          canvasCtx.fillStyle = "#3333ff";
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
      <div style={{ marginBottom: 10 }}>
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
      <video ref={videoRef} style={{ display: "none" }} playsInline></video>
      <canvas
        ref={canvasRef}
        width="640"
        height="480"
        style={{ border: "1px solid black" }}
      />
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
