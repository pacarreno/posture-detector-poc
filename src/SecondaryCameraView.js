import React, { useEffect, useRef, useState } from "react";
import { Pose } from "@mediapipe/pose";
import { drawLandmarks } from "@mediapipe/drawing_utils";

export default function SecondaryCameraView({ deviceId, placeholder }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState("");
  const [landmarks, setLandmarks] = useState(null);

  useEffect(() => {
    let stream;
    setError("");
    if (deviceId) {
      navigator.mediaDevices
        .getUserMedia({ video: { deviceId: { exact: deviceId } } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play().catch(() => {});
              startPoseDetection();
            };
          }
        })
        .catch((err) => {
          setError("No se pudo acceder a la cámara seleccionada");
        });
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line
  }, [deviceId]);

  // MediaPipe Pose para vista lateral
  function startPoseDetection() {
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
    // Procesar frames manualmente
    const detect = async () => {
      if (
        videoRef.current &&
        !videoRef.current.paused &&
        !videoRef.current.ended
      ) {
        await pose.send({ image: videoRef.current });
      }
      requestAnimationFrame(detect);
    };
    detect();
  }

  function onResults(results) {
    setLandmarks(results.poseLandmarks || null);
    drawOverlay(results);
  }

  function drawOverlay(results) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 640, 480);
    // Dibuja línea vertical central (referencia)
    ctx.save();
    ctx.strokeStyle = "#2979ff"; // azul
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(320, 20);
    ctx.lineTo(320, 460);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (results.poseLandmarks) {
      // Dibuja landmarks principales (cabeza, hombros, caderas, rodillas, tobillos)
      const idxs = [0, 11, 12, 23, 24, 25, 26, 27, 28];
      const filtered = results.poseLandmarks.filter((_, idx) =>
        idxs.includes(idx)
      );
      drawLandmarks(ctx, filtered, { color: "#00e676", lineWidth: 5 });

      // Detección avanzada: postura recta lateral
      // 1. Línea vertical desde cadera hasta cabeza
      const leftHip = results.poseLandmarks[23];
      const rightHip = results.poseLandmarks[24];
      const nose = results.poseLandmarks[0];
      if (leftHip && rightHip && nose) {
        // Promedio de caderas
        const midHip = {
          x: ((leftHip.x + rightHip.x) / 2) * 640,
          y: ((leftHip.y + rightHip.y) / 2) * 480,
        };
        const headY = nose.y * 480;
        // Dibuja línea desde cadera hasta cabeza
        ctx.save();
        ctx.strokeStyle = "#2979ff"; // azul
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(midHip.x, midHip.y);
        ctx.lineTo(midHip.x, headY);
        ctx.stroke();
        ctx.restore();

        // 2. Verifica si la cabeza está alineada con la cadera (tolerancia 30px)
        const headX = nose.x * 640;
        const deltaX = Math.abs(headX - midHip.x);
        if (deltaX > 30) {
          // Dibuja advertencia: flecha y círculo rojo
          ctx.save();
          ctx.strokeStyle = "#ff5252";
          ctx.fillStyle = "#ff5252";
          ctx.lineWidth = 5;
          // Flecha desde cabeza hacia línea central
          ctx.beginPath();
          ctx.moveTo(headX, headY);
          ctx.lineTo(midHip.x, headY);
          ctx.stroke();
          // Círculo de advertencia
          ctx.beginPath();
          ctx.arc(headX, headY, 18, 0, 2 * Math.PI);
          ctx.globalAlpha = 0.7;
          ctx.fill();
          ctx.globalAlpha = 1.0;
          ctx.font = "bold 18px Arial";
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.fillText("!", headX, headY + 7);
          ctx.restore();
        }
        // 3. Verifica ángulo de cuello (cabeza respecto a hombros)
        const leftShoulder = results.poseLandmarks[11];
        const rightShoulder = results.poseLandmarks[12];
        if (leftShoulder && rightShoulder) {
          const midShoulder = {
            x: ((leftShoulder.x + rightShoulder.x) / 2) * 640,
            y: ((leftShoulder.y + rightShoulder.y) / 2) * 480,
          };
          const neckAngle =
            Math.atan2(headY - midShoulder.y, headX - midShoulder.x) *
            (180 / Math.PI);
          // Si el ángulo es mayor a 20° respecto a la vertical, advertencia
          if (Math.abs(neckAngle) > 20) {
            ctx.save();
            ctx.strokeStyle = "#ff9900";
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(midShoulder.x, midShoulder.y);
            ctx.lineTo(headX, headY);
            ctx.stroke();
            ctx.restore();
          }
        }
        // 4. Verifica inclinación de tronco (caderas respecto a rodillas)
        const leftKnee = results.poseLandmarks[25];
        const rightKnee = results.poseLandmarks[26];
        if (leftKnee && rightKnee) {
          const midKnee = {
            x: ((leftKnee.x + rightKnee.x) / 2) * 640,
            y: ((leftKnee.y + rightKnee.y) / 2) * 480,
          };
          const trunkAngle =
            Math.atan2(midHip.y - midKnee.y, midHip.x - midKnee.x) *
            (180 / Math.PI);
          if (Math.abs(trunkAngle) > 15) {
            ctx.save();
            ctx.strokeStyle = "#ff5252";
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(midHip.x, midHip.y);
            ctx.lineTo(midKnee.x, midKnee.y);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }
  }

  if (!deviceId) {
    return (
      <div
        style={{
          width: 640,
          height: 480,
          background: "#222",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
        }}
      >
        {placeholder || "No hay más cámaras disponibles"}
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          width: 640,
          height: 480,
          background: "#a00",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: 640, height: 480 }}>
      <video
        ref={videoRef}
        width={640}
        height={480}
        autoPlay
        muted
        playsInline
        style={{ background: "#000", objectFit: "cover" }}
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
