declare module 'qrcode' {
  export interface QRCode {
    modules: {
      size: number
      data: Uint8Array
      /** Bit at (row, col). Row is y, column is x. */
      get(row: number, col: number): number
    }
  }

  interface QRCodeFactory {
    create(text: string, options?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' }): QRCode
  }

  const QRCode: QRCodeFactory
  export default QRCode
}
