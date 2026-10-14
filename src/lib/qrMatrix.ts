import QRCode from 'qrcode'

/** Quiet modules around the symbol so a phone camera can lock onto a printed sheet. */
export const QR_QUIET = 4

export interface QrMatrix {
  readonly size: number
  /** Dark module at column x, row y. Matches the library's SVG renderer. */
  readonly dark: (x: number, y: number) => boolean
}

export function qrMatrix(text: string): QrMatrix {
  if (text.length === 0) throw new Error('QR text is required')
  const code = QRCode.create(text, { errorCorrectionLevel: 'Q' })
  const size = code.modules.size
  return {
    size,
    dark: (x, y) => Boolean(code.modules.get(y, x)),
  }
}
