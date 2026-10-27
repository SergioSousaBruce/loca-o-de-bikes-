import { Reservation } from '../types';

// Número oficial informado pelo cliente: (93) 98125-0207
export const OFFICIAL_WHATSAPP_NUMBER = '5593981250207';
export const OFFICIAL_WHATSAPP_DISPLAY = '(93) 98125-0207';
export const OFFICIAL_WHATSAPP_LINK = `https://wa.me/${OFFICIAL_WHATSAPP_NUMBER}`;

/**
 * Constrói a mensagem padronizada oficial para envio de comprovante e reserva:
 *
 * "Olá! Fiz uma reserva no PEDALAÊ.
 *
 * Reserva: PED-000001
 *
 * Nome: João da Silva
 * Bike: Bike Verde
 * Data: 21/09/2026
 * Horário: 15:00
 * Duração: 2 horas
 * Valor: R$ 15,00
 *
 * Estou enviando o comprovante de pagamento."
 */
const WEEKDAY_NAMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export function getWeekdayNameFromDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return '';
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return WEEKDAY_NAMES[d.getDay()] || '';
}

export function buildReservationWhatsAppText(reservation: Reservation): string {
  const parts = reservation.date.split('-');
  const weekday = getWeekdayNameFromDate(reservation.date);
  const dateFormatted = parts.length === 3 
    ? `${parts[2]}/${parts[1]}/${parts[0]}${weekday ? ` (${weekday})` : ''}` 
    : reservation.date;

  const bikesText = reservation.groupBikesSummary 
    ? `🚲 *Bicicletas (${reservation.groupTotalBikes || 1}):* ${reservation.groupBikesSummary}`
    : `🚲 *Bicicleta:* ${reservation.bikeSnapshot.name} (${reservation.bikeSnapshot.code})`;

  const finalPrice = reservation.groupTotalPrice || reservation.totalPrice;
  const valorFormatted = finalPrice.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return `🚲 *NOVA RESERVA PEDALAÊ — PAGAMENTO PIX*
Olá! Fiz a reserva no site e estou enviando meus dados e o comprovante do PIX:

📋 *Código da Reserva:* ${reservation.code}
👤 *Cliente:* ${reservation.customerSnapshot.fullName}
🪪 *CPF:* ${reservation.customerSnapshot.cpf}
📱 *WhatsApp:* ${reservation.customerSnapshot.whatsapp}

${bikesText}
📅 *Data:* ${dateFormatted}
⏰ *Horário:* ${reservation.startTime} às ${reservation.endTime} (${reservation.durationHours} ${reservation.durationHours === 1 ? 'hora' : 'horas'})
💰 *Valor Total:* ${valorFormatted}

✍️ *Contrato com aceite e assinatura digital confirmados online no sistema.*
📎 *Estou enviando o comprovante do PIX em anexo nesta conversa para confirmação da reserva!*`;
}

/**
 * Constrói a mensagem completa com todos os detalhes da reserva para o próprio cliente guardar no seu WhatsApp.
 */
export function buildClientSelfSummaryWhatsAppText(reservation: Reservation): string {
  const parts = reservation.date.split('-');
  const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : reservation.date;
  const valorFormatted = reservation.totalPrice.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return `🚲 *MINHA RESERVA NO PEDALAÊ — PARINTINS/AM* 🌴
"ALUGUE. PEDALE. VIVA O MOMENTO."

📋 *Código:* ${reservation.code}
👤 *Cliente:* ${reservation.customerSnapshot.fullName}
🪪 *CPF:* ${reservation.customerSnapshot.cpf}

🚲 *Bicicleta:* ${reservation.bikeSnapshot.name} (${reservation.bikeSnapshot.code})
🎨 *Modelo/Cor:* ${reservation.bikeSnapshot.model} • ${reservation.bikeSnapshot.color}
📅 *Data:* ${dateFormatted}
⏰ *Horário:* ${reservation.startTime} às ${reservation.endTime} (${reservation.durationHours}h)
💰 *Valor Total:* ${valorFormatted}
💳 *Pagamento:* PIX Oficial

📍 *Ponto de Retirada:* Orla de Parintins - AM
*Apresente este comprovante ou o QR Code ao retirar a bike.*`;
}

/**
 * Gera o link direto com o número de WhatsApp oficial configurado e texto pré-preenchido.
 */
export function getWhatsAppReservationUrl(reservation: Reservation, customNumber?: string): string {
  let phone = customNumber ? customNumber.replace(/\D/g, '') : OFFICIAL_WHATSAPP_NUMBER;
  if (phone.length === 10 || phone.length === 11) {
    phone = `55${phone}`;
  }
  const text = encodeURIComponent(buildReservationWhatsAppText(reservation));
  return `https://wa.me/${phone}?text=${text}`;
}

/**
 * Constrói a mensagem enviada pelo Administrador (Sergio de Sousa Bruce) para o WhatsApp do cliente
 * confirmando o pagamento do PIX e enviando o Termo e Ficha de Locação em PDF assinado.
 */
export function buildAdminConfirmAndSendPdfWhatsAppText(reservation: Reservation): string {
  const parts = reservation.date.split('-');
  const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : reservation.date;
  const valorFormatted = reservation.totalPrice.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return `🚲 *PEDALAÊ — PAGAMENTO CONFIRMADO & BIKE LIBERADA!* 🌴
Olá, *${reservation.customerSnapshot.fullName}*! Aqui é o Sergio de Sousa Bruce do PEDALAÊ Parintins.

✅ Confirmamos o seu pagamento via PIX para a reserva *${reservation.code}*!
Estou anexando aqui o seu *Termo e Ficha Oficial de Locação em PDF* já com a minha assinatura oficial.

📋 *RESUMO DA SUA LOCAÇÃO:*
🚲 *Bicicleta:* ${reservation.bikeSnapshot.name} (${reservation.bikeSnapshot.code})
📅 *Data:* ${dateFormatted}
⏰ *Horário:* ${reservation.startTime} às ${reservation.endTime} (${reservation.durationHours} ${reservation.durationHours === 1 ? 'hora' : 'horas'})
💰 *Valor Pago:* ${valorFormatted} (PIX Confirmado)

📍 *Ponto de Retirada:* Orla de Parintins - AM
Tenha um ótimo passeio e aproveite a pedalada! Qualquer dúvida estamos à disposição.`;
}

/**
 * Gera o link direto para o WhatsApp do cliente com a mensagem de confirmação do Sergio Bruce.
 */
export function getWhatsAppSendTermToClientUrl(reservation: Reservation): string {
  let phone = reservation.customerSnapshot.whatsapp.replace(/\D/g, '');
  if (phone.length === 10 || phone.length === 11) {
    phone = `55${phone}`;
  }
  const text = encodeURIComponent(buildAdminConfirmAndSendPdfWhatsAppText(reservation));
  return `https://wa.me/${phone}?text=${text}`;
}
