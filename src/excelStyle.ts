// Helper xuất Excel có style (viền, header đậm, wrap-text, sọc xen kẽ) dùng chung
// cho các trang. Dựa trên xlsx-js-style (bản xlsx hỗ trợ style).

type ExportOpts = {
  filename: string
  sheet: string
  header: string[]
  rows: (string | number)[][]
  colWidths?: number[] // đơn vị "wch" (số ký tự)
}

const BORDER = {
  top: { style: 'thin', color: { rgb: 'D0D5DD' } },
  bottom: { style: 'thin', color: { rgb: 'D0D5DD' } },
  left: { style: 'thin', color: { rgb: 'D0D5DD' } },
  right: { style: 'thin', color: { rgb: 'D0D5DD' } },
}

export async function exportStyledXlsx(opts: ExportOpts) {
  const XLSX = await import('xlsx-js-style')
  const aoa = [opts.header, ...opts.rows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  const nCols = opts.header.length
  const nRows = aoa.length

  ws['!cols'] = (opts.colWidths ?? opts.header.map(() => 16)).map((w) => ({ wch: w }))
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  const rowHeights: { hpt: number }[] = []
  for (let r = 0; r < nRows; r++) {
    let maxLines = 1
    for (let c = 0; c < nCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      if (!cell) continue
      if (r === 0) {
        // Header: đậm, chữ trắng, nền xanh đậm, canh giữa.
        cell.s = {
          font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          fill: { fgColor: { rgb: '2E5266' } },
          border: BORDER,
        }
      } else {
        const zebra = r % 2 === 0 // sọc xen kẽ nhẹ
        cell.s = {
          alignment: { wrapText: true, vertical: 'top', horizontal: 'left' },
          fill: zebra ? { fgColor: { rgb: 'F5F8FA' } } : undefined,
          border: BORDER,
        }
        const lines = String(cell.v ?? '').split('\n').length
        if (lines > maxLines) maxLines = lines
      }
    }
    rowHeights.push({ hpt: r === 0 ? 22 : Math.max(17, maxLines * 15) })
  }
  ws['!rows'] = rowHeights

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, opts.sheet)
  XLSX.writeFile(wb, opts.filename)
}
