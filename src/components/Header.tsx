import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { OFFICIAL_WHATSAPP_LINK } from '../lib/whatsapp';
import { CustomerData } from '../types';

interface HeaderProps {
  onNavigateHome: () => void;
  onOpenBooking: () => void;
  onOpenAdmin: () => void;
  isAdminOpen: boolean;
  whatsappUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  activeRental?: { code: string; bikeName: string } | null;
  onOpenActiveTracker?: () => void;
  isTrackerOpen?: boolean;
  identifiedCustomer?: CustomerData | null;
  onOpenCustomerLogin?: () => void;
  onLogoutCustomer?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigateHome,
  onOpenBooking,
  onOpenAdmin,
  isAdminOpen,
  whatsappUrl,
  instagramUrl = 'https://www.instagram.com/pedalae.parintins?stkn=MTl4YmZrMnM4MDhpYg==',
  facebookUrl = 'https://www.facebook.com/profile.php?id=61595687457272',
  tiktokUrl = 'https://www.tiktok.com/@pedalae.parintins',
  activeRental,
  onOpenActiveTracker,
  isTrackerOpen,
  identifiedCustomer,
  onOpenCustomerLogin,
  onLogoutCustomer,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-amber-500/20 px-3 py-2.5 sm:px-6 sm:py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand / Logo */}
        <button
          id="btn-nav-brand"
          onClick={onNavigateHome}
          className="flex items-center gap-2 sm:gap-3 text-left group focus:outline-none min-w-0 flex-shrink cursor-pointer"
        >
          <img
            src="/logo.png"
            alt="Logo Oficial PEDALAÊ"
            className="w-9 h-9 sm:w-12 sm:h-12 object-contain rounded-full border border-amber-500/40 p-0.5 shadow-md group-hover:scale-105 transition-transform flex-shrink-0"
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-lg sm:text-2xl font-black tracking-tight text-white font-sans whitespace-nowrap">
                PEDALA<span className="text-amber-400">Ê</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                Parintins - AM
              </span>
            </div>
            <p className="hidden sm:block text-[10px] sm:text-xs text-amber-400/90 font-medium tracking-wide truncate">
              ALUGUE. PEDALE. VIVA O MOMENTO.
            </p>
          </div>
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs lg:text-sm font-bold text-zinc-300">
          <button
            type="button"
            onClick={() => {
              onNavigateHome();
              setTimeout(() => {
                document.getElementById('section-planos')?.scrollIntoView({ behavior: 'smooth' });
              }, 60);
            }}
            className="hover:text-amber-400 transition-colors cursor-pointer py-1"
          >
            Planos
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigateHome();
              setTimeout(() => {
                document.getElementById('section-bikes')?.scrollIntoView({ behavior: 'smooth' });
              }, 60);
            }}
            className="hover:text-amber-400 transition-colors cursor-pointer py-1"
          >
            Bicicletas
          </button>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Ride Live Indicator (ONLY visible when rental is confirmed/active) */}
          {activeRental && onOpenActiveTracker && (
            <button
              onClick={onOpenActiveTracker}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                isTrackerOpen
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/30'
                  : 'bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/25'
              }`}
              title="Acessar Minha Locação em Tempo Real"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>🚲 MINHA LOCAÇÃO</span>
            </button>
          )}

          {/* Social Icons in Header */}
          <div className="hidden lg:flex items-center gap-1.5 border-r border-zinc-800 pr-2 mr-1">
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram Oficial @pedalae.parintins"
                className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-pink-400 hover:border-pink-500/40 transition-colors"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            )}
            {facebookUrl && (
              <a
                href={(!facebookUrl.includes('61573909772391') && !facebookUrl.includes('61594762945870')) ? facebookUrl : 'https://www.facebook.com/profile.php?id=61595687457272'}
                target="_blank"
                rel="noopener noreferrer"
                title="Facebook Oficial do Proprietário - Pedalaê Parintins"
                className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-blue-400 hover:border-blue-500/40 transition-colors"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
            )}
            {tiktokUrl && (
              <a
                href={tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="TikTok Oficial @pedalae.parintins"
                className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                </svg>
              </a>
            )}
            {/* Social WhatsApp Icon */}
            <a
              href={whatsappUrl || OFFICIAL_WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp Oficial @pedalae.parintins"
              className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
            </a>
          </div>

          {/* Customer Login / Identified Profile */}
          {identifiedCustomer ? (
            <div className="flex items-center gap-1 sm:gap-2 bg-zinc-900 border border-amber-500/40 px-1.5 py-1 sm:px-2.5 sm:py-1.5 rounded-xl shadow-sm min-w-0 flex-shrink-0">
              {identifiedCustomer.photoBase64 ? (
                <img
                  src={identifiedCustomer.photoBase64}
                  alt={identifiedCustomer.fullName}
                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border border-amber-400 flex-shrink-0"
                />
              ) : (
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] sm:text-xs font-bold flex-shrink-0">
                  {identifiedCustomer.fullName.charAt(0)}
                </div>
              )}
              <div className="flex flex-col text-left min-w-0">
                <span className="text-[10px] sm:text-xs font-bold text-white truncate max-w-[48px] sm:max-w-[120px]">
                  {identifiedCustomer.fullName.split(' ')[0]}
                </span>
                <span className="hidden sm:inline text-[9px] text-amber-400 font-semibold leading-none">Cliente VIP</span>
              </div>
              {onLogoutCustomer && (
                <button
                  type="button"
                  onClick={onLogoutCustomer}
                  title="Trocar de cliente"
                  className="text-zinc-500 hover:text-rose-400 p-0.5 text-xs transition-colors ml-0.5 cursor-pointer flex-shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            onOpenCustomerLogin && (
              <button
                type="button"
                id="btn-header-customer-login"
                onClick={onOpenCustomerLogin}
                className="inline-flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:border-amber-400 text-xs font-bold px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 flex-shrink-0"
                title="Já alugou com a gente? Identifique-se com seu CPF ou WhatsApp"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="hidden sm:inline">Já sou cliente</span>
                <span className="sm:hidden text-[11px] font-bold">Entrar</span>
              </button>
            )
          )}

          <button
            id="btn-header-reservar"
            onClick={onOpenBooking}
            className="hidden sm:inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-md shadow-amber-500/20 flex-shrink-0"
          >
            <span>🚲 Reservar Bike</span>
          </button>

          {/* WhatsApp Direct Icon-Only Button - Prominent, accessible on all screens, no text label */}
          <a
            id="btn-header-whatsapp-icon"
            href={whatsappUrl || OFFICIAL_WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            title="Falar no WhatsApp oficial PEDALAÊ"
            aria-label="Falar no WhatsApp"
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white flex items-center justify-center transition-all shadow-md shadow-[#25D366]/25 hover:scale-105 active:scale-95 flex-shrink-0 cursor-pointer"
          >
            <svg className="w-4.5 h-4.5 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
            </svg>
          </a>

          <button
            id="btn-header-toggle-admin"
            onClick={onOpenAdmin}
            className={`flex items-center gap-1.5 text-xs font-semibold p-2 sm:px-3 sm:py-2 rounded-xl border transition-all flex-shrink-0 cursor-pointer ${
              isAdminOpen
                ? 'bg-amber-500 text-black border-amber-400 font-bold shadow-md shadow-amber-500/20'
                : 'bg-zinc-900/90 text-zinc-400 border-zinc-800 hover:border-amber-500/40 hover:text-white'
            }`}
            title="Acesso Restrito - Somente Administrador"
            aria-label={isAdminOpen ? 'Sair do Painel' : 'Área Restrita do Administrador'}
          >
            <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="hidden sm:inline">{isAdminOpen ? 'Sair do Painel' : 'Área Restrita'}</span>
            {isAdminOpen && <span className="sm:hidden text-[11px] font-bold">Sair</span>}
          </button>
        </div>
      </div>
    </header>
  );
};
