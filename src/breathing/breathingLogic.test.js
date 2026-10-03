import {
  exercises,
  cycleSeconds,
  getPhaseAt,
  abdomenScale,
  formatMMSS,
} from "./breathingLogic";

const longExhale = exercises.exhalacionLarga.phases;

describe("breathingLogic", () => {
  test("la exhalación larga dura el doble que la inhalación", () => {
    const [inhale, exhale] = longExhale;
    expect(exhale.seconds).toBe(inhale.seconds * 2);
    expect(cycleSeconds(longExhale)).toBe(12);
  });

  test("getPhaseAt recorre inhalar → exhalar → siguiente ciclo", () => {
    expect(getPhaseAt(0, longExhale).phase.key).toBe("inhale");
    expect(getPhaseAt(3.9, longExhale).phase.key).toBe("inhale");
    expect(getPhaseAt(4, longExhale).phase.key).toBe("exhale");
    expect(getPhaseAt(4, longExhale).remaining).toBe(8);
    const next = getPhaseAt(12.5, longExhale);
    expect(next.phase.key).toBe("inhale");
    expect(next.cycleNumber).toBe(2);
  });

  test("el abdomen crece al inhalar y baja al exhalar", () => {
    expect(abdomenScale(getPhaseAt(0, longExhale))).toBeCloseTo(0.6);
    expect(abdomenScale(getPhaseAt(3.99, longExhale))).toBeCloseTo(1, 2);
    expect(abdomenScale(getPhaseAt(11.99, longExhale))).toBeCloseTo(0.6, 2);
  });

  test("formatMMSS", () => {
    expect(formatMMSS(300)).toBe("05:00");
    expect(formatMMSS(61)).toBe("01:01");
    expect(formatMMSS(-3)).toBe("00:00");
  });
});
