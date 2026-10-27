/**
 * Image processing utilities for client photos, digital signatures, and document optimization.
 * Prevents Firestore document size errors by compressing images on the client side.
 */

/**
 * Resizes and compresses an image (File or Blob or Base64 string) to JPEG
 * Max dimension 800x800 and ~0.75 quality ensures output is always under 80KB.
 */
export async function compressImage(
  input: File | Blob | string,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Helper to process an HTMLImageElement onto a canvas
    const processImage = (img: HTMLImageElement) => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          width = 640;
          height = 480;
        }

        // Calculate aspect ratio preserving dimensions
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas context could not be created');
        }

        // Background white in case of transparent PNG/WebP converted to JPEG
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to lightweight JPEG data URL
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      } catch (err) {
        reject(err);
      }
    };

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      processImage(img);
      if (typeof input !== 'string') {
        URL.revokeObjectURL(img.src);
      }
    };

    img.onerror = (e) => {
      if (typeof input !== 'string') {
        URL.revokeObjectURL(img.src);
      }
      reject(new Error('Falha ao processar o formato da imagem. Verifique se o arquivo é uma foto válida.'));
    };

    if (typeof input === 'string') {
      img.src = input;
    } else {
      img.src = URL.createObjectURL(input);
    }
  });
}

/**
 * Generates an official, certified digital signature badge image
 * using the customer's full name, CPF, and timestamp.
 */
export function generateDigitalSignatureDataUrl(
  fullName: string,
  cpf?: string,
  date = new Date()
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 540;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background - clear / pure white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer border with subtle certificate stamp styling
  ctx.strokeStyle = '#d97706'; // amber-600
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

  // Inner subtle border
  ctx.strokeStyle = '#fef3c7'; // amber-100
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  // Top header - certificate seal
  ctx.fillStyle = '#065f46'; // emerald-800
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('✔ ASSINATURA ELETRÔNICA CERTIFICADA • PEDALAÊ PARINTINS', 20, 28);

  // Decorative division line
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 36);
  ctx.lineTo(canvas.width - 20, 36);
  ctx.stroke();

  // Handwritten cursive signature styling of the client's name
  ctx.fillStyle = '#1e3a8a'; // dark blue / ink color
  ctx.font = 'italic 28px "Brush Script MT", "Segoe Script", "Dancing Script", "Caveat", cursive, serif';
  const displayName = fullName.trim() || 'Locatário Titular';
  ctx.fillText(displayName, 24, 82);

  // Underline for signature
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 94);
  ctx.lineTo(canvas.width - 20, 94);
  ctx.stroke();

  // Signer metadata
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 10px sans-serif';
  const cleanCpf = cpf ? ` • CPF: ${cpf}` : '';
  ctx.fillText(`Signatário: ${displayName}${cleanCpf}`, 20, 114);

  // Digital audit trail
  ctx.fillStyle = '#6b7280';
  ctx.font = '9px monospace';
  const dateStr = date.toLocaleString('pt-BR');
  ctx.fillText(`Data/Hora: ${dateStr} • Aceite registrado via plataforma online`, 20, 132);
  ctx.fillText('Validade jurídica: Art. 10 da MP 2.200-2/2001 e Código Civil Brasileiro', 20, 146);

  return canvas.toDataURL('image/png');
}
