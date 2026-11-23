import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-black shadow-xl border border-amber-300">
      <WifiOff className="w-4 h-4 flex-shrink-0" />
      <span>Sem conexão — exibindo dados em cache</span>
    </div>
  );
};
