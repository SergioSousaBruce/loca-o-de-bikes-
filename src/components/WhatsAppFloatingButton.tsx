import React from 'react';
import { MessageCircle } from 'lucide-react';
import { OFFICIAL_WHATSAPP_LINK } from '../lib/whatsapp';

interface WhatsAppFloatingButtonProps {
  customUrl?: string;
}

export const WhatsAppFloatingButton: React.FC<WhatsAppFloatingButtonProps> = ({ customUrl }) => {
  const targetUrl = customUrl || OFFICIAL_WHATSAPP_LINK;
  return (
    <a
      id="btn-whatsapp-fixed-bottom"
      href={targetUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp oficial do PEDALAÊ"
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs sm:text-sm p-3 sm:px-4 sm:py-3 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white/20 group"
    >
      <div className="relative flex items-center justify-center">
        <MessageCircle className="w-5 h-5 sm:w-5 sm:h-5 fill-white text-[#25D366]" />
        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-300"></span>
        </span>
      </div>
      <span className="hidden sm:inline tracking-wide uppercase text-xs font-black drop-shadow-sm">
        FALAR NO WHATSAPP
      </span>
    </a>
  );
};
