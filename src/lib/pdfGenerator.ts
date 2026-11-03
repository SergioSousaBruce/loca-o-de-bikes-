import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { Reservation, SystemSettings, CustomerData } from '../types';

/**
 * Universal safe helper to trigger a browser file download without premature revoke.
 * Works seamlessly across Chrome, Firefox, Safari, Edge, Android Chrome and iOS Safari.
 */
export function downloadBlobAsFile(blob: Blob, filename: string): { success: boolean; blobUrl: string } {
  const blobUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      try {
        if (link.parentNode) {
          document.body.removeChild(link);
        }
      } catch {}
    }, 2000);

    // Keep object URL active for 5 minutes so user can open/save/re-download without failure
    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {}
    }, 300000);

    return { success: true, blobUrl };
  } catch (err) {
    console.warn('downloadBlobAsFile fallback error:', err);
    try {
      window.open(blobUrl, '_blank');
    } catch {}
    return { success: false, blobUrl };
  }
}

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
  doc.text(reservation.code || 'PEDALA-000', pageWidth - margin - 47, 26);

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
    const qrDataUrl = await QRCode.toDataURL(reservation.code || 'PEDALA-000', {
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
  const clientPhoto = reservation.customerSnapshot?.photoBase64 || reservation.customerSnapshot?.photoUrl;
  if (clientPhoto && typeof clientPhoto === 'string' && clientPhoto.startsWith('data:image')) {
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

  const client = reservation.customerSnapshot || {
    fullName: 'Cliente Pedalaê',
    cpf: 'Não informado',
    whatsapp: 'Não informado',
    birthDate: '',
    email: '',
    fullAddress: '',
  };
  doc.text(`Nome Completo: ${client.fullName || 'Não informado'}`, margin + 3, y);
  doc.text(`CPF: ${client.cpf || 'Não informado'}`, margin + 82, y);
  y += 5;
  doc.text(`WhatsApp: ${client.whatsapp || 'Não informado'}`, margin + 3, y);
  doc.text(`Data Nasc.: ${client.birthDate || 'Não informada'}`, margin + 82, y);
  y += 5;
  doc.text(`E-mail: ${client.email || 'Não informado'}`, margin + 3, y);
  y += 5;
  doc.text(`Endereço: ${client.fullAddress || 'Parintins - AM'}`, margin + 3, y);
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

  const bike = reservation.bikeSnapshot || {
    name: 'Bicicleta Pedalaê',
    code: 'BK-01',
    model: 'Urbana',
    color: 'Amarela',
  };
  const parts = reservation.date ? reservation.date.split('-').map(Number) : [];
  const weekdayNames = ['Dom', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const weekdayStr = parts.length === 3 ? weekdayNames[new Date(parts[0], parts[1] - 1, parts[2]).getDay()] : '';
  const dateFormatted = parts.length === 3 
    ? `${String(parts[2]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[0]}${weekdayStr ? ` (${weekdayStr})` : ''}` 
    : (reservation.date || 'Data da Locação');

  const bikeLabel = reservation.groupBikesSummary 
    ? `Bikes (${reservation.groupTotalBikes || 1}): ${reservation.groupBikesSummary}`
    : `Bicicleta: ${bike.name || 'Bicicleta'} (${bike.code || 'BK-01'})`;

  doc.text(bikeLabel, margin + 3, y);
  if (!reservation.groupBikesSummary) {
    doc.text(`Modelo/Cor: ${bike.model || ''} - ${bike.color || ''}`, margin + 95, y);
  }
  y += 5;
  doc.text(`Data da Reserva: ${dateFormatted}`, margin + 3, y);
  doc.text(`Duração: ${reservation.durationHours || 1} ${(reservation.durationHours || 1) === 1 ? 'hora' : 'horas'}`, margin + 95, y);
  y += 5;
  doc.text(`Horário de Retirada: ${reservation.startTime || '16:00'}`, margin + 3, y);
  doc.text(`Devolução Prevista: ${reservation.endTime || '17:00'}`, margin + 95, y);
  y += 5;
  doc.text(
    `Devolução Efetiva: ${reservation.checkout?.checkedOutAt ? new Date(reservation.checkout.checkedOutAt).toLocaleTimeString('pt-BR') : 'Pendente'}`,
    margin + 3,
    y
  );
  doc.text(
    `Valor Total: ${(reservation.groupTotalPrice || reservation.totalPrice || 10).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
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
  doc.text(`Status Atual: ${(reservation.status || 'aguardando_pagamento').toUpperCase().replace('_', ' ')}`, margin + 95, y);
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
  if (reservation.digitalSignatureUrl && reservation.digitalSignatureUrl.startsWith('data:image')) {
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
  doc.text(`CPF: ${client.cpf || ''}`, margin + 6, y);
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

/**
 * Builds the official Customer Registration Sheet PDF ("Ficha Cadastral do Cliente").
 */
export async function createCustomerCardPDFDoc(
  customer: CustomerData,
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
  doc.setFillColor(245, 184, 0);
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
  doc.text('PARINTINS - AM • SISTEMA DE GESTÃO DE CLIENTES', margin, 32);

  // Client badge in header right
  doc.setFillColor(245, 184, 0);
  doc.roundedRect(pageWidth - margin - 58, 12, 58, 18, 2, 2, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CADASTRO PERMANENTE', pageWidth - margin - 55, 18);
  doc.setFontSize(10.5);
  doc.text(customer.cpf ? `CPF: ${customer.cpf.slice(0, 11)}` : 'CLIENTE OFICIAL', pageWidth - margin - 55, 26);

  let y = 52;

  // Title of Document
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('FICHA CADASTRAL PERMANENTE DO CLIENTE', margin, y);
  y += 7;

  // Header badges: QR Code and Client Photo
  const rightX = pageWidth - margin;

  // 1. QR Code Generation (top right)
  try {
    const qrDataUrl = await QRCode.toDataURL(`PEDALAE-CLIENTE-${customer.cpf || customer.fullName || '000'}`, {
      margin: 1,
      width: 120,
      color: { dark: '#000000', light: '#ffffff' },
    });
    doc.addImage(qrDataUrl, 'PNG', rightX - 24, y - 6, 24, 24);
  } catch (err) {
    console.warn('QR code generation note:', err);
  }

  // 2. Client Photo
  const clientPhoto = customer.photoBase64 || customer.photoUrl;
  if (clientPhoto && typeof clientPhoto === 'string' && clientPhoto.startsWith('data:image')) {
    try {
      doc.setFillColor(240, 240, 240);
      doc.roundedRect(rightX - 54, y - 6, 26, 26, 1.5, 1.5, 'F');
      doc.setDrawColor(245, 184, 0);
      doc.setLineWidth(0.4);
      doc.roundedRect(rightX - 54, y - 6, 26, 26, 1.5, 1.5, 'S');

      const format = clientPhoto.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(clientPhoto, format, rightX - 53, y - 5, 24, 24);

      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('FOTO DO CLIENTE', rightX - 41, y + 23, { align: 'center' });
    } catch (photoErr) {
      console.warn('Client photo embed note:', photoErr);
    }
  }

  // Section 1: Dados Pessoais
  const section1Width = clientPhoto ? contentWidth - 58 : contentWidth - 28;
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, section1Width, 6, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('1. DADOS DE IDENTIFICAÇÃO E CONTATO', margin + 3, y + 4.5);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);

  doc.text(`Nome Completo: ${customer.fullName || 'Não informado'}`, margin + 3, y);
  y += 5.5;
  doc.text(`CPF: ${customer.cpf || 'Não informado'}`, margin + 3, y);
  doc.text(`Data de Nasc.: ${customer.birthDate || 'Não informada'}`, margin + 75, y);
  y += 5.5;
  doc.text(`WhatsApp: ${customer.whatsapp || 'Não informado'}`, margin + 3, y);
  doc.text(`E-mail: ${customer.email || 'Não informado'}`, margin + 75, y);
  y += 5.5;
  doc.text(`Endereço Completo: ${customer.fullAddress || 'Parintins - AM'}`, margin + 3, y);
  y += 9;

  // Section 2: Histórico e Estatísticas
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('2. HISTÓRICO DE LOCAÇÕES E REGISTRO', margin + 3, y + 4.5);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);

  const registeredAtStr = customer.createdAt 
    ? new Date(customer.createdAt).toLocaleDateString('pt-BR') 
    : 'Registro Permanente';
  const lastReservationStr = customer.lastReservationAt
    ? new Date(customer.lastReservationAt).toLocaleDateString('pt-BR')
    : 'Locação Ativa';

  doc.text(`Total de Locações Registradas: ${customer.totalReservations || 1}`, margin + 3, y);
  doc.text(`Data do Cadastro: ${registeredAtStr}`, margin + 95, y);
  y += 5.5;
  doc.text(`Última Atividade: ${lastReservationStr}`, margin + 3, y);
  doc.text(`Status do Cadastro: ATIVO E REGULAR`, margin + 95, y);
  y += 9;

  // Section 3: Termo de Responsabilidade & Veracidade
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 5.5, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('3. DECLARAÇÃO DE RESPONSABILIDADE E PROTEÇÃO DE DADOS', margin + 3, y + 4);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  const termSummary = `O CLIENTE declara expressamente que todas as informações e dados cadastrais fornecidos ao PEDALAÊ são exatos, autênticos e verdadeiros. O cliente autoriza o armazenamento seguro de seus dados para fins exclusivos de gestão de locações, controle operacional de bicicletas, emissão de termos e comprovantes, e comunicação via WhatsApp, em estrita conformidade com a LGPD. O titular do cadastro tem ciência de que é integralmente responsável pelo uso das bicicletas locadas sob seu cadastro em Parintins/AM.`;
  const splitText = doc.splitTextToSize(termSummary, contentWidth - 4);
  doc.text(splitText, margin + 2, y);
  y += splitText.length * 3.8 + 8;

  // Signatures
  y = Math.max(y, 220);
  const colWidth = (contentWidth - 10) / 2;

  const todayStr = new Date().toLocaleDateString('pt-BR');

  // Sergio Bruce signature script
  doc.setFont('times', 'italic');
  doc.setFontSize(16);
  doc.setTextColor(20, 40, 120);
  doc.text('Sergio de Sousa Bruce', margin + colWidth + 20, y - 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(40, 120, 60);
  doc.text(`[Cadastro Homologado pelo Administrador em ${todayStr}]`, margin + colWidth + 12, y - 1);

  doc.setDrawColor(120, 120, 120);
  doc.line(margin, y, margin + colWidth, y);
  doc.line(margin + colWidth + 10, y, margin + contentWidth, y);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('ASSINATURA DO CLIENTE', margin + 6, y);
  doc.text('SERGIO DE SOUSA BRUCE', margin + colWidth + 24, y);

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`Nome: ${customer.fullName || ''}`, margin + 6, y);
  doc.text(`Responsável PEDALAÊ Parintins/AM`, margin + colWidth + 22, y);

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
  const filename = `Pedalae_Reserva_${reservation.code || 'DOC'}.pdf`;
  const blobUrl = URL.createObjectURL(blob);
  return { blob, blobUrl, filename, doc };
}

/**
 * Generates the raw Customer Ficha PDF Blob and temporary Object URL.
 */
export async function generateCustomerPDFBlob(
  customer: CustomerData,
  settings: SystemSettings
): Promise<GeneratedPDFResult> {
  const doc = await createCustomerCardPDFDoc(customer, settings);
  const rawBlob = doc.output('blob');
  const blob = new Blob([rawBlob], { type: 'application/pdf' });
  const cleanName = (customer.fullName || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Pedalae_Ficha_Cliente_${cleanName}.pdf`;
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
 * Robust download or mobile share handler for Reservations.
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
      if (shareErr.name === 'AbortError') {
        return { success: true, method: 'share', filename, blobUrl };
      }
      console.warn('Web Share attempt fallback to download:', shareErr);
    }
  }

  // 2. Direct Programmatic Download via Anchor
  try {
    downloadBlobAsFile(blob, filename);
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
 * Robust download or mobile share handler for Customer Registration Sheet.
 */
export async function downloadOrShareCustomerPDF(
  customer: CustomerData,
  settings: SystemSettings,
  options?: DownloadOrShareOptions
): Promise<DownloadOrShareResult> {
  const { blob, blobUrl, filename } = await generateCustomerPDFBlob(customer, settings);

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
          title: `Ficha Cadastral Pedalaê (${customer.fullName})`,
          text: `Ficha Cadastral Oficial Pedalaê Parintins - ${customer.fullName}`,
        });
        return { success: true, method: 'share', filename, blobUrl };
      }
    } catch (shareErr: any) {
      if (shareErr.name === 'AbortError') {
        return { success: true, method: 'share', filename, blobUrl };
      }
      console.warn('Web Share attempt fallback to download:', shareErr);
    }
  }

  // 2. Direct Programmatic Download via Anchor
  try {
    downloadBlobAsFile(blob, filename);
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

