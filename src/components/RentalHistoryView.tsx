/**
 * PEDALAÊ PARINTINS - ETAPA 6
 * Componente: HISTÓRICO DE LOCAÇÕES
 * 
 * - Visualização exclusiva para Administrador autenticado
 * - Lista todas as locações finalizadas (status: devolvida_finalizada)
 * - Exibe dados da bicicleta, cliente, telefone, data, horário de início, término, duração e status do rastreamento
 * - Modal detalhado com última latitude, longitude, precisão e horário registrados
 * - Filtros por período: TODAS | HOJE | ONTEM | ÚLTIMOS 7 DIAS | ÚLTIMOS 30 DIAS
 * - Filtros por bicicleta oficial e busca por cliente/telefone/código
 * - Indicadores operacionais: 🟢 EM USO, ⚪ DISPONÍVEIS, 🟡 RESERVADAS, 📋 LOCAÇÕES FINALIZADAS
 * - Isolamento total: cada locação possui sua própria sessão de rastreamento única
 */

import React, { useState, useMemo } from 'react';
import { 
  Bike as BikeIcon, 
  User as UserIcon, 
  Phone, 
  Calendar as CalendarIcon, 
  Clock, 
  Search, 
  Filter, 
  X, 
  ExternalLink, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  FileText,
  DollarSign,
  ChevronRight,
  Eye,
  Info
} from 'lucide-react';
import { Bike, CustomerData, Reservation, SystemSettings } from '../types';
import { getLocalDateString, getBikeCurrentStatus } from '../lib/bikeAvailability';
import { formatDurationHMS, parseDateTimeToEpoch } from '../lib/geoUtils';

interface RentalHistoryViewProps {
  settings: SystemSettings;
  bikes: Bike[];
  reservations: Reservation[];
  clients: CustomerData[];
}

type PeriodFilter = 'TODAS' | 'HOJE' | 'ONTEM' | '7DIAS' | '30DIAS';

export const RentalHistoryView: React.FC<RentalHistoryViewProps> = ({
  settings,
  bikes,
  reservations,
  clients,
}) => {
  // Filtros
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('TODAS');
  const [bikeFilter, setBikeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal de Detalhes
  const [selectedResForDetail, setSelectedResForDetail] = useState<Reservation | null>(null);

  // Data de hoje e ontem em formato YYYY-MM-DD
  const todayStr = useMemo(() => getLocalDateString(), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Limite de 7 dias e 30 dias
  const epoch7DaysAgo = useMemo(() => Date.now() - 7 * 24 * 60 * 60 * 1000, []);
  const epoch30DaysAgo = useMemo(() => Date.now() - 30 * 24 * 60 * 60 * 1000, []);

  // 1. INDICADORES DO PAINEL (Requisito 13)
  const stats = useMemo(() => {
    const inUseCount = reservations.filter((r) => r.status === 'bike_em_uso').length;
    const availableCount = bikes.filter((b) => getBikeCurrentStatus(b, reservations).isAvailable).length;
    const reservedCount = reservations.filter(
      (r) => (r.status === 'pagamento_confirmado' || r.status === 'aguardando_retirada') && r.date === todayStr
    ).length;
    const finishedCount = reservations.filter((r) => r.status === 'devolvida_finalizada').length;

    return {
      inUseCount,
      availableCount,
      reservedCount,
      finishedCount,
    };
  }, [bikes, reservations, todayStr]);

  // 2. LOCAÇÕES FINALIZADAS COM FILTROS
  const finishedReservations = useMemo(() => {
    return reservations.filter((r) => r.status === 'devolvida_finalizada');
  }, [reservations]);

  const filteredHistory = useMemo(() => {
    return finishedReservations.filter((res) => {
      // Filtro de Bicicleta
      if (bikeFilter !== 'all' && res.bikeId !== bikeFilter) {
        return false;
      }

      // Filtro de Período
      if (periodFilter === 'HOJE' && res.date !== todayStr) {
        return false;
      }
      if (periodFilter === 'ONTEM' && res.date !== yesterdayStr) {
        return false;
      }
      if (periodFilter === '7DIAS') {
        const resEpoch = parseDateTimeToEpoch(res.date, res.startTime);
        if (resEpoch < epoch7DaysAgo) return false;
      }
      if (periodFilter === '30DIAS') {
        const resEpoch = parseDateTimeToEpoch(res.date, res.startTime);
        if (resEpoch < epoch30DaysAgo) return false;
      }

      // Busca por texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = (res.code || '').toLowerCase().includes(q);
        const nameMatch = (res.customerSnapshot?.fullName || '').toLowerCase().includes(q);
        const phoneMatch = (res.customerSnapshot?.whatsapp || '').includes(q);
        const bikeMatch = (res.bikeSnapshot?.name || '').toLowerCase().includes(q) || (res.bikeSnapshot?.code || '').toLowerCase().includes(q);
        if (!codeMatch && !nameMatch && !phoneMatch && !bikeMatch) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => (b.checkout?.checkedOutAt || b.updatedAt || b.createdAt) - (a.checkout?.checkedOutAt || a.updatedAt || a.createdAt));
  }, [finishedReservations, bikeFilter, periodFilter, searchQuery, todayStr, yesterdayStr, epoch7DaysAgo, epoch30DaysAgo]);

  // Helpers de Formatação
  const formatTimeRange = (res: Reservation) => {
    const start = res.actualStartTime || res.startTime;
    const end = res.actualEndTime || res.endTime;
    return `${start} → ${end}`;
  };

  const calculateDurationStr = (res: Reservation) => {
    if (res.checkout?.checkedOutAt && res.checkin?.checkedInAt) {
      const elapsedMs = Math.max(0, res.checkout.checkedOutAt - res.checkin.checkedInAt);
      const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
      const mins = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
      if (hours === 0) return `${mins} min`;
      return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
    }
    return `${res.durationHours}h (${res.durationHours * 60} min)`;
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Auditoria e Histórico Completo</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <span>📋 HISTÓRICO DE LOCAÇÕES</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Registro definitivo de locações finalizadas, termos assinados e histórico operacional.
          </p>
        </div>
      </div>

      {/* INDICADORES EM TEMPO REAL (Requisito 13) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 🟢 EM USO */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-emerald-500/30 shadow-md">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <span>🟢 Em Uso</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono mt-1.5">
            {stats.inUseCount}
          </div>
          <div className="text-[10px] text-emerald-400/70 mt-0.5">Locações ativas agora</div>
        </div>

        {/* ⚪ DISPONÍVEIS */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-md">
          <div className="flex items-center justify-between text-zinc-300 text-xs font-bold uppercase tracking-wider">
            <span>⚪ Disponíveis</span>
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-zinc-200 font-mono mt-1.5">
            {stats.availableCount}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Bikes prontas para locação</div>
        </div>

        {/* 🟡 RESERVADAS */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-amber-500/30 shadow-md">
          <div className="flex items-center justify-between text-amber-400 text-xs font-bold uppercase tracking-wider">
            <span>🟡 Reservadas</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono mt-1.5">
            {stats.reservedCount}
          </div>
          <div className="text-[10px] text-amber-400/70 mt-0.5">Aguardando retirada hoje</div>
        </div>

        {/* 📋 LOCAÇÕES FINALIZADAS */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-purple-500/30 shadow-md">
          <div className="flex items-center justify-between text-purple-400 text-xs font-bold uppercase tracking-wider">
            <span>📋 Finalizadas</span>
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-400 font-mono mt-1.5">
            {stats.finishedCount}
          </div>
          <div className="text-[10px] text-purple-400/70 mt-0.5">Histórico completo de passeios</div>
        </div>
      </div>

      {/* BARRA DE FILTROS E PESQUISA (Requisito 14) */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Filtros de Período */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(['TODAS', 'HOJE', 'ONTEM', '7DIAS', '30DIAS'] as PeriodFilter[]).map((period) => {
              const labelMap: Record<PeriodFilter, string> = {
                TODAS: 'Todas',
                HOJE: 'Hoje',
                ONTEM: 'Ontem',
                '7DIAS': 'Últimos 7 dias',
                '30DIAS': 'Últimos 30 dias',
              };
              const isSelected = periodFilter === period;
              return (
                <button
                  key={period}
                  onClick={() => setPeriodFilter(period)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
                      : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {labelMap[period]}
                </button>
              );
            })}
          </div>

          {/* Filtro por Bicicleta */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 hidden sm:inline">Bicicleta:</span>
            <select
              value={bikeFilter}
              onChange={(e) => setBikeFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-400 font-medium"
            >
              <option value="all">Todas as 4 Bicicletas</option>
              {bikes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Campo de Busca Livre */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por nome do cliente, WhatsApp, CPF ou cód. PED-000001..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-zinc-500 hover:text-white text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* LISTA DE REGISTROS DO HISTÓRICO (Requisito 5) */}
      <div className="space-y-3">
        {filteredHistory.length === 0 ? (
          <div className="p-8 rounded-3xl bg-zinc-950 border border-zinc-800/80 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">Nenhuma locação finalizada encontrada</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              {searchQuery || periodFilter !== 'TODAS' || bikeFilter !== 'all'
                ? 'Tente ajustar os filtros de período, bicicleta ou termo de busca acima.'
                : 'Quando uma locação em andamento for encerrada no painel, seu histórico detalhado e telemetria serão arquivados aqui com total segurança.'}
            </p>
          </div>
        ) : (
          filteredHistory.map((res) => {
            const dateFormatted = res.date.split('-').reverse().join('/');
            const durationStr = calculateDurationStr(res);
            const timeRange = formatTimeRange(res);

            return (
              <div
                key={res.id}
                className="p-4 sm:p-5 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Informações da Bicicleta e Cliente */}
                <div className="flex items-start sm:items-center gap-3.5">
                  {res.bikeSnapshot.photoUrl ? (
                    <img
                      src={res.bikeSnapshot.photoUrl}
                      alt={res.bikeSnapshot.name}
                      className="w-12 h-12 rounded-2xl object-cover border border-amber-500/30 bg-zinc-900 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400 font-bold text-xs flex-shrink-0">
                      🚲
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        {res.code}
                      </span>
                      <span className="text-sm font-extrabold text-white">
                        {res.bikeSnapshot.name}
                      </span>
                      <span className="text-xs text-zinc-400 font-medium">
                        ({res.bikeSnapshot.code})
                      </span>
                    </div>

                    <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-zinc-200 font-semibold flex items-center gap-1">
                        <UserIcon className="w-3.5 h-3.5 text-amber-400" />
                        <span>{res.customerSnapshot.fullName}</span>
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-300 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-400" />
                        <span>{res.customerSnapshot.whatsapp}</span>
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-400 flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3 text-amber-400" />
                        <span>{dateFormatted}</span>
                      </span>
                    </div>

                    <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                      <span className="text-amber-300 font-mono font-medium bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        🕐 {timeRange}
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-300 font-semibold">
                        ⏱️ {durationStr}
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span>🔴 Rastreamento encerrado</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 self-end md:self-auto pt-2 md:pt-0 border-t md:border-t-0 border-zinc-900 w-full md:w-auto justify-end">
                  <button
                    onClick={() => setSelectedResForDetail(res)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 hover:border-amber-400 text-xs font-bold transition-all cursor-pointer shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span>Visualizar Detalhes</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ================= MODAL: DETALHES DO HISTÓRICO (Requisito 6) ================= */}
      {selectedResForDetail && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    {selectedResForDetail.code}
                  </span>
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Registro de Locação Concluída
                  </span>
                </div>
                <h3 className="font-black text-white text-lg mt-1">
                  Detalhes da Locação e Telemetria
                </h3>
              </div>
              <button
                onClick={() => setSelectedResForDetail(null)}
                className="text-zinc-400 hover:text-white p-2 rounded-xl bg-zinc-900 border border-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informações da Bicicleta */}
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <BikeIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Bicicleta Oficial da Frota</span>
              </h4>
              <div className="flex items-center gap-3">
                {selectedResForDetail.bikeSnapshot.photoUrl && (
                  <img
                    src={selectedResForDetail.bikeSnapshot.photoUrl}
                    alt={selectedResForDetail.bikeSnapshot.name}
                    className="w-14 h-14 rounded-2xl object-cover border border-amber-500/30 bg-zinc-950"
                  />
                )}
                <div>
                  <h3 className="text-sm font-black text-white">
                    {selectedResForDetail.bikeSnapshot.name}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {selectedResForDetail.bikeSnapshot.model} • Cor: {selectedResForDetail.bikeSnapshot.color || 'Padrão'}
                  </p>
                  <p className="text-[11px] text-amber-400 font-mono mt-0.5">
                    Código: {selectedResForDetail.bikeSnapshot.code}
                  </p>
                </div>
              </div>
            </div>

            {/* Informações do Cliente */}
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Dados do Cliente</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zinc-500">Nome:</span>{' '}
                  <strong className="text-white">{selectedResForDetail.customerSnapshot.fullName}</strong>
                </div>
                <div>
                  <span className="text-zinc-500">CPF:</span>{' '}
                  <strong className="text-zinc-300 font-mono">{selectedResForDetail.customerSnapshot.cpf}</strong>
                </div>
                <div>
                  <span className="text-zinc-500">WhatsApp:</span>{' '}
                  <a
                    href={`https://wa.me/55${selectedResForDetail.customerSnapshot.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 font-bold hover:underline inline-flex items-center gap-1"
                  >
                    <span>{selectedResForDetail.customerSnapshot.whatsapp}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div>
                  <span className="text-zinc-500">E-mail:</span>{' '}
                  <span className="text-zinc-300">{selectedResForDetail.customerSnapshot.email || 'Não informado'}</span>
                </div>
              </div>
            </div>

            {/* Tempos e Horários */}
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Horários e Duração da Corrida</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80">
                  <span className="text-zinc-500 block text-[10px]">Data:</span>
                  <span className="text-white font-bold">{selectedResForDetail.date.split('-').reverse().join('/')}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80">
                  <span className="text-zinc-500 block text-[10px]">Início:</span>
                  <span className="text-white font-mono font-bold">{selectedResForDetail.actualStartTime || selectedResForDetail.startTime}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80">
                  <span className="text-zinc-500 block text-[10px]">Encerramento:</span>
                  <span className="text-white font-mono font-bold">{selectedResForDetail.actualEndTime || selectedResForDetail.endTime}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80">
                  <span className="text-zinc-500 block text-[10px]">Duração:</span>
                  <span className="text-amber-400 font-bold">{calculateDurationStr(selectedResForDetail)}</span>
                </div>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedResForDetail(null)}
                className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-bold text-xs"
              >
                Fechar Detalhes
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
