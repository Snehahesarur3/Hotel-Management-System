import type { ReportRange } from '@/types/reports'

export type CsvValue = string | number | boolean | null | undefined

export interface CsvColumn<T> {
  header: string
  value: (row: T) => CsvValue
}

/** Characters that make a spreadsheet treat a cell as a formula (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  let text = String(value)
  // Text that looks like a formula is prefixed with ' so spreadsheets show it instead of running it.
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * RFC 4180 CSV: header row, CRLF line endings, quoted fields where needed.
 * Numbers are written unformatted (1234.5, not ₹1,234.50) so spreadsheets can total them.
 */
export function toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string {
  const lines = [columns.map((c) => cell(c.header)), ...rows.map((row) => columns.map((c) => cell(c.value(row))))]
  return lines.map((line) => line.join(',')).join('\r\n') + '\r\n'
}

/** revenue-by-period_2026-10-14_to_2026-11-12.csv */
export function csvFilename(name: string, range: ReportRange): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug}_${range.from}_to_${range.to}.csv`
}

/** Saves CSV text as a file. A UTF-8 byte order mark makes Excel read non-ASCII names correctly. */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  // Revoke after the click has been handled, or some browsers cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
