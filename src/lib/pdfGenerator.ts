import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { Reservation, SystemSettings } from '../types';

/**
 * Builds the complete jsPDF instance with official formatting,
 * client photo, QR Code, digital signature and Sergio de Sousa Bruce's validation stamp.
 */
export async function createReservationPDFDoc(
  reservation: Reservation,
  settings: SystemSettings
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Header Background
  doc.setFillColor(15, 15, 15);
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Gold accent bar
  doc.setFillColor(245, 184, 0); // #F5B800
  doc.rect(0, 42, pageWidth, 3, 'F');

  // Brand Name & Slogan
  doc.setTextColor(245, 184, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('PEDALAÊ', margin, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(settings.slogan || 'ALUGUE. PEDALE. VIVA O MOMENTO.', margin, 26);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text('PARINTINS - AM • LOCAÇÃO DE BIKES', margin, 32);

  // Reservation Code badge in header right
  doc.setFillColor(245, 184, 0);
  doc.roundedRect(pageWidth - margin - 50, 12, 50, 18, 2, 2, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Nº DA RESERVA', pageWidth - margin - 47, 18);
  doc.setFontSize(13);
  doc.text(reservation.code, pageWidth - margin - 47, 26);

  let y = 52;

  // Title of Document
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('TERMO E FICHA OFICIAL DE LOCAÇÃO', margin, y);
  y += 7;

  // Header badges: QR Code and Client Photo
  const rightX = pageWidth - margin;

  // 1. QR Code Generation (top right)
  try {
    const qrDataUrl = await QRCode.toDataURL(reservation.code, {
      margin: 1,
      width: 120,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    doc.addImage(qrDataUrl, 'PNG', rightX - 24, y - 6, 24, 24);
  } catch (err) {
    console.warn('QR code generation note:', err);
  }

  // 2. Client Photo (if present in customerSnapshot)
  const clientPhoto = reservation.customerSnapshot?.photoBase64;
  if (clientPhoto) {
    try {
      // Border container for photo
      doc.setFillColor(240, 240, 240);
      doc.roundedRect(rightX - 52, y - 6, 25, 25, 1.5, 1.5, 'F');
      doc.setDrawColor(245, 184, 0); // Gold border
      doc.setLineWidth(0.4);
      doc.roundedRect(rightX - 52, y - 6, 25, 25, 1.5, 1.5, 'S');

      // Add image inside box
      const format = clientPhoto.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(clientPhoto, format, rightX - 51.5, y - 5.5, 24, 24);

      // Label below photo
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('FOTO DO CLIENTE', rightX - 39.5, y + 22, { align: 'center' });
    } catch (photoErr) {
      console.warn('Client photo embed note:', photoErr);
    }
  }

  // Section 1: Customer Data
  const section1Width = clientPhoto ? contentWidth - 55 : contentWidth - 28;
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, section1Width, 6, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DADOS DO CLIENTE', margin + 3, y + 4.5);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);

  const client = reservation.customerSnapshot;
  doc.text(`Nome Completo: ${client.fullName}`, margin + 3, y);
  doc.text(`CPF: ${client.cpf}`, margin + 82, y);
  y += 5;
  doc.text(`WhatsApp: ${client.whatsapp}`, margin + 3, y);
  doc.text(`Data Nasc.: ${client.birthDate || 'Não informada'}`, margin + 82, y);
  y += 5;
  doc.text(`E-mail: ${client.email}`, margin + 3, y);
  y += 5;
  doc.text(`Endereço: ${client.fullAddress}`, margin + 3, y);
  y += 8;

  // Section 2: Bike & Reservation Data
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DADOS DA BIKE E DO PERÍODO', margin + 3, y + 4.5);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);

  const bike = reservation.bikeSnapshot;
  const parts = reservation.date.split('-').map(Number);
  const weekdayNames = ['Dom', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const weekdayStr = parts.length === 3 ? weekdayNames[new Date(parts[0], parts[1] - 1, parts[2]).getDay()] : '';
  const dateFormatted = parts.length === 3 
    ? `${String(parts[2]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[0]}${weekdayStr ? ` (${weekdayStr})` : ''}` 
    : reservation.date;

  const bikeLabel = reservation.groupBikesSummary 
    ? `Bikes (${reservation.groupTotalBikes || 1}): ${reservation.groupBikesSummary}`
    : `Bicicleta: ${bike.name} (${bike.code})`;

  doc.text(bikeLabel, margin + 3, y);
  if (!reservation.groupBikesSummary) {
    doc.text(`Modelo/Cor: ${bike.model} - ${bike.color}`, margin + 95, y);
  }
  y += 5;
  doc.text(`Data da Reserva: ${dateFormatted}`, margin + 3, y);
  doc.text(`Duração: ${reservation.durationHours} ${reservation.durationHours === 1 ? 'hora' : 'horas'}`, margin + 95, y);
  y += 5;
  doc.text(`Horário de Retirada: ${reservation.startTime}`, margin + 3, y);
  doc.text(`Devolução Prevista: ${reservation.endTime}`, margin + 95, y);
  y += 5;
  doc.text(
    `Devolução Efetiva: ${reservation.checkout?.checkedOutAt ? new Date(reservation.checkout.checkedOutAt).toLocaleTimeString('pt-BR') : 'Pendente'}`,
    margin + 3,
    y
  );
  doc.text(
    `Valor Total: ${(reservation.groupTotalPrice || reservation.totalPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
    margin + 95,
    y
  );
  y += 8;

  // Section 3: Status & Payment
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PAGAMENTO E STATUS OPERACIONAL', margin + 3, y + 4.5);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Forma de Pagamento: PIX (${settings.pixKey})`, margin + 3, y);
  doc.text(`Status Atual: ${reservation.status.toUpperCase().replace('_', ' ')}`, margin + 95, y);
  y += 5;
  doc.text(
    `Confirmação de Pagamento: ${reservation.paymentConfirmedAt ? new Date(reservation.paymentConfirmedAt).toLocaleString('pt-BR') : 'Aguardando verificação'}`,
    margin + 3,
    y
  );
  y += 8;

  // Section 4: Inspection (Retirada & Devolução)
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('FICHA DE VISTORIA: RETIRADA E DEVOLUÇÃO', margin + 3, y + 4.5);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const checkinTime = reservation.checkin?.checkedInAt
    ? new Date(reservation.checkin.checkedInAt).toLocaleString('pt-BR')
    : 'Não registrado';
  doc.text(
    `RETIRADA: Entregue em boas condições? [ ${reservation.checkin?.bikeConditionOk ? 'SIM' : '___'} ]  Data/Hora: ${checkinTime}`,
    margin + 3,
    y
  );
  y += 4.5;
  doc.text(`Resp. Retirada: ${reservation.checkin?.checkedInBy || 'Equipe Pedalaê'}  Obs: ${reservation.checkin?.notes || 'Nenhuma'}`, margin + 3, y);
  y += 6;

  const checkoutTime = reservation.checkout?.checkedOutAt
    ? new Date(reservation.checkout.checkedOutAt).toLocaleString('pt-BR')
    : 'Não registrado';
  doc.text(
    `DEVOLUÇÃO: Estado: [ ${reservation.checkout?.conditionStatus || 'Aguardando devolução'} ]  Data/Hora: ${checkoutTime}`,
    margin + 3,
    y
  );
  y += 4.5;
  doc.text(`Resp. Devolução: ${reservation.checkout?.checkedOutBy || 'Equipe Pedalaê'}  Obs: ${reservation.checkout?.notes || 'Nenhuma'}`, margin + 3, y);
  y += 9;

  // Section 5: Legal Term Summary
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 5, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('TERMO DE COMPROMISSO E RESPONSABILIDADE CIVIL', margin + 3, y + 3.8);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 50);
  const termSummary = `O LOCATÁRIO declara expressamente ter inspecionado a bicicleta acima descrita, atestando suas perfeitas condições mecânicas e de segurança. Assume integral e irrestrita responsabilidade civil e criminal pelo uso do equipamento durante o período de locação, inclusive por danos materiais, avarias, perda de peças, furto, roubo ou danos a terceiros. Compromete-se a respeitar as leis de trânsito e devolver o equipamento no horário previsto no PEDALAÊ em Parintins/AM.`;
  const splitText = doc.splitTextToSize(termSummary, contentWidth - 4);
  doc.text(splitText, margin + 2, y);
  y += splitText.length * 3.6 + 6;

  // Signature lines
  y = Math.max(y, 240);
  const colWidth = (contentWidth - 10) / 2;

  // Render client's online digital signature if present
  if (reservation.digitalSignatureUrl) {
    try {
      doc.addImage(reservation.digitalSignatureUrl, 'PNG', margin + 8, y - 16, 42, 14);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(30, 130, 60);
      const signedDate = reservation.digitalSignedAt 
        ? new Date(reservation.digitalSignedAt).toLocaleString('pt-BR')
        : new Date(reservation.createdAt).toLocaleString('pt-BR');
      doc.text(`[Assinado Digitalmente Online em ${signedDate}]`, margin + 3, y - 1);
    } catch (sigErr) {
      console.warn('Signature image embed note:', sigErr);
    }
  }

  // Render Administrator Signature for Sergio de Sousa Bruce
  const adminSignedDate = reservation.paymentConfirmedAt
    ? new Date(reservation.paymentConfirmedAt).toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR');

  // Stylish script representation of Sergio de Sousa Bruce signature
  doc.setFont('times', 'italic');
  doc.setFontSize(16);
  doc.setTextColor(20, 40, 120); // Professional signature blue ink color
  doc.text('Sergio de Sousa Bruce', margin + colWidth + 20, y - 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(40, 120, 60);
  doc.text(`[Validado & Assinado Digitalmente pelo Administrador em ${adminSignedDate}]`, margin + colWidth + 12, y - 1);

  doc.setDrawColor(120, 120, 120);
  doc.line(margin, y, margin + colWidth, y);
  doc.line(margin + colWidth + 10, y, margin + contentWidth, y);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('ASSINATURA DO CLIENTE / LOCATÁRIO', margin + 6, y);
  doc.text('SERGIO DE SOUSA BRUCE', margin + colWidth + 24, y);

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`CPF: ${client.cpf}`, margin + 6, y);
  doc.text(`Responsável PEDALAÊ Parintins • Data: ${adminSignedDate}`, margin + colWidth + 14, y);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `PEDALAÊ - Parintins/AM • ${settings.address} • WhatsApp: ${settings.whatsappDisplay}`,
    pageWidth / 2,
    288,
    { align: 'center' }
  );

  return doc;
}

export interface GeneratedPDFResult {
  blob: Blob;
  blobUrl: string;
  filename: string;
  doc: jsPDF;
}

/**
 * Generates the raw PDF Blob and temporary Object URL for downloading, sharing, or previewing.
 */
export async function generateReservationPDFBlob(
  reservation: Reservation,
  settings: SystemSettings
): Promise<GeneratedPDFResult> {
  const doc = await createReservationPDFDoc(reservation, settings);
  const rawBlob = doc.output('blob');
  const blob = new Blob([rawBlob], { type: 'application/pdf' });
  const filename = `Pedalae_Reserva_${reservation.code}.pdf`;
  const blobUrl = URL.createObjectURL(blob);
  return { blob, blobUrl, filename, doc };
}

export interface DownloadOrShareOptions {
  preferShare?: boolean;
}

export interface DownloadOrShareResult {
  success: boolean;
  method: 'share' | 'download' | 'tab';
  filename: string;
  blobUrl: string;
  error?: string;
}

/**
 * Battle-tested download or mobile share handler.
 * - On smartphones (iOS Safari / Android): Uses the native Web Share API with files whenever available,
 *   which opens the native share sheet directly ("Salvar em Arquivos", "WhatsApp", "Imprimir").
 * - Fallback: Triggers safe Blob URL download with target="_blank" fallback for mobile webviews.
 * - Guarantees error safety so the app never hangs or crashes silently.
 */
export async function downloadOrShareReservationPDF(
  reservation: Reservation,
  settings: SystemSettings,
  options?: DownloadOrShareOptions
): Promise<DownloadOrShareResult> {
  const { blob, blobUrl, filename } = await generateReservationPDFBlob(reservation, settings);

  const isMobile =
    typeof navigator !== 'undefined' &&
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (typeof window !== 'undefined' && 'ontouchstart' in window && window.innerWidth < 850));

  const shouldTryShare = options?.preferShare !== false && isMobile;

  // 1. Try Native Web Share API if supported on mobile devices
  if (shouldTryShare && typeof navigator !== 'undefined' && typeof File !== 'undefined' && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Termo de Locação Pedalaê (${reservation.code})`,
          text: `Termo e Ficha Oficial de Locação Pedalaê Parintins - Reserva ${reservation.code}`,
        });
        return { success: true, method: 'share', filename, blobUrl };
      }
    } catch (shareErr: any) {
      // User tapped "Cancel" / dismissed native share sheet
      if (shareErr.name === 'AbortError') {
        return { success: true, method: 'share', filename, blobUrl };
      }
      console.warn('Web Share attempt fallback to download:', shareErr);
    }
  }

  // 2. Direct Programmatic Download via Anchor with fallback
  try {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.rel = 'noopener noreferrer';
    // target="_blank" allows browsers that block <a download> on blobs (like iOS Safari or webviews) to open the PDF
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      try {
        document.body.removeChild(link);
      } catch {}
    }, 800);

    return { success: true, method: 'download', filename, blobUrl };
  } catch (dlErr: any) {
    console.warn('Download link trigger failed, attempting window.open:', dlErr);
    try {
      window.open(blobUrl, '_blank');
      return { success: true, method: 'tab', filename, blobUrl };
    } catch (openErr: any) {
      return {
        success: false,
        method: 'tab',
        filename,
        blobUrl,
        error: openErr?.message || 'Falha ao abrir PDF no navegador.',
      };
    }
  }
}

/**
 * Direct helper to open the reservation PDF in a new tab/window for instant mobile preview.
 */
export async function openReservationPDFInNewTab(
  reservation: Reservation,
  settings: SystemSettings
): Promise<string> {
  const { blobUrl } = await generateReservationPDFBlob(reservation, settings);
  window.open(blobUrl, '_blank');
  return blobUrl;
}

/**
 * Backward compatible entry point used throughout the project.
 */
export async function generateReservationPDF(
  reservation: Reservation,
  settings: SystemSettings
): Promise<void> {
  await downloadOrShareReservationPDF(reservation, settings);
}
