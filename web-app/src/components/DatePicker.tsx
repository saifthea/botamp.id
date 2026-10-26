"use client";

import { useState } from "react";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
}

export default function DatePicker({ value, onChange, label, required }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  const parseValue = (v: string) => {
    if (!v) return { year: currentYear, month: new Date().getMonth(), day: new Date().getDate() };
    const [y, m, d] = v.split("-").map(Number);
    return { year: y || currentYear, month: (m || 1) - 1, day: d || 1 };
  };

  const parts = parseValue(value);
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

  const handleDayChange = (d: number) => {
    const maxDay = daysInMonth(parts.year, parts.month);
    const clampedDay = Math.min(d, maxDay);
    const newVal = `${parts.year}-${String(parts.month + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
    onChange(newVal);
  };

  const handleMonthChange = (m: number) => {
    const maxDay = daysInMonth(parts.year, m);
    const clampedDay = Math.min(parts.day, maxDay);
    const newVal = `${parts.year}-${String(m + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
    onChange(newVal);
  };

  const handleYearChange = (y: number) => {
    const maxDay = daysInMonth(y, parts.month);
    const clampedDay = Math.min(parts.day, maxDay);
    const newVal = `${y}-${String(parts.month + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
    onChange(newVal);
  };

  const years = Array.from({ length: 100 }, (_, i) => currentYear - 70 + i);

  const displayValue = value
    ? `${parts.day} ${months[parts.month]} ${parts.year}`
    : "Pilih tanggal lahir";

  return (
    <div className="relative">
      <label className="text-xs font-semibold text-zinc-500">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full p-2.5 border rounded-lg mt-1 text-left dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
      >
        <span className={value ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-400"}>
          {displayValue}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full left-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-3 w-64 space-y-3">
            {/* Year */}
            <div>
              <span className="text-xs text-zinc-500 font-medium mb-1 block">Tahun</span>
              <select
                value={parts.year}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="w-full p-2 border rounded-lg text-sm dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Month */}
            <div>
              <span className="text-xs text-zinc-500 font-medium mb-1 block">Bulan</span>
              <div className="grid grid-cols-4 gap-1">
                {months.map((m, i) => (
                  <button
                    key={m}
                    onClick={() => handleMonthChange(i)}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      parts.month === i
                        ? "bg-green-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-green-100 dark:hover:bg-green-900/30"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Day */}
            <div>
              <span className="text-xs text-zinc-500 font-medium mb-1 block">Tanggal</span>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: daysInMonth(parts.year, parts.month) }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    onClick={() => handleDayChange(d)}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      parts.day === d
                        ? "bg-green-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-green-100 dark:hover:bg-green-900/30"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
