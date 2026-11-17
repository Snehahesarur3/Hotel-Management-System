import { describe, expect, it } from 'vitest'
import { csvFilename, toCsv, type CsvColumn } from './csv'

interface Row {
  name: string
  amount: number
  note?: string
}

const columns: CsvColumn<Row>[] = [
  { header: 'Name', value: (r) => r.name },
  { header: 'Amount', value: (r) => r.amount },
  { header: 'Note', value: (r) => r.note },
]

describe('toCsv', () => {
  it('writes a header and one CRLF-terminated line per row', () => {
    expect(toCsv(columns, [{ name: 'Room', amount: 4500 }, { name: 'GST', amount: -540.5, note: 'refund' }])).toBe(
      'Name,Amount,Note\r\nRoom,4500,\r\nGST,-540.5,refund\r\n',
    )
  })

  it('quotes commas, quotes, line breaks and padded text', () => {
    const csv = toCsv(columns, [{ name: 'Clarke, Amelia', amount: 1, note: 'said "hi"\nbye' }, { name: ' padded', amount: 2 }])
    expect(csv).toBe('Name,Amount,Note\r\n"Clarke, Amelia",1,"said ""hi""\nbye"\r\n" padded",2,\r\n')
  })

  it('neutralises text that a spreadsheet would run as a formula', () => {
    const csv = toCsv(columns, [{ name: '=HYPERLINK("x")', amount: -5, note: '@SUM(A1)' }])
    expect(csv.split('\r\n')[1]).toBe(`"'=HYPERLINK(""x"")",-5,'@SUM(A1)`)
  })

  it('builds a file name from the report name and range', () => {
    expect(csvFilename('Revenue by period', { from: '2026-10-13', to: '2026-11-11' })).toBe('revenue-by-period_2026-10-13_to_2026-11-11.csv')
  })
})
