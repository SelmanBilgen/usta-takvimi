"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";

import { formatDate, parseDateInput } from "../lib/date-format";

export function DateField({
  label,
  value,
  onChange,
  name,
  min
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  min?: string;
}) {
  const [text, setText] = useState(value ? formatDate(value) : "");
  const [wasTouched, setWasTouched] = useState(false);
  const parsed = parseDateInput(text);
  const isInvalid = wasTouched && text.length > 0 && !parsed;

  useEffect(() => {
    if (value && parseDateInput(text) !== value) {
      setText(formatDate(value));
    } else if (!value && !text) {
      setText("");
    }
  }, [text, value]);

  function updateText(nextText: string) {
    setText(nextText);
    onChange(parseDateInput(nextText) ?? "");
  }

  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <span className="relative mt-1 block">
        <input
          type="text"
          value={text}
          onChange={(event) => updateText(event.target.value)}
          onBlur={() => {
            setWasTouched(true);
            const parsedValue = parseDateInput(text);
            if (parsedValue) setText(formatDate(parsedValue));
          }}
          placeholder="12 Ekim 2026"
          aria-invalid={isInvalid}
          className={`form-control pr-11 text-sm font-bold ${isInvalid ? "border-rose-500" : ""}`}
        />
        {name && <input type="hidden" name={name} value={value} />}
        <CalendarDays className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-[#397568]" />
        <input
          type="date"
          aria-label={`${label}, takvimden seç`}
          value={value}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-y-0 right-0 w-10 cursor-pointer opacity-0"
          tabIndex={-1}
        />
      </span>
      {isInvalid && <span className="mt-1 block text-xs font-normal text-rose-700">Örnek biçim: 12 Ekim 2026</span>}
    </label>
  );
}
