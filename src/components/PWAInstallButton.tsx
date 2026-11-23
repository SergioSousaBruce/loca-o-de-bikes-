import React, { useState } from 'react';
import { Download, Smartphone, X, Share, MoreVertical, PlusSquare, ExternalLink, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'button' | 'footer';
  appUrl?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'button',
  appUrl,
}) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // Hide automatically when already running as an installed standalone PWA
  if (isInstalled) {
    return null;
  }

  const resolvedUrl =
    appUrl ||
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-pre-rbt67jjdrmuum5j5smv6zn-295059394611.us-east1.run.app');

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        // User dismissed or prompt wasn't completed; leave accessible
      }
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      {variant === 'header' ? (
        <button
          id="btn-header-install-pwa"
          type="button"
          onClick={handleClick}
          title="Instalar aplicativo PEDALAÊ no celular"
          aria-label="Instalar aplicativo no celular"
          className="inline-flex items-center justify-center gap-1.5 h-8 sm:h-10 px-2 sm:px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/40 hover:border-amber-400 text-xs font-bold transition-all cursor-pointer active:scale-95 flex-shrink-0"
        >
          <Download className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="hidden md:inline whitespace-nowrap">Instalar App</span>
        </button>
      ) : variant === 'footer' ? (
        <button
          id="btn-footer-install-pwa"
          type="button"
          onClick={handleClick}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
        >
          <Smartphone className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>Instalar App no Celular</span>
        </button>
      ) : (
        <button
          id="btn-hero-install-pwa"
          type="button"
          onClick={handleClick}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-900/95 hover:bg-zinc-800 text-amber-300 hover:text-amber-200 border border-amber-500/40 hover:border-amber-400 text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
        >
          <Smartphone className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>Instalar no Celular</span>
        </button>
      )}

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-zinc-950 border border-amber-500/40 p-6 shadow-2xl shadow-amber-500/10 text-left relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              aria-label="Fechar"
              className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4 pr-8">
              <img
                src="/pwa-192x192.png"
                alt="PEDALAÊ"
                className="w-12 h-12 rounded-2xl border border-amber-500/40 object-cover flex-shrink-0"
              />
              <div>
                <h3 className="text-lg font-black text-white leading-tight">
                  Instalar App PEDALAÊ
                </h3>
                <p className="text-xs text-amber-400 font-semibold">
                  Acesso rápido direto da tela inicial do celular
                </p>
              </div>
            </div>

            {isInIframe && (
              <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-zinc-200 space-y-2.5">
                <p>
                  Para instalar diretamente com 1 toque, abra o aplicativo no navegador do seu celular fora desta visualização:
                </p>
                <a
                  href={resolvedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Link no Navegador</span>
                </a>
              </div>
            )}

            <div className="space-y-3">
              {/* Android / Chrome instructions */}
              <div className={`rounded-2xl p-4 border ${!isIOS ? 'bg-zinc-900 border-amber-500/40' : 'bg-zinc-900/60 border-zinc-800'}`}>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  No Android (Chrome / Edge)
                </h4>
                <ol className="text-xs text-zinc-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-amber-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                      1
                    </span>
                    <span>
                      Toque no menu <strong className="text-white inline-flex items-center gap-0.5"><MoreVertical className="w-3.5 h-3.5 inline text-amber-400" /> (três pontinhos)</strong> no canto superior direito do navegador.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-amber-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                      2
                    </span>
                    <span>
                      Toque em <strong className="text-white">"Instalar aplicativo"</strong> ou <strong className="text-white">"Adicionar à tela inicial"</strong> e confirme.
                    </span>
                  </li>
                </ol>
              </div>

              {/* iOS Safari instructions */}
              <div className={`rounded-2xl p-4 border ${isIOS ? 'bg-zinc-900 border-amber-500/40' : 'bg-zinc-900/60 border-zinc-800'}`}>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  No iPhone / iPad (Safari)
                </h4>
                <ol className="text-xs text-zinc-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-amber-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                      1
                    </span>
                    <span>
                      Toque no botão <strong className="text-white inline-flex items-center gap-1">Compartilhar <Share className="w-3.5 h-3.5 inline text-amber-400" /></strong> na barra inferior do Safari.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-amber-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                      2
                    </span>
                    <span>
                      Role para baixo, toque em <strong className="text-white inline-flex items-center gap-1"><PlusSquare className="w-3.5 h-3.5 inline text-amber-400" /> "Adicionar à Tela de Início"</strong> e toque em <strong className="text-white">"Adicionar"</strong>.
                    </span>
                  </li>
                </ol>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald-400">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Leve, gratuito e abre em tela cheia como aplicativo!</span>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-4 w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
};
