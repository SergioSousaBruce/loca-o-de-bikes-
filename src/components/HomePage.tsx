import React from 'react';
import { 
  ArrowRight, 
  Clock, 
  Calendar, 
  Bike as BikeIcon, 
  CreditCard, 
  Smartphone, 
  CheckCircle2, 
  MapPin, 
  Sun, 
  Flame, 
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Camera,
  Share2,
  Lock,
  X,
  Check
} from 'lucide-react';
import { Bike, CustomerData, RentalPlan, Reservation, SystemSettings } from '../types';
import { OFFICIAL_WHATSAPP_LINK } from '../lib/whatsapp';
import { getBikeCurrentStatus } from '../lib/bikeAvailability';

interface HomePageProps {
  settings: SystemSettings;
  bikes: Bike[];
  reservations: Reservation[];
  plans: RentalPlan[];
  onSelectBikeForBooking: (bike: Bike) => void;
  onStartBooking: () => void;
  onScrollToBikes: () => void;
  identifiedCustomer?: CustomerData | null;
  onOpenCustomerLogin?: () => void;
  onLogoutCustomer?: () => void;
  activeReservation?: Reservation | null;
  onOpenActiveRide?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  settings,
  bikes,
  reservations,
  plans,
  onSelectBikeForBooking,
  onStartBooking,
  onScrollToBikes,
  identifiedCustomer,
  onOpenCustomerLogin,
  onLogoutCustomer,
  activeReservation,
  onOpenActiveRide,
}) => {
  const [bikeFilter, setBikeFilter] = React.useState<'all' | 'available'>('all');
  const availableBikes = bikes.filter((b) => getBikeCurrentStatus(b, reservations).isAvailable);
  const displayedBikes = bikeFilter === 'available' ? availableBikes : bikes;

  const [isHowItWorksOpen, setIsHowItWorksOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Banner de Locação Ativa - Acompanhar Pedal */}
      {activeReservation && onOpenActiveRide && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-zinc-950 to-zinc-950 border border-emerald-500/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-lg">
                🚲
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Locação Ativa em Andamento
                </span>
                <h4 className="text-sm sm:text-base font-bold text-white">
                  {activeReservation.bikeSnapshot.name} • {activeReservation.customerSnapshot.fullName}
                </h4>
              </div>
            </div>
            <button
              onClick={onOpenActiveRide}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <span>🚲 ACOMPANHAR MEU PEDAL</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Hero Section - Optimized for both Mobile and Desktop */}
      <section className="relative overflow-hidden pt-4 pb-8 sm:py-20 px-3.5 sm:px-6 border-b border-zinc-900 bg-gradient-to-b from-zinc-950 via-black to-zinc-950">
        {/* Subtle decorative glowing background orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-amber-500/10 blur-[120px] rounded-full pointer-events-none -z-0" />

        <div className="max-w-5xl mx-auto relative z-10 flex flex-col items-center text-center">
          {/* Official Emblem Banner - Compact on mobile */}
          <div className="mb-3 sm:mb-6 relative group">
            <div className="w-20 h-20 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-full p-1 bg-gradient-to-b from-amber-400 via-amber-600 to-amber-900 shadow-xl shadow-amber-500/20 group-hover:scale-105 transition-transform duration-300">
              <img
                src="/logo.png"
                alt="Logo Oficial PEDALAÊ Parintins"
                className="w-full h-full object-cover rounded-full bg-black"
              />
            </div>
            <div className="absolute -bottom-1.5 sm:-bottom-2 left-1/2 -translate-x-1/2 bg-black border border-amber-500/50 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full flex items-center gap-1 shadow-lg">
              <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400" />
              <span className="text-[10px] sm:text-[11px] font-bold text-amber-300 tracking-wider uppercase">
                {settings.cityState || 'Parintins - AM'}
              </span>
            </div>
          </div>

          {/* Slogan & Title */}
          <div className="space-y-2 sm:space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] sm:text-xs font-bold tracking-widest uppercase">
              <Sun className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              Aluguel de Bikes em Parintins - AM
            </div>

            <h1 className="text-2xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-tight font-sans">
              ALUGUE. PEDALE.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500">
                VIVA O MOMENTO.
              </span>
            </h1>

            <p className="text-xs sm:text-base md:text-lg text-zinc-300 max-w-2xl mx-auto leading-relaxed">
              Explore a ilha da magia sobre duas rodas! Liberdade, aventura e lazer na orla,
              praças e pontos turísticos de Parintins com bicicletas modernas, seguras e revisadas.
            </p>
          </div>

          {/* Trust Indicators - Compact on mobile */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-3 sm:mt-6 text-[11px] sm:text-sm text-zinc-300 font-medium">
            <span className="flex items-center gap-1">🚲 Frota Revisada</span>
            <span className="text-zinc-600 hidden sm:inline" aria-hidden="true">·</span>
            <span className="flex items-center gap-1">⚡ PIX Automático</span>
            <span className="text-zinc-600 hidden sm:inline" aria-hidden="true">·</span>
            <span className="flex items-center gap-1">⏱️ Retirada Rápida</span>
            <span className="text-zinc-600 hidden sm:inline" aria-hidden="true">·</span>
            <span className="flex items-center gap-1">📍 Orla de Parintins</span>
          </div>

          {/* Call to Actions - Side-by-side on mobile to eliminate vertical scroll height */}
          <div className="flex flex-row items-center justify-center gap-2 sm:gap-3 mt-4 sm:mt-8 w-full max-w-md">
            <button
              id="btn-hero-reservar"
              onClick={onScrollToBikes || onStartBooking}
              className="flex-1 inline-flex items-center justify-center gap-1.5 sm:gap-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black font-extrabold text-xs sm:text-lg px-3 py-3 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl hover:brightness-110 active:scale-98 transition-all shadow-xl shadow-amber-500/25 cursor-pointer"
            >
              <span>🚲 ESCOLHER BIKE</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-black" />
            </button>

            <button
              id="btn-hero-como-funciona"
              type="button"
              onClick={() => setIsHowItWorksOpen(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 hover:border-amber-500/40 font-bold text-xs sm:text-base px-3 py-3 sm:px-6 sm:py-4 rounded-xl sm:rounded-2xl transition-all cursor-pointer shadow-sm active:scale-98"
            >
              <span>COMO FUNCIONA</span>
            </button>
          </div>

          {/* Returning Customer Quick Access Banner */}
          <div className="mt-4 sm:mt-7 w-full max-w-lg">
            {identifiedCustomer ? (
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex items-center justify-between gap-2.5 text-left shadow-lg">
                <div className="flex items-center gap-2.5">
                  {identifiedCustomer.photoBase64 ? (
                    <img
                      src={identifiedCustomer.photoBase64}
                      alt={identifiedCustomer.fullName}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl object-cover border border-emerald-400 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0">
                      {identifiedCustomer.fullName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h5 className="text-xs sm:text-sm font-black text-white">
                      Olá, {identifiedCustomer.fullName.split(' ')[0]}! 🎉
                    </h5>
                    <p className="text-[10px] sm:text-[11px] text-emerald-300">
                      Seus dados estão prontos! Escolha a bike e alugue em 1 clique.
                    </p>
                  </div>
                </div>
                {onLogoutCustomer && (
                  <button
                    onClick={onLogoutCustomer}
                    className="text-[10px] sm:text-[11px] text-zinc-400 hover:text-rose-400 underline cursor-pointer flex-shrink-0"
                  >
                    Trocar
                  </button>
                )}
              </div>
            ) : (
              onOpenCustomerLogin && (
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex items-center justify-between gap-2 text-left shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs flex-shrink-0">
                      ⚡
                    </div>
                    <div>
                      <h5 className="text-[11px] sm:text-xs font-black text-white leading-tight">
                        Já é cliente PEDALAÊ?
                      </h5>
                      <p className="text-[10px] sm:text-[11px] text-zinc-400">
                        Entre com CPF ou WhatsApp sem redigitar nada!
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onOpenCustomerLogin}
                    className="py-1.5 px-2.5 sm:py-2 sm:px-3.5 rounded-lg sm:rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 border border-amber-500/40 font-bold text-[10px] sm:text-xs uppercase tracking-wider flex items-center gap-1 flex-shrink-0 cursor-pointer active:scale-95 transition-all"
                  >
                    <span>Entrar</span>
                    <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* Mobile Fast Anchor Bar - Instant Jump to Sections with zero scrolling */}
      <nav aria-label="Navegação Rápida" className="sm:hidden sticky top-[57px] z-30 bg-black/95 backdrop-blur-md border-b border-amber-500/20 px-3 py-2 flex items-center justify-between gap-1.5 shadow-md">
        <button
          type="button"
          onClick={() => {
            document.getElementById('section-bikes')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="flex-1 py-1.5 px-2 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 font-extrabold text-[11px] flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
        >
          <span>🚲 Ver Bikes</span>
        </button>
        <button
          type="button"
          onClick={() => {
            document.getElementById('section-planos')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold text-[11px] flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
        >
          <span>💰 Planos</span>
        </button>
        <button
          type="button"
          onClick={() => setIsHowItWorksOpen(true)}
          className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold text-[11px] flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
        >
          <span>❓ Como Funciona</span>
        </button>
      </nav>


      {/* Planos de Aluguel Section - Compact 2x2 on Mobile */}
      <section id="section-planos" className="py-8 sm:py-20 px-3 sm:px-6 bg-black border-b border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-4 sm:mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-amber-400">
              Tarifas & Valores
            </span>
            <h2 className="text-xl sm:text-4xl font-extrabold text-white mt-0.5 sm:mt-1">
              Planos de Aluguel
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 sm:mt-2">
              Valores acessíveis com bicicleta revisada, freios regulados e suporte na orla.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-5">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl sm:rounded-3xl p-3 sm:p-6 text-center flex flex-col justify-between transition-all duration-300 ${
                  plan.popular
                    ? 'bg-gradient-to-b from-amber-500/15 via-zinc-900 to-zinc-950 border-2 border-amber-500 shadow-xl shadow-amber-500/15'
                    : 'bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-2.5 sm:-top-3.5 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[9px] sm:text-[11px] font-black uppercase px-2 sm:px-3.5 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                    Mais Escolhido
                  </span>
                )}
                <div className="space-y-1 sm:space-y-3">
                  <div className="text-[10px] sm:text-xs font-extrabold text-amber-400 tracking-wider uppercase">
                    {plan.label}
                  </div>
                  <div className="text-xl sm:text-4xl font-black text-white">
                    {plan.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <div className="text-[10px] sm:text-xs text-zinc-400">
                    {plan.durationHours} hora{plan.durationHours > 1 ? 's' : ''} de pedal
                  </div>

                  <div className="hidden sm:block pt-3 border-t border-zinc-800/80 text-xs text-zinc-300 space-y-1.5 text-left">
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Bike inspecionada</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Freios regulados</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Suporte em Parintins</span>
                    </div>
                  </div>
                </div>

                <button
                  id={`btn-plan-${plan.id}`}
                  onClick={() => {
                    if (onScrollToBikes) {
                      onScrollToBikes();
                    } else {
                      onStartBooking();
                    }
                  }}
                  className={`mt-3 sm:mt-6 w-full py-2 sm:py-3 px-2 sm:px-4 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                    plan.popular
                      ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-md shadow-amber-500/20 active:scale-95'
                      : 'bg-zinc-800 hover:bg-amber-500 hover:text-black text-zinc-200 active:scale-95'
                  }`}
                >
                  <span>Escolher Bike</span>
                  <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Catálogo de Bikes Section - Compact 2-column Grid on Mobile to eliminate endless scrolling */}
      <section id="section-bikes" className="py-8 sm:py-20 px-3 sm:px-6 bg-zinc-950">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-amber-400">
                Passo 1 • Frota Pedalaê
              </span>
              <h2 className="text-xl sm:text-4xl font-extrabold text-white mt-0.5 sm:mt-1">
                ESCOLHA SUA BIKE
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 sm:mt-1">
                Toque na bicicleta desejada para iniciar sua reserva em 1 minuto.
              </p>
            </div>
            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setBikeFilter('all')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                  bikeFilter === 'all'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Todas ({bikes.length})
              </button>
              <button
                type="button"
                onClick={() => setBikeFilter('available')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                  bikeFilter === 'available'
                    ? 'bg-emerald-500 text-black shadow-md'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400'
                }`}
              >
                🟢 Livres ({availableBikes.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6">
            {displayedBikes.map((bike) => {
              const bikeStatus = getBikeCurrentStatus(bike, reservations);
              const isAvailable = bikeStatus.isAvailable;
              return (
                <div
                  key={bike.id}
                  id={`card-bike-${bike.code.toLowerCase()}`}
                  className="bg-black/90 rounded-2xl border-2 border-amber-500/30 overflow-hidden flex flex-col justify-between hover:border-amber-400 hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-300 group"
                >
                  <div>
                    {/* Bike Poster Image Container - Balanced aspect ratio on mobile */}
                    <div className="relative aspect-[3/4] sm:aspect-[9/16] w-full bg-zinc-950 overflow-hidden cursor-pointer" onClick={() => isAvailable && onSelectBikeForBooking(bike)}>
                      <img
                        src={bike.photoUrl}
                        alt={bike.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-center group-hover:scale-[1.03] transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80';
                        }}
                      />

                      {/* Code Badge */}
                      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-black/85 backdrop-blur-md border border-amber-500/50 text-amber-400 font-mono text-[10px] sm:text-xs font-black px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg shadow-lg">
                        {bike.code}
                      </div>

                      {/* Status Badge */}
                      <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                        {bikeStatus.isInUse ? (
                          <span className="inline-flex items-center gap-1 bg-rose-600/90 backdrop-blur-md border border-rose-400 text-white text-[9px] sm:text-[11px] font-black px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full shadow-lg">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                            <span className="hidden sm:inline">BIKE </span>EM USO
                          </span>
                        ) : isAvailable ? (
                          <span className="inline-flex items-center gap-1 bg-black/85 backdrop-blur-md border border-emerald-500/60 text-emerald-400 text-[9px] sm:text-[11px] font-bold px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full shadow-lg">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            LIVRE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-black/85 backdrop-blur-md border border-rose-500/60 text-rose-400 text-[9px] sm:text-[11px] font-bold px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full shadow-lg">
                            REVISÃO
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bike Details */}
                    <div className="p-2.5 sm:p-4 space-y-1 sm:space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="font-black text-white text-xs sm:text-lg group-hover:text-amber-400 transition-colors uppercase tracking-tight truncate">
                          {bike.name}
                        </h3>
                      </div>

                      <div className="flex flex-wrap gap-1 text-[10px] sm:text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold truncate max-w-[75px] sm:max-w-none">
                          {bike.model}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold truncate">
                          Cor: {bike.color}
                        </span>
                      </div>

                      {/* In-use real time notice banner */}
                      {bikeStatus.isInUse && (
                        <div className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-[10px] sm:text-xs font-semibold leading-tight sm:leading-relaxed">
                          <p className="line-clamp-2 sm:line-clamp-none">
                            {bikeStatus.availabilityNotice}
                          </p>
                        </div>
                      )}

                      {/* Key Features Badges matching official poster - Desktop only */}
                      <div className="hidden sm:grid grid-cols-2 gap-1.5 pt-1 text-[10px] text-zinc-400 font-medium">
                        <span className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded border border-zinc-800/80">
                          ⚙️ Freios a Disco
                        </span>
                        <span className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded border border-zinc-800/80">
                          🚵 Marchas Precisas
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Button */}
                  <div className="p-2.5 sm:p-4 pt-0">
                    <button
                      id={`btn-choose-bike-${bike.code.toLowerCase()}`}
                      disabled={bike.status === 'maintenance' || bike.status === 'inactive'}
                      onClick={() => onSelectBikeForBooking(bike)}
                      className={`w-full py-2.5 sm:py-3.5 px-2 sm:px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        bikeStatus.isInUse
                          ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 active:scale-95 text-xs shadow-md'
                          : isAvailable
                          ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:brightness-110 active:scale-95 text-black shadow-lg shadow-amber-500/25'
                          : 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                      }`}
                    >
                      {bike.status === 'maintenance' || bike.status === 'inactive' ? (
                        <span>EM REVISÃO</span>
                      ) : bikeStatus.isInUse ? (
                        <>
                          <span className="sm:hidden">📅 Agendar</span>
                          <span className="hidden sm:inline">📅 AGENDAR (LIVRE ÀS {bikeStatus.endTime} OU OUTRO DIA)</span>
                          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 stroke-[3]" />
                        </>
                      ) : (
                        <>
                          <span className="sm:hidden">🚲 Escolher</span>
                          <span className="hidden sm:inline">🚲 ESCOLHER ESTA BIKE (PASSO 1)</span>
                          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black stroke-[3]" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {displayedBikes.length === 0 && (
              <div className="col-span-full p-8 text-center bg-zinc-900/60 rounded-2xl border border-zinc-800 text-zinc-400 text-xs">
                Nenhuma bicicleta livre agora neste filtro. Confira todas as bikes para agendar hoje mais tarde ou para o fim de semana!
                <button
                  type="button"
                  onClick={() => setBikeFilter('all')}
                  className="block mx-auto mt-2 text-amber-400 underline font-bold"
                >
                  Mostrar todas as bicicletas
                </button>
              </div>
            )}
          </div>
        </div>
      </section>



      {/* Social Media & Photo Tag Invite Section - Compact on Mobile */}
      <section className="py-6 sm:py-18 px-3 sm:px-6 bg-gradient-to-b from-zinc-950 via-zinc-900 to-black border-t border-zinc-900 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 blur-[130px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10">
          <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 border border-amber-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-10 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-center">
              
              {/* Left Column: Callout and instructions */}
              <div className="lg:col-span-7 space-y-2.5 sm:space-y-4 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  <Camera className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sua Foto em Destaque</span>
                </div>

                <h3 className="text-lg sm:text-3xl md:text-4xl font-black text-white leading-tight">
                  Faça fotos nos pontos turísticos de Parintins!
                </h3>

                <p className="text-xs sm:text-base text-zinc-300 leading-relaxed">
                  Aproveite seu rolê pela <strong>Orla</strong>, <strong>Praça da Catedral</strong> e murais de Parintins. Marque nosso perfil no Instagram para destacarmos seu rolê nos stories oficiais!
                </p>

                {/* Tag pill badges */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-0.5 text-[11px] sm:text-xs">
                  <span className="px-2.5 py-0.5 rounded-lg bg-pink-500/15 border border-pink-500/40 text-pink-300 font-bold">
                    📸 @pedalae.parintins
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold">
                    🚲 #PedalaeParintins
                  </span>
                </div>
              </div>

              {/* Right Column: Social media cards - 3 columns on mobile, vertical stack on desktop */}
              <div className="lg:col-span-5 flex flex-col gap-2 sm:gap-3">
                <div className="text-center sm:text-left mb-0.5">
                  <span className="text-[11px] sm:text-xs uppercase font-extrabold tracking-wider text-zinc-400">
                    Siga nossas redes:
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:flex sm:flex-col gap-2">
                  {/* Instagram Button */}
                  <a
                    href={settings.instagramUrl || "https://www.instagram.com/pedalae.parintins?stkn=MTl4YmZrMnM4MDhpYg=="}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col sm:flex-row items-center sm:justify-between p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-zinc-900 border border-pink-500/40 hover:border-pink-400 hover:scale-[1.02] active:scale-95 transition-all shadow-md text-center sm:text-left"
                  >
                    <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3">
                      <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-md">
                        <svg className="w-4 h-4 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                      </div>
                      <div>
                        <div className="text-[10px] sm:text-xs uppercase font-extrabold text-pink-400 tracking-wider">Instagram</div>
                        <div className="text-xs sm:text-sm font-bold text-white group-hover:text-pink-300 truncate max-w-[80px] sm:max-w-none">@pedalae</div>
                      </div>
                    </div>
                    <ChevronRight className="hidden sm:block w-5 h-5 text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition-transform" />
                  </a>

                  {/* Facebook Button */}
                  <a
                    href={settings.facebookUrl && !settings.facebookUrl.includes('61573909772391') && !settings.facebookUrl.includes('61594762945870') ? settings.facebookUrl : "https://www.facebook.com/profile.php?id=61595687457272"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col sm:flex-row items-center sm:justify-between p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-zinc-900 border border-blue-500/40 hover:border-blue-400 hover:scale-[1.02] active:scale-95 transition-all shadow-md text-center sm:text-left"
                  >
                    <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3">
                      <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
                        <svg className="w-4 h-4 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </div>
                      <div>
                        <div className="text-[10px] sm:text-xs uppercase font-extrabold text-blue-400 tracking-wider">Facebook</div>
                        <div className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-300 truncate max-w-[80px] sm:max-w-none">Perfil</div>
                      </div>
                    </div>
                    <ChevronRight className="hidden sm:block w-5 h-5 text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition-transform" />
                  </a>

                  {/* TikTok Button */}
                  <a
                    href={settings.tiktokUrl || "https://www.tiktok.com/@pedalae.parintins"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col sm:flex-row items-center sm:justify-between p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-zinc-900 via-cyan-950/30 to-zinc-900 border border-zinc-700 hover:border-cyan-400 hover:scale-[1.02] active:scale-95 transition-all shadow-md text-center sm:text-left"
                  >
                    <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3">
                      <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-black border border-zinc-700 flex items-center justify-center text-white shadow-md">
                        <svg className="w-4 h-4 sm:w-6 sm:h-6 fill-current text-cyan-400" viewBox="0 0 24 24">
                          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                        </svg>
                      </div>
                      <div>
                        <div className="text-[10px] sm:text-xs uppercase font-extrabold text-cyan-400 tracking-wider">TikTok</div>
                        <div className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 truncate max-w-[80px] sm:max-w-none">@pedalae</div>
                      </div>
                    </div>
                    <ChevronRight className="hidden sm:block w-5 h-5 text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-zinc-900 py-8 sm:py-12 px-3 sm:px-6 pb-20 sm:pb-12 text-center text-xs text-zinc-500">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="PEDALAÊ" className="w-12 h-12 object-contain rounded-full border border-amber-500/40 p-0.5" />
            <div className="text-left">
              <div className="text-base font-black text-white">PEDALAÊ</div>
              <div className="text-[10px] text-amber-400 font-bold tracking-wider">ALUGUE. PEDALE. VIVA O MOMENTO.</div>
            </div>
          </div>

          {/* Social media icons list in footer */}
          <div className="flex items-center justify-center gap-3">
            {/* Instagram */}
            <a
              href={settings.instagramUrl || "https://www.instagram.com/pedalae.parintins?stkn=MTl4YmZrMnM4MDhpYg=="}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram Oficial Pedalaê"
              className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-pink-500/60 flex items-center justify-center text-zinc-400 hover:text-pink-400 hover:scale-110 active:scale-95 transition-all shadow"
              title="Instagram: @pedalae.parintins"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>

            {/* Facebook */}
            <a
              href={settings.facebookUrl && !settings.facebookUrl.includes('61573909772391') && !settings.facebookUrl.includes('61594762945870') ? settings.facebookUrl : "https://www.facebook.com/profile.php?id=61595687457272"}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook Oficial do Proprietário"
              className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-blue-500/60 flex items-center justify-center text-zinc-400 hover:text-blue-400 hover:scale-110 active:scale-95 transition-all shadow"
              title="Facebook: Proprietário Pedalaê Parintins"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>

            {/* TikTok */}
            <a
              href={settings.tiktokUrl || "https://www.tiktok.com/@pedalae.parintins"}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok Oficial Pedalaê"
              className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-cyan-500/60 flex items-center justify-center text-zinc-400 hover:text-cyan-400 hover:scale-110 active:scale-95 transition-all shadow"
              title="TikTok: @pedalae.parintins"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
              </svg>
            </a>

            {/* WhatsApp */}
            <a
              href={settings.whatsappOfficialUrl || OFFICIAL_WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp Oficial Pedalaê"
              className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/60 flex items-center justify-center text-zinc-400 hover:text-emerald-400 hover:scale-110 active:scale-95 transition-all shadow"
              title={`WhatsApp: ${settings.whatsappDisplay}`}
            >
              <Smartphone className="w-5 h-5 text-current" />
            </a>
          </div>

          <p className="max-w-md text-zinc-400 text-xs">
            {settings.address}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 text-zinc-400 font-medium">
            <a href={settings.whatsappOfficialUrl || OFFICIAL_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">
              WhatsApp Oficial: {settings.whatsappDisplay}
            </a>
            <span>•</span>
            <span>Parintins - Amazonas</span>
            <span>•</span>
            <a 
              href={settings.instagramUrl || "https://www.instagram.com/pedalae.parintins?stkn=MTl4YmZrMnM4MDhpYg=="} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-pink-400 transition-colors font-semibold"
            >
              Instagram @pedalae.parintins
            </a>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#admin';
              }}
              className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-amber-400 transition-colors py-2 px-3.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 cursor-pointer shadow-sm"
              title="Acesso exclusivo para o proprietário e equipe PEDALAÊ"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Acesso Administrativo (Painel do Proprietário)</span>
            </button>
          </div>

          <p className="text-[11px] text-zinc-600">
            © {new Date().getFullYear()} PEDALAÊ. Todos os direitos reservados. Conforme diretrizes LGPD de proteção de dados.
          </p>
        </div>
      </footer>

      {/* Modal - Como Funciona o Aluguel no PEDALAÊ */}
      {isHowItWorksOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsHowItWorksOpen(false)}
        >
          <div 
            className="bg-zinc-950 border border-amber-500/30 rounded-3xl p-5 sm:p-7 max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl shadow-amber-500/10 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient lighting glow */}
            <div className="absolute -top-24 -right-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-800/80 relative z-10">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 inline-block mb-2">
                  Passo a Passo Descomplicado
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  Como funciona o aluguel no PEDALAÊ?
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Em poucos minutos sua reserva está garantida no sistema e sua bike pronta para rodar.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsHowItWorksOpen(false)}
                className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Steps Grid */}
            <div className="overflow-y-auto py-5 pr-1 space-y-4 my-1 relative z-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4.5 hover:border-amber-500/40 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-black text-lg mb-2.5">
                    ⏱️
                  </div>
                  <h4 className="font-bold text-white text-sm sm:text-base">1. Escolha o tempo</h4>
                  <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                    Opções de 1h, 2h, 3h ou 4h de pedal pelos melhores pontos e orla de Parintins.
                  </p>
                </div>

                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4.5 hover:border-amber-500/40 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-black text-lg mb-2.5">
                    📅
                  </div>
                  <h4 className="font-bold text-white text-sm sm:text-base">2. Escolha o horário</h4>
                  <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                    Calendário inteligente com bloqueio de conflitos de disponibilidade em tempo real.
                  </p>
                </div>

                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4.5 hover:border-amber-500/40 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-black text-lg mb-2.5">
                    🚲
                  </div>
                  <h4 className="font-bold text-white text-sm sm:text-base">3. Escolha sua bike</h4>
                  <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                    Selecione seu modelo e cor favoritos no catálogo de bikes disponíveis do dia.
                  </p>
                </div>

                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4.5 hover:border-amber-500/40 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-black text-lg mb-2.5">
                    💳
                  </div>
                  <h4 className="font-bold text-white text-sm sm:text-base">4. Faça o pagamento</h4>
                  <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                    Chave PIX oficial com cópia rápida e valor total calculado de forma automática.
                  </p>
                </div>

                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4.5 hover:border-amber-500/40 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-black text-lg mb-2.5">
                    📲
                  </div>
                  <h4 className="font-bold text-white text-sm sm:text-base">5. Envie o comprovante</h4>
                  <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                    Com um toque você abre o WhatsApp oficial com a mensagem e dados pré-formatados.
                  </p>
                </div>

                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4.5 hover:border-amber-500/40 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-black text-lg mb-2.5">
                    ✅
                  </div>
                  <h4 className="font-bold text-white text-sm sm:text-base">6. Venha buscar e pedalar</h4>
                  <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                    Confira os detalhes da reserva, assine o termo presencialmente e curta o rolê!
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-end gap-3 relative z-10">
              <button
                type="button"
                onClick={() => setIsHowItWorksOpen(false)}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-semibold text-sm border border-zinc-800 transition-colors cursor-pointer text-center"
              >
                Fechar
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsHowItWorksOpen(false);
                  setTimeout(() => {
                    if (onScrollToBikes) {
                      onScrollToBikes();
                    } else {
                      onStartBooking();
                    }
                  }, 100);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black font-extrabold text-sm hover:brightness-110 active:scale-98 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <span>🚲 ESCOLHER MINHA BIKE AGORA</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
