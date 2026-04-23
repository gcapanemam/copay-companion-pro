import { describe, it, expect } from "vitest";
import {
  calcularJornadaDia,
  calcularBancoHoras,
  aplicarTolerancia,
  JORNADA_PADRAO,
  minutosParaHHMM,
} from "@/lib/pontoCalculos";

describe("pontoCalculos", () => {
  it("dia trabalhado completo (8h) => saldo 0", () => {
    const r = calcularJornadaDia({
      data: "2025-01-06", // segunda
      entrada_1: "08:00", saida_1: "12:00",
      entrada_2: "13:00", saida_2: "17:00",
    });
    expect(r.trabalhadas_min).toBe(480);
    expect(r.esperadas_min).toBe(480);
    expect(r.saldo_min).toBe(0);
    expect(r.status).toBe("ok");
  });

  it("hora extra de 1h => saldo positivo", () => {
    const r = calcularJornadaDia({
      data: "2025-01-06",
      entrada_1: "08:00", saida_1: "12:00",
      entrada_2: "13:00", saida_2: "18:00",
    });
    expect(r.trabalhadas_min).toBe(540);
    expect(r.extras_min).toBe(60);
    expect(r.saldo_min).toBe(60);
  });

  it("tolerância de 10min é aplicada", () => {
    expect(aplicarTolerancia(8, 10)).toBe(0);
    expect(aplicarTolerancia(15, 10)).toBe(15);
    expect(aplicarTolerancia(-9, 10)).toBe(0);
  });

  it("domingo (folga) => esperadas 0", () => {
    const r = calcularJornadaDia({
      data: "2025-01-05", // domingo
      entrada_1: "08:00", saida_1: "12:00",
    });
    expect(r.esperadas_min).toBe(0);
    expect(r.status).toBe("folga");
  });

  it("falta saída_1 => irregular", () => {
    const r = calcularJornadaDia({
      data: "2025-01-06",
      entrada_1: "08:00",
      entrada_2: "13:00", saida_2: "17:00",
    });
    expect(r.irregularidades).toContain("Falta saída_1");
    expect(r.status).toBe("irregular");
  });

  it("intervalo abaixo do mínimo => irregular", () => {
    const r = calcularJornadaDia({
      data: "2025-01-06",
      entrada_1: "08:00", saida_1: "12:00",
      entrada_2: "12:30", saida_2: "16:30",
    });
    expect(r.irregularidades.some((i) => i.includes("Intervalo abaixo"))).toBe(true);
  });

  it("banco de horas: crédito - débito", () => {
    const s = calcularBancoHoras([
      { minutos: 60, data_referencia: "2025-01-01" },
      { minutos: 30, data_referencia: "2025-01-02" },
      { minutos: -45, data_referencia: "2025-01-03" },
    ]);
    expect(s.credito_min).toBe(90);
    expect(s.debito_min).toBe(45);
    expect(s.saldo_min).toBe(45);
  });

  it("formatação HH:MM", () => {
    expect(minutosParaHHMM(0)).toBe("00:00");
    expect(minutosParaHHMM(60)).toBe("01:00");
    expect(minutosParaHHMM(125)).toBe("02:05");
    expect(minutosParaHHMM(-30)).toBe("-00:30");
  });

  it("jornada padrão 8h Seg-Sex", () => {
    expect(JORNADA_PADRAO.carga_diaria_min).toBe(480);
    expect(JORNADA_PADRAO.dias_semana).toEqual([1, 2, 3, 4, 5]);
  });
});
