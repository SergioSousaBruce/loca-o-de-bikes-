import { Bike, Reservation } from '../types';

export interface BikeUsageStatus {
  isAvailable: boolean;
  isInUse: boolean;
  isMaintenance: boolean;
  statusBadgeText: string;
  statusBadgeColor: 'emerald' | 'rose' | 'amber' | 'zinc';
  availabilityNotice: string;
  remainingMinutes?: number;
  endTime?: string;
  activeReservation?: Reservation;
}

/**
 * Converte "HH:mm" para minutos totais desde 00:00
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Retorna a data local no formato YYYY-MM-DD
 */
export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Avalia em tempo real se uma bicicleta está em uso / reservada com pagamento confirmado
 * para hoje ou neste exato momento, e quando ela voltará a ficar disponível.
 */
export function getBikeCurrentStatus(bike: Bike, reservations: Reservation[]): BikeUsageStatus {
  if (bike.status === 'maintenance') {
    return {
      isAvailable: false,
      isInUse: false,
      isMaintenance: true,
      statusBadgeText: 'MANUTENÇÃO',
      statusBadgeColor: 'rose',
      availabilityNotice: 'Bike em revisão preventiva no momento.',
    };
  }

  if (bike.status === 'inactive') {
    return {
      isAvailable: false,
      isInUse: false,
      isMaintenance: true,
      statusBadgeText: 'INDISPONÍVEL',
      statusBadgeColor: 'zinc',
      availabilityNotice: 'Bicicleta temporariamente indisponível.',
    };
  }

  const todayStr = getLocalDateString();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Procurar reservas desta bike que estejam pagas ou ativas para a data de hoje
  const relevantReservations = reservations.filter((r) => {
    if (r.bikeId !== bike.id) return false;
    if (r.status === 'cancelada') return false;
    
    // Status que indicam que a bike está paga, pronta ou em uso efetivo
    const isActiveStatus = 
      r.status === 'bike_em_uso' || 
      r.status === 'bike_retirada' || 
      r.status === 'pagamento_confirmado' ||
      r.status === 'aguardando_retirada';

    if (!isActiveStatus) return false;

    // Se é para a data de hoje
    return r.date === todayStr;
  });

  // Ordenar por horário de término
  relevantReservations.sort((a, b) => timeToMinutes(b.endTime) - timeToMinutes(a.endTime));

  // Verificar se há uma reserva em andamento ou paga para hoje cujo horário ainda não passou
  const currentOrUpcomingRes = relevantReservations.find((r) => {
    const endM = timeToMinutes(r.endTime);
    // Se o status é explicitamente 'bike_em_uso' ou se o horário de término ainda não foi superado em mais de 15 minutos
    return r.status === 'bike_em_uso' || r.status === 'bike_retirada' || endM > currentMinutes - 15;
  });

  if (currentOrUpcomingRes) {
    const endMinutes = timeToMinutes(currentOrUpcomingRes.endTime);
    const diffMinutes = endMinutes - currentMinutes;

    let timeNotice = '';
    if (diffMinutes > 0) {
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      if (hours > 0) {
        timeNotice = `daqui a ${hours}h${mins > 0 ? ` e ${mins}min` : ''} (às ${currentOrUpcomingRes.endTime})`;
      } else {
        timeNotice = `daqui a ${mins} min (às ${currentOrUpcomingRes.endTime})`;
      }
    } else {
      timeNotice = `em instantes (finalizando devolução prevista para ${currentOrUpcomingRes.endTime})`;
    }

    return {
      isAvailable: false,
      isInUse: true,
      isMaintenance: false,
      statusBadgeText: 'BIKE EM USO',
      statusBadgeColor: 'rose',
      availabilityNotice: `Estará disponível quando o cliente terminar de usar ${timeNotice}.`,
      remainingMinutes: Math.max(0, diffMinutes),
      endTime: currentOrUpcomingRes.endTime,
      activeReservation: currentOrUpcomingRes,
    };
  }

  return {
    isAvailable: true,
    isInUse: false,
    isMaintenance: false,
    statusBadgeText: 'DISPONÍVEL',
    statusBadgeColor: 'emerald',
    availabilityNotice: 'Pronta para pedalar e disponível para reserva agora!',
  };
}
