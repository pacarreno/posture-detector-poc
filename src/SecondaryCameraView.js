import React, { useEffect, useRef } from "react";

export default function SecondaryCameraView({ deviceId, placeholder }) {
  const videoRef = useRef(null);
  const [error, setError] = React.useState("");

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
  }, [deviceId]);

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
    <video
      ref={videoRef}
      width={640}
      height={480}
      autoPlay
      muted
      playsInline
      style={{ background: "#000", objectFit: "cover" }}
    />
  );
}
