/**
 * Minimal CSV writer for the admin exports.
 *
 * Escapes quotes/commas/newlines, prefixes formula-looking cells so a
 * spreadsheet doesn't execute them, and downloads the result as a file.
 */
export type CsvCell = string | number | null | undefined;

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // Neutralise spreadsheet formula injection (=, +, -, @ at the start).
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Builds a CSV string from a header row and data rows. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(','));
  return lines.join('\r\n');
}

/** Triggers a browser download of the given CSV text. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** `coupons-2026-11-10` style file name stamp. */
export function csvStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
