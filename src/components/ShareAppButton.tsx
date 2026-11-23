import React, { useState } from 'react';
import { Share2, Check, Copy, X, MessageCircle } from 'lucide-react';

interface ShareAppButtonProps {
  variant?: 'header' | 'button' | 'footer';
  appUrl?: string;
}

export const ShareAppButton: React.FC<ShareAppButtonProps> = ({
  variant = 'button',
  appUrl,
}) => {
  const [copied, setCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const shareUrl =
    appUrl ||
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-pre-rbt67jjdrmuum5j5smv6zn-295059394611.us-east1.run.app');

  const shareTitle = 'PEDALAÊ - Aluguel de Bikes em Parintins/AM';
  const shareText = 'Alugue sua bike online no PEDALAÊ e curta a orla de Parintins!';

  const copyLink = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setShowShareModal(true);
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err) {
        const errorName = err instanceof Error ? err.name : '';
        // If user intentionally cancelled native share sheet, do nothing
        if (errorName === 'AbortError') return;
      }
    }

    // Fallback: copy link and open quick share modal (WhatsApp + Copy)
    await copyLink();
    setShowShareModal(true);
  };

  const whatsappShareHref = `https://wa.me/?text=${encodeURIComponent(
    `${shareText}\n\nAcesse o app e reserve agora: ${shareUrl}`
  )}`;

  return (
    <>
      {variant === 'header' ? (
        <button
          id="btn-header-share-app"
          type="button"
          onClick={handleShare}
          title={copied ? 'Link copiado!' : 'Compartilhar aplicativo PEDALAÊ'}
          aria-label="Compartilhar aplicativo"
          className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/50 text-zinc-200 hover:text-amber-400 transition-all cursor-pointer active:scale-95 flex-shrink-0"
        >
          {copied ? (
            <Check className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-400" />
          ) : (
            <Share2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400" />
          )}
        </button>
      ) : variant === 'footer' ? (
        <button
          id="btn-footer-share-app"
          type="button"
          onClick={handleShare}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-amber-400 border border-zinc-800 hover:border-amber-500/40 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Share2 className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span>{copied ? 'Link Oficial Copiado!' : 'Compartilhar App PEDALAÊ com Amigos'}</span>
        </button>
      ) : (
        <button
          id="btn-hero-share-app"
          type="button"
          onClick={handleShare}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-900/95 hover:bg-zinc-800 text-zinc-100 hover:text-amber-300 border border-zinc-700 hover:border-amber-500/40 text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <Share2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
          )}
          <span>{copied ? 'Link Copiado!' : 'Compartilhar App'}</span>
        </button>
      )}

      {showShareModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-amber-500/40 p-6 shadow-2xl text-left relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowShareModal(false)}
              aria-label="Fechar"
              className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4 pr-8">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Compartilhar PEDALAÊ</h3>
                <p className="text-xs text-zinc-400">Envie o aplicativo para amigos e clientes</p>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 mb-4 text-[11px] text-zinc-300 font-mono truncate">
              {shareUrl}
            </div>

            <div className="space-y-2.5">
              <a
                href={whatsappShareHref}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Enviar pelo WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={copyLink}
                className="w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-zinc-700 transition-all cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Link Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-amber-400" />
                    <span>Copiar Link do Aplicativo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
