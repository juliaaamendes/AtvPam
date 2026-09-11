export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: number;
};
export type Visit = {
  id: string;
  createdAt: string;
  farm: string;
  technician: string;
  crop: string;
  notes: string;
  condition: "Regular" | "Atenção" | "Crítico";
  photoUri: string | null;
  location: Coordinates | null;
  peakG: number;
};

export const MOTION_LIMIT_G = 2;
export const CHECK_DURATION_MS = 3000;
export const MAX_SAMPLE_GAP_MS = 600;

export function magnitude({ x, y, z }: { x: number; y: number; z: number }) {
  return Math.hypot(x, y, z);
}

export function gpsQuality(accuracy: number | null | undefined) {
  if (accuracy == null || !Number.isFinite(accuracy) || accuracy < 0)
    return {
      label: "Precisão desconhecida",
      color: "#66736D",
      background: "#EEF1EE",
    };
  if (accuracy < 10)
    return { label: "Alta precisão", color: "#23704B", background: "#E6F3E9" };
  if (accuracy <= 30)
    return { label: "Média precisão", color: "#8A6009", background: "#FFF3CE" };
  return { label: "Baixa precisão", color: "#AE3F32", background: "#FCEBE7" };
}

// Independent from the UI: a short peak cannot disappear in a later React render.
export class MotionWindow {
  peakG = 0;
  samples = 0;
  lastAt: number;
  invalid = false;
  unstable = false;

  constructor(readonly startedAt: number) {
    this.lastAt = startedAt;
  }

  add(sample: { x: number; y: number; z: number }, now: number) {
    const g = magnitude(sample);
    if (
      !Number.isFinite(g) ||
      now < this.lastAt ||
      now - this.lastAt > MAX_SAMPLE_GAP_MS
    )
      this.invalid = true;
    if (Number.isFinite(g)) this.peakG = Math.max(this.peakG, g);
    if (g > MOTION_LIMIT_G) this.unstable = true;
    this.samples += 1;
    this.lastAt = now;
    return g;
  }

  result(now: number): "unstable" | "missing" | "stable" {
    if (this.unstable) return "unstable";
    if (
      this.invalid ||
      this.samples < 20 ||
      now - this.lastAt > MAX_SAMPLE_GAP_MS ||
      now - this.startedAt < CHECK_DURATION_MS
    )
      return "missing";
    return "stable";
  }
}

export function parseVisits(raw: string | null): Visit[] {
  if (raw === null) return [];
  const items: unknown = JSON.parse(raw);
  if (!Array.isArray(items) || !items.every(isVisit))
    throw new Error("Histórico local inválido. Os dados foram preservados.");
  return items;
}

function isVisit(value: unknown): value is Visit {
  if (!value || typeof value !== "object") return false;
  const v = value as Visit;
  const loc = v.location;
  return (
    typeof v.id === "string" &&
    typeof v.createdAt === "string" &&
    Number.isFinite(Date.parse(v.createdAt)) &&
    [v.farm, v.technician, v.crop, v.notes].every(
      (x) => typeof x === "string",
    ) &&
    ["Regular", "Atenção", "Crítico"].includes(v.condition) &&
    (v.photoUri === null || typeof v.photoUri === "string") &&
    Number.isFinite(v.peakG) &&
    v.peakG >= 0 &&
    (loc === null ||
      (typeof loc === "object" &&
        Number.isFinite(loc.latitude) &&
        Math.abs(loc.latitude) <= 90 &&
        Number.isFinite(loc.longitude) &&
        Math.abs(loc.longitude) <= 180 &&
        Number.isFinite(loc.capturedAt) &&
        (loc.accuracy === null ||
          (Number.isFinite(loc.accuracy) && loc.accuracy >= 0))))
  );
}
