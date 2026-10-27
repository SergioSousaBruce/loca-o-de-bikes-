import React, { useState } from 'react';
import { CustomerData } from '../types';
import { findClientByCpfOrPhone } from '../lib/dbService';
import { 
  X, 
  Search, 
  Sparkles, 
  UserCheck, 
  AlertCircle, 
  ArrowRight, 
  Check, 
  ShieldCheck, 
  User, 
  Calendar, 
  Phone 
} from 'lucide-react';

interface CustomerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerIdentified: (customer: CustomerData) => void;
  onStartBooking?: () => void;
}

export const CustomerLoginModal: React.FC<CustomerLoginModalProps> = ({
  isOpen,
  onClose,
  onCustomerIdentified,
  onStartBooking,
}) => {
  const [queryVal, setQueryVal] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundCustomer, setFoundCustomer] = useState<CustomerData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = queryVal.replace(/\D/g, '');
    if (clean.length < 8) {
      setErrorMessage('Por favor, informe seu CPF completo (11 dígitos) ou WhatsApp com DDD.');
      return;
    }

    setErrorMessage(null);
    setIsSearching(true);
    setNotFound(false);
    setFoundCustomer(null);

    try {
      const result = await findClientByCpfOrPhone(clean);
      if (result) {
        setFoundCustomer(result);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      console.warn('Login search err:', err);
      setNotFound(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmLogin = () => {
    if (!foundCustomer) return;
    onCustomerIdentified(foundCustomer);
    onClose();
  };

  const handleConfirmAndBook = () => {
    if (!foundCustomer) return;
    onCustomerIdentified(foundCustomer);
    onClose();
    if (onStartBooking) {
      onStartBooking();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-md bg-zinc-950 border border-amber-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-amber-500/10 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-5 right-5 p-2 rounded-full bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1.5 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-black text-white">
            Já é Cliente PEDALAÊ?
          </h3>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            Identifique-se com seu CPF ou WhatsApp para alugar com seus dados já preenchidos.
          </p>
        </div>

        {/* Search Input Form */}
        <form onSubmit={handleSearch} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
              CPF ou WhatsApp com DDD:
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                value={queryVal}
                onChange={(e) => {
                  setQueryVal(e.target.value);
                  setNotFound(false);
                  setErrorMessage(null);
                }}
                placeholder="Ex: 554.336.182-34 ou 92 99812-5020"
                className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400 font-mono tracking-wide"
              />
              {isSearching && (
                <div className="absolute right-3 top-3.5">
                  <span className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin inline-block" />
                </div>
              )}
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs text-rose-400 font-medium flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={isSearching || !queryVal.trim()}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-amber-500/20"
          >
            <Search className="w-4 h-4 stroke-[2.5]" />
            <span>{isSearching ? 'Consultando Cadastro...' : 'Localizar Meus Dados'}</span>
          </button>
        </form>

        {/* Found Customer Card */}
        {foundCustomer && (
          <div className="bg-zinc-900 border-2 border-emerald-500/50 rounded-2xl p-4 sm:p-5 space-y-4 animate-fadeIn">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-black uppercase tracking-wider">
              <UserCheck className="w-4 h-4" />
              <span>Cadastro Localizado!</span>
            </div>

            <div className="flex items-center gap-3.5">
              {foundCustomer.photoBase64 ? (
                <img
                  src={foundCustomer.photoBase64}
                  alt={foundCustomer.fullName}
                  className="w-14 h-14 rounded-xl object-cover border-2 border-amber-500 shadow-md flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500 flex-shrink-0">
                  <User className="w-6 h-6 opacity-40" />
                </div>
              )}

              <div className="min-w-0 flex-grow">
                <h4 className="text-base font-black text-white truncate">
                  {foundCustomer.fullName}
                </h4>
                <div className="text-xs text-zinc-400 font-mono mt-0.5">
                  CPF: {foundCustomer.cpf}
                </div>
                {foundCustomer.whatsapp && (
                  <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" />
                    <span>{foundCustomer.whatsapp}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-800/80 space-y-2">
              <button
                type="button"
                onClick={handleConfirmAndBook}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <span>Continuar e Alugar Bike</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleConfirmLogin}
                className="w-full py-2.5 text-xs text-zinc-400 hover:text-white font-medium transition-colors cursor-pointer text-center"
              >
                Permanecer conectado como {foundCustomer.fullName.split(' ')[0]}
              </button>
            </div>
          </div>
        )}

        {/* Not Found State */}
        {notFound && (
          <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-3 animate-fadeIn">
            <div className="text-amber-400 text-2xl">🚲</div>
            <div>
              <h5 className="text-sm font-bold text-white">Nenhum cadastro encontrado</h5>
              <p className="text-xs text-zinc-400 mt-1">
                Não localizamos reservas anteriores com esse documento. Sem problemas, você pode fazer seu cadastro rápido agora!
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onStartBooking) onStartBooking();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-bold text-xs uppercase tracking-wider border border-zinc-700 transition-all cursor-pointer"
            >
              Fazer Primeira Reserva (1 minuto) →
            </button>
          </div>
        )}

        {/* Footer Hint */}
        <div className="pt-2 text-center border-t border-zinc-900">
          <p className="text-[11px] text-zinc-500">
            🔒 Seus dados são protegidos e usados apenas para a retirada da bike em Parintins.
          </p>
        </div>
      </div>
    </div>
  );
};
