/**
 * Utilitários para Geração e Manipulação do PIX (Padrão Banco Central do Brasil / EMV BR Code)
 * Compatível com todos os bancos: Nubank, Inter, Caixa, Itaú, Bradesco, BB, Mercado Pago, PicPay, etc.
 */

// Cálculo do CRC16-CCITT (Polinômio 0x1021, valor inicial 0xFFFF)
function calculateCRC16(payload: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Remove acentos e caracteres especiais para conformidade EMV
function sanitizeAscii(str: string, maxLength: number): string {
  const normalized = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim();
  return normalized.substring(0, maxLength);
}

// Formata campo no padrão TLV (Tag-Length-Value)
function formatTLV(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

export interface GeneratePixParams {
  pixKey: string;
  pixType?: string;
  beneficiaryName: string;
  city: string;
  amount: number;
  txId?: string;
}

/**
 * Gera a string oficial do "PIX Copia e Cola" (EMV BR Code)
 */
export function generatePixCopiaECola({
  pixKey,
  beneficiaryName,
  city,
  amount,
  txId = 'PEDALAE',
}: GeneratePixParams): string {
  const cleanKey = pixKey.trim();
  const cleanName = sanitizeAscii(beneficiaryName || 'PEDALAE BIKES', 25).toUpperCase();
  const cleanCity = sanitizeAscii(city || 'PARINTINS', 15).toUpperCase();
  const cleanTxId = sanitizeAscii(txId.replace(/[^a-zA-Z0-9]/g, '') || 'PEDALAE', 25);
  const formattedAmount = Number(amount || 0).toFixed(2);

  // Sub-campos Merchant Account Information (Tag 26)
  const maiGui = formatTLV('00', 'br.gov.bcb.pix');
  const maiKey = formatTLV('01', cleanKey);
  const merchantAccountInfo = formatTLV('26', `${maiGui}${maiKey}`);

  // Sub-campos Additional Data Field (Tag 62)
  const additionalData = formatTLV('62', formatTLV('05', cleanTxId));

  // Montagem do payload sem CRC
  let payload = '';
  payload += formatTLV('00', '01'); // Payload Format Indicator
  payload += merchantAccountInfo; // Tag 26
  payload += formatTLV('52', '0000'); // Merchant Category Code
  payload += formatTLV('53', '986'); // Transaction Currency (986 = BRL)
  if (amount > 0) {
    payload += formatTLV('54', formattedAmount); // Transaction Amount
  }
  payload += formatTLV('58', 'BR'); // Country Code
  payload += formatTLV('59', cleanName || 'PEDALAE'); // Merchant Name
  payload += formatTLV('60', cleanCity || 'PARINTINS'); // Merchant City
  payload += additionalData; // Additional Data Field
  payload += '6304'; // Tag CRC16 indicator

  // Calcula o CRC16 e anexa no final
  const crc = calculateCRC16(payload);
  return `${payload}${crc}`;
}

/**
 * Função segura para copiar texto no celular e desktop (com fallbacks para iOS Safari)
 */
export async function copyToClipboardSafe(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([40, 30, 40]);
        } catch {}
      }
      return true;
    }
  } catch (err) {
    console.warn('Erro ao copiar via navigator.clipboard:', err);
  }

  // Fallback com textarea invisível para iOS Safari e WebViews antigas
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Falha geral no fallback de cópia:', err);
    return false;
  }
}
