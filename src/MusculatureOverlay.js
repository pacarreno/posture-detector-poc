// Componente React para superponer un modelo 3D usando Three.js
import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";

// Definición de segmentos del esqueleto (pares de índices de landmarks)
// 99 = índice virtual para la parte superior de la cabeza
const SKELETON_SEGMENTS = [
  [99, 0], // parte superior de la cabeza a nariz
  [0, 11], // nariz a hombro izq
  [0, 12], // nariz a hombro der
  [11, 12], // hombro izq a hombro der
  [11, 23], // hombro izq a cadera izq
  [12, 24], // hombro der a cadera der
  [23, 24], // cadera izq a cadera der
  [23, 25], // cadera izq a rodilla izq
  [24, 26], // cadera der a rodilla der
  [25, 27], // rodilla izq a tobillo izq
  [26, 28], // rodilla der a tobillo der
];

function estimateTopOfHead(landmarks) {
  // Usar nariz (0) y media entre ojos (1 y 2) para estimar dirección
  if (!landmarks || !landmarks[0] || !landmarks[1] || !landmarks[2])
    return null;
  const nose = landmarks[0];
  const leftEye = landmarks[1];
  const rightEye = landmarks[2];
  // Vector de nariz a media de ojos
  const midEye = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
    z: (leftEye.z + rightEye.z) / 2,
  };
  // Vector vertical (hacia arriba en la imagen)
  const dx = 0;
  const dy = -1; // hacia arriba en la imagen
  const dz = 0;
  // Distancia nariz a media de ojos
  const dist = Math.sqrt(
    Math.pow(nose.x - midEye.x, 2) +
      Math.pow(nose.y - midEye.y, 2) +
      Math.pow((nose.z || 0) - (midEye.z || 0), 2)
  );
  // Proyectar hacia arriba desde la nariz (2.5 veces la distancia nariz-ojos)
  const scale = 2.5 * dist;
  return {
    x: nose.x + dx * scale,
    y: nose.y + dy * scale,
    z: (nose.z || 0) + dz * scale,
  };
}

export default function MusculatureOverlay({ poseLandmarks }) {
  const mountRef = useRef(null);
  const modelRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const linesRef = useRef([]);

  useEffect(() => {
    // Inicializar escena Three.js
    const width = 640;
    const height = 480;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(0, 0, 800);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0); // Fondo transparente
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // Luz
    const light = new THREE.AmbientLight(0xffffff, 1);
    scene.add(light);

    // (Líneas guía eliminadas)

    // (Zonas objetivo elípticas eliminadas)

    // --- INDICADOR DE ESTADO DE POSTURA (círculo grande en esquina) ---
    // Se actualiza dinámicamente en el siguiente useEffect
    const statusCircle = new THREE.Mesh(
      new THREE.CircleGeometry(32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.7,
      })
    );
    statusCircle.position.set(-290, 200, 0); // esquina superior izquierda
    scene.add(statusCircle);
    sceneRef.current = scene;
    // Guardar referencia para actualizar color
    rendererRef.current.statusCircle = statusCircle;

    // Cargar modelo glTF de ejemplo
    // const loader = new GLTFLoader();
    // loader.load(
    //   "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/AnimatedMorphSphere/glTF/AnimatedMorphSphere.gltf",
    //   (gltf) => {
    //     const model = gltf.scene;
    //     model.scale.set(100, 100, 100); // Ajusta el tamaño según sea necesario
    //     model.position.set(0, 0, 0);
    //     scene.add(model);
    //     modelRef.current = model;
    //   },
    //   undefined,
    //   (error) => {
    //     console.error("Error cargando modelo glTF:", error);
    //   }
    // );

    // Animación
    const animate = function () {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      if (
        mountRef.current &&
        renderer.domElement.parentNode === mountRef.current
      ) {
        mountRef.current.removeChild(renderer.domElement);
      }
      if (modelRef.current && sceneRef.current) {
        sceneRef.current.remove(modelRef.current);
      }
      linesRef.current = [];
    };
  }, []);

  useEffect(() => {
    // --- FEEDBACK VISUAL DE POSTURA (círculo de estado) ---
    // Usar distancia oreja-hombro derecha (landmarks 8 y 12)
    const extended = poseLandmarks ? [...poseLandmarks] : [];
    let color = 0x888888; // gris por defecto
    if (extended[8] && extended[12]) {
      const dx = (extended[8].x - extended[12].x) * 640;
      const dy = (extended[8].y - extended[12].y) * -480;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 55) {
        color = 0xff0000; // rojo (mala postura)
      } else if (dist < 85) {
        color = 0xffa500; // naranja (intermedia)
      } else {
        color = 0x00ff00; // verde (buena postura)
      }
    }
    // Actualizar color del círculo
    if (rendererRef.current && rendererRef.current.statusCircle) {
      rendererRef.current.statusCircle.material.color.setHex(color);
      rendererRef.current.statusCircle.material.needsUpdate = true;
    }
  }, [poseLandmarks]);

  return (
    <div
      ref={mountRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        width: 640,
        height: 480,
        zIndex: 2,
      }}
    />
  );
}
