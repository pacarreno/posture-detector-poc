import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import BreathingCoach from "./BreathingCoach";

jest.useFakeTimers();

beforeEach(() => localStorage.clear());

describe("BreathingCoach", () => {
  test("guía las fases y cuenta la sesión al terminar", () => {
    render(<BreathingCoach />);
    fireEvent.click(screen.getByRole("tab", { name: "Exhalación larga" }));
    fireEvent.change(screen.getByLabelText(/Duración/), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByText("Comenzar"));

    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByText("Inhala")).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(4000));
    expect(screen.getByText("Exhala")).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(60000));
    expect(screen.getByText("¡Sesión completa!")).toBeInTheDocument();
    expect(screen.getByText(/Sesiones hoy: 1 \/ 3/)).toBeInTheDocument();
  });

  test("se puede pausar y reiniciar", () => {
    render(<BreathingCoach />);
    fireEvent.click(screen.getByText("Comenzar"));
    act(() => jest.advanceTimersByTime(2000));
    fireEvent.click(screen.getByText("Pausar"));
    expect(screen.getByText(/Restante: 04:58/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Reiniciar"));
    expect(screen.getByText(/Restante: 05:00/)).toBeInTheDocument();
  });
});
