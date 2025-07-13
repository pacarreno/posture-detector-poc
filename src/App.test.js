// Mock MusculatureOverlay para evitar errores de WebGL en tests
jest.mock("./MusculatureOverlay", () => () => null);

// El mock de mediaDevices ahora se aplica globalmente en setupTests.js
// Mock MusculatureOverlay para evitar errores de WebGL en tests
jest.mock("./MusculatureOverlay", () => () => null);

// Mocks para canvas y WebGL en entorno de test
beforeAll(() => {
  // Mock getContext para canvas
  HTMLCanvasElement.prototype.getContext = jest.fn(() => {
    return {
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      getImageData: jest.fn(),
      putImageData: jest.fn(),
      createImageData: jest.fn(),
      setTransform: jest.fn(),
      drawImage: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      stroke: jest.fn(),
      translate: jest.fn(),
      scale: jest.fn(),
      rotate: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      measureText: jest.fn(() => ({ width: 0 })),
      setLineDash: jest.fn(),
      font: "",
      textAlign: "",
      textBaseline: "",
      drawFocusIfNeeded: jest.fn(),
      // WebGL context mock
      getExtension: jest.fn(),
      createShader: jest.fn(),
      shaderSource: jest.fn(),
      compileShader: jest.fn(),
      createProgram: jest.fn(),
      attachShader: jest.fn(),
      linkProgram: jest.fn(),
      useProgram: jest.fn(),
      getShaderParameter: jest.fn(),
      getProgramParameter: jest.fn(),
      getShaderInfoLog: jest.fn(),
      getProgramInfoLog: jest.fn(),
      getAttribLocation: jest.fn(),
      getUniformLocation: jest.fn(),
      uniformMatrix4fv: jest.fn(),
      uniform1i: jest.fn(),
      uniform1f: jest.fn(),
      enableVertexAttribArray: jest.fn(),
      vertexAttribPointer: jest.fn(),
      drawArrays: jest.fn(),
      drawElements: jest.fn(),
      viewport: jest.fn(),
      clearColor: jest.fn(),
      clear: jest.fn(),
      createBuffer: jest.fn(),
      bindBuffer: jest.fn(),
      bufferData: jest.fn(),
    };
  });
  // El mock de mediaDevices se aplica globalmente en setupTests.js
});

import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  test("renderiza el título principal del detector de postura", () => {
    render(<App />);
    expect(screen.getByText(/Detector de Postura/i)).toBeInTheDocument();
  });
});
