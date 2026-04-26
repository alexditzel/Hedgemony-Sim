import { useEffect, useState } from "react";
import type { ReadinessLevel } from "../engine";
import { READINESS_LEVELS } from "../engine";

interface ReadinessSliderProps {
  value: ReadinessLevel;
  onChange: (value: ReadinessLevel) => void;
  ariaLabel?: string;
}

const MIN_LEVEL = READINESS_LEVELS[0];
const MAX_LEVEL = READINESS_LEVELS[READINESS_LEVELS.length - 1];

function clampToValid(raw: number): ReadinessLevel {
  if (!Number.isFinite(raw)) return MIN_LEVEL;
  if (raw <= MIN_LEVEL) return MIN_LEVEL;
  if (raw >= MAX_LEVEL) return MAX_LEVEL;
  const stepped = Math.round(raw / 10) * 10;
  return (READINESS_LEVELS as readonly number[]).includes(stepped)
    ? (stepped as ReadinessLevel)
    : MIN_LEVEL;
}

export function ReadinessSlider({ value, onChange, ariaLabel = "Readiness" }: ReadinessSliderProps) {
  const [text, setText] = useState<string>(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  function commitText(next: string) {
    const parsed = Number.parseInt(next, 10);
    if (!Number.isFinite(parsed)) {
      setText(String(value));
      return;
    }
    const clamped = clampToValid(parsed);
    if (clamped !== value) onChange(clamped);
    setText(String(clamped));
  }

  return (
    <div className="readiness-slider">
      <input
        type="range"
        min={1}
        max={100}
        step={1}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => {
          const raw = Number.parseInt(event.target.value, 10);
          const next = clampToValid(raw);
          if (next !== value) onChange(next);
        }}
        className="readiness-slider__range"
        list="readiness-marks"
      />
      <datalist id="readiness-marks">
        {READINESS_LEVELS.map((level) => (
          <option key={level} value={level} label={`${level}%`} />
        ))}
      </datalist>
      <input
        type="number"
        className="readiness-slider__num"
        min={MIN_LEVEL}
        max={MAX_LEVEL}
        step={10}
        value={text}
        aria-label={`${ariaLabel} value`}
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => commitText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitText((event.target as HTMLInputElement).value);
          }
        }}
      />
      <span className="readiness-slider__suffix">%</span>
    </div>
  );
}
