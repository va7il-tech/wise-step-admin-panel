import QRCodeStyling from 'qr-code-styling';

/**
 * Brand QR factory: navy modules, rounded dots, org logo embedded in the center.
 * Used for both form share links and game join links.
 */
export function createBrandQr(data: string, size = 512): QRCodeStyling {
  return new QRCodeStyling({
    width: size,
    height: size,
    type: 'svg',
    data,
    image: '/logo.svg',
    margin: 8,
    qrOptions: {
      errorCorrectionLevel: 'H', // high correction so the center logo never breaks scanning
    },
    imageOptions: {
      crossOrigin: 'anonymous',
      margin: 6,
      imageSize: 0.35,
    },
    dotsOptions: {
      color: '#152837',
      type: 'rounded',
    },
    cornersSquareOptions: {
      color: '#152837',
      type: 'extra-rounded',
    },
    cornersDotOptions: {
      color: '#01B5B4',
      type: 'dot',
    },
    backgroundOptions: {
      color: '#FFFFFF',
    },
  });
}

export async function downloadQr(
  data: string,
  fileName: string,
  extension: 'png' | 'svg',
): Promise<void> {
  const qr = createBrandQr(data, 1024);
  await qr.download({ name: fileName, extension });
}
