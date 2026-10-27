import React from 'react';
import { 
  Trophy, 
  MapPin, 
  Clock, 
  Gauge, 
  Share2, 
  Check, 
  MessageCircle, 
  Sparkles, 
  ChevronRight,
  Route as RouteIcon
} from 'lucide-react';
import { Reservation, SystemSettings } from '../types';
import { formatDurationHMS } from '../lib/geoUtils';

interface RideSummaryModalProps {
  reservation: Reservation;
  settings: SystemSettings;
  onClose: () => void;
  onShareWhatsApp: () => void;
}

export const RideSummaryModal: React.FC<RideSummaryModalProps> = ({
  reservation,
  settings,
  onClose,
  onShareWhatsApp,
}) => {
  const stats = reservation.rideStats;
  const distanceKm = stats?.distanceKm ? stats.distanceKm.toFixed(1) : '0.0';
  const avgSpeed = stats?.avgSpeedKmH ? stats.avgSpeedKmH.toFixed(1) : '0.0';

  // Calculate elapsed time from timestamps or duration hours
  let durationFormatted = '00:00:00';
  if (stats?.startedAtEpoch && stats?.endedAtEpoch) {
    const totalSecs = Math.max(0, Math.floor((stats.endedAtEpoch - stats.startedAtEpoch) / 1000));
    durationFormatted = formatDurationHMS(totalSecs);
  } else {
    durationFormatted = `${reservation.durationHours}h 00min`;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-lg bg-zinc-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-white relative">
        {/* Celebration Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-300 text-black rounded-full flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
            <Trophy className="w-9 h-9 stroke-[2.5]" />
          </div>
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block">
            Pedalaê — Parintins/AM
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            🎉 PEDAL CONCLUÍDO!
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Parabéns pela pedalada! Confira o resumo da sua experiência em Parintins:
          </p>
        </div>

        {/* Bike Snapshot Card */}
        <div className="flex items-center gap-4 bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
          <img
            src={reservation.bikeSnapshot.photoUrl}
            alt={reservation.bikeSnapshot.name}
            className="w-16 h-16 rounded-xl object-cover border border-amber-500/40 flex-shrink-0"
          />
          <div>
            <div className="text-[11px] font-mono text-amber-400 font-bold uppercase">
              {reservation.bikeSnapshot.code}
            </div>
            <div className="text-sm font-black text-white">
              {reservation.bikeSnapshot.name}
            </div>
            <div className="text-xs text-zinc-400">
              {reservation.bikeSnapshot.model} • {reservation.bikeSnapshot.color}
            </div>
          </div>
        </div>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
          <div className="bg-black/60 border border-zinc-800 p-3 sm:p-4 rounded-2xl">
            <div className="flex items-center justify-center text-amber-400 mb-1">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-zinc-400 uppercase block font-medium">Tempo</span>
            <span className="text-base sm:text-lg font-black text-white font-mono">
              {durationFormatted}
            </span>
          </div>

          <div className="bg-black/60 border border-zinc-800 p-3 sm:p-4 rounded-2xl">
            <div className="flex items-center justify-center text-emerald-400 mb-1">
              <RouteIcon className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-zinc-400 uppercase block font-medium">Distância</span>
            <span className="text-base sm:text-lg font-black text-white font-mono">
              {distanceKm} <span className="text-xs font-normal text-zinc-400">km</span>
            </span>
          </div>

          <div className="bg-black/60 border border-zinc-800 p-3 sm:p-4 rounded-2xl">
            <div className="flex items-center justify-center text-blue-400 mb-1">
              <Gauge className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-zinc-400 uppercase block font-medium">Vel. Média</span>
            <span className="text-base sm:text-lg font-black text-white font-mono">
              {avgSpeed} <span className="text-xs font-normal text-zinc-400">km/h</span>
            </span>
          </div>
        </div>

        {/* Station Confirmation */}
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-emerald-200">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold block text-white">Bicicleta devolvida no Ponto Pedalaê</span>
            <span className="text-[11px] text-emerald-300/80">
              {settings.address || 'Praça da Catedral / Orla de Parintins - AM'}
            </span>
          </div>
        </div>

        {/* Instagram Tag Prompt */}
        <div className="bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-zinc-950 border border-pink-500/40 rounded-2xl p-4 text-center space-y-1.5">
          <span className="text-xs font-black uppercase text-pink-300 tracking-wider flex items-center justify-center gap-1.5">
            📸 Marque o @pedalae.parintins
          </span>
          <p className="text-[11px] text-zinc-300">
            Tirou belas fotos nos pontos turísticos de Parintins? Poste no seu Instagram e marque a gente para aparecer em nossos destaques!
          </p>
          <a
            href={settings.instagramUrl || "https://www.instagram.com/pedalae.parintins?stkn=MTl4YmZrMnM4MDhpYg=="}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold text-pink-400 hover:text-pink-300 pt-1"
          >
            <span>Ver Instagram Oficial @pedalae.parintins ↗</span>
          </a>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <button
            onClick={onShareWhatsApp}
            className="w-full py-4 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/25 active:scale-98 transition-all"
          >
            <Share2 className="w-4 h-4" />
            <span>COMPARTILHAR MEU PEDAL</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors"
          >
            Fechar Resumo
          </button>
        </div>
      </div>
    </div>
  );
};
