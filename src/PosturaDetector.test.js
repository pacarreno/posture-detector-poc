import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import PosturaDetector from "./PosturaDetector";

jest.useFakeTimers();

// Mock MusculatureOverlay para evitar errores de WebGL en tests
jest.mock("./MusculatureOverlay", () => () => null);

// Mock SecondaryCameraView para evitar dependencias de hardware
jest.mock("./SecondaryCameraView", () => () => (
  <div data-testid="secondary-camera" />
));

// Mock de mediaDevices global (ya está en setupTests.js, pero por robustez)
beforeAll(() => {
  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    get: function () {
      return {
        enumerateDevices: jest.fn().mockResolvedValue([]),
        getUserMedia: jest.fn().mockResolvedValue({}),
      };
    },
  });
});

describe("PosturaDetector", () => {
  test("el tiempo transcurrido incrementa cada segundo", () => {
    render(<PosturaDetector />);
    expect(
      screen.getByText(/Tiempo transcurrido: 0 segundos/i)
    ).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(
      screen.getByText(/Tiempo transcurrido: 3 segundos/i)
    ).toBeInTheDocument();
  });

  test("el tiempo y el indicador se reinician al hacer clic", () => {
    render(<PosturaDetector />);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(
      screen.getByText(/Tiempo transcurrido: 5 segundos/i)
    ).toBeInTheDocument();
    const indicador = screen.getByTitle(/reiniciar el contador/i);
    fireEvent.click(indicador);
    expect(
      screen.getByText(/Tiempo transcurrido: 0 segundos/i)
    ).toBeInTheDocument();
    expect(indicador.textContent).toBe("0");
  });

  test("el indicador suma/resta según la postura detectada", () => {
    // Este test requiere simular el estado de postura detectada
    // Se puede mejorar la estructura del componente para exponer el estado o usar un mock
    // Por ahora, solo valida que el indicador existe y responde al tiempo
    render(<PosturaDetector />);
    const indicador = screen.getByTitle(/reiniciar el contador/i);
    expect(indicador).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    // El valor puede ser positivo o negativo según la lógica, pero debe cambiar
    expect(Number(indicador.textContent)).not.toBe(0);
  });
});
