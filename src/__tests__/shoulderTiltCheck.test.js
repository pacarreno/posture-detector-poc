// shoulderTiltCheck.test.js
// Prueba unitaria para la lógica de inclinación de hombros

function checkShoulderTilt(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  if (leftShoulder && rightShoulder && leftHip && rightHip) {
    const dxShoulders = rightShoulder.x - leftShoulder.x;
    const dyShoulders = rightShoulder.y - leftShoulder.y;
    const dxHips = rightHip.x - leftHip.x;
    const dyHips = rightHip.y - leftHip.y;
    const angleShoulders = Math.atan2(dyShoulders, dxShoulders);
    const angleHips = Math.atan2(dyHips, dxHips);
    const angleDiffDeg = Math.abs(
      ((angleShoulders - angleHips) * 180) / Math.PI
    );
    return angleDiffDeg > 7;
  } else if (leftShoulder && rightShoulder) {
    return Math.abs(leftShoulder.y - rightShoulder.y) > 0.1;
  }
  return false;
}

test("detecta hombros alineados (sin inclinación)", () => {
  const landmarks = [];
  landmarks[11] = { x: 0.4, y: 0.5 };
  landmarks[12] = { x: 0.6, y: 0.5 };
  landmarks[23] = { x: 0.4, y: 0.8 };
  landmarks[24] = { x: 0.6, y: 0.8 };
  expect(checkShoulderTilt(landmarks)).toBe(false);
});

test("detecta inclinación real de hombros respecto a caderas", () => {
  const landmarks = [];
  landmarks[11] = { x: 0.4, y: 0.5 };
  landmarks[12] = { x: 0.6, y: 0.6 };
  landmarks[23] = { x: 0.4, y: 0.8 };
  landmarks[24] = { x: 0.6, y: 0.8 };
  expect(checkShoulderTilt(landmarks)).toBe(true);
});

test("tolera inclinación de cámara (hombros y caderas paralelos)", () => {
  const landmarks = [];
  landmarks[11] = { x: 0.4, y: 0.5 };
  landmarks[12] = { x: 0.6, y: 0.6 };
  landmarks[23] = { x: 0.4, y: 0.7 };
  landmarks[24] = { x: 0.6, y: 0.8 };
  // Hombros y caderas inclinados igual: no debe marcar error
  expect(checkShoulderTilt(landmarks)).toBe(false);
});

test("detecta diferencia simple de altura si no hay caderas", () => {
  const landmarks = [];
  landmarks[11] = { x: 0.4, y: 0.5 };
  landmarks[12] = { x: 0.6, y: 0.7 };
  // Sin caderas
  expect(checkShoulderTilt(landmarks)).toBe(true);
});

test("detecta inclinación severa de hombros respecto a caderas", () => {
  const landmarks = [];
  landmarks[11] = { x: 0.4, y: 0.5 };
  landmarks[12] = { x: 0.6, y: 0.8 }; // hombro derecho mucho más bajo
  landmarks[23] = { x: 0.4, y: 0.8 };
  landmarks[24] = { x: 0.6, y: 0.8 };
  expect(checkShoulderTilt(landmarks)).toBe(true);
});
