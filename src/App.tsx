import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { BookingFlow } from './components/BookingFlow';
import { AdminPanel } from './components/AdminPanel';
import { ActiveRideTracker } from './components/ActiveRideTracker';
import { CustomerLoginModal } from './components/CustomerLoginModal';
import { Bike, CustomerData, RentalPlan, Reservation, SystemSettings } from './types';
import { 
  initializeDatabaseIfEmpty, 
  subscribeBikes, 
  subscribeClients, 
  subscribeReservations, 
  subscribeSettings 
} from './lib/dbService';
import { INITIAL_BIKES, INITIAL_SETTINGS } from './lib/constants';
import { getLocalDateString } from './lib/bikeAvailability';

export type AppView = 'home' | 'booking' | 'admin' | 'ride-tracker';

export default function App() {
  const [settings, setSettings] = useState<SystemSettings>(INITIAL_SETTINGS);
  const [bikes, setBikes] = useState<Bike[]>(INITIAL_BIKES);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clients, setClients] = useState<CustomerData[]>([]);

  // Navigation views with persistence so sudden reload or exit restores view
  const [view, setView] = useState<AppView>(() => {
    try {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash.toLowerCase();
        if (hash === '#admin' || hash === '#painel') {
          return 'admin';
        }
        if (hash === '#ride-tracker' || hash === '#meu-pedal' || hash === '#minha-locacao') {
          return 'ride-tracker';
        }
      }
      const saved = localStorage.getItem('pedalae_current_view') as AppView;
      if (saved === 'booking' || saved === 'admin' || saved === 'home' || saved === 'ride-tracker') {
        return saved;
      }
    } catch {}
    return 'home';
  });

  const [preselectedBike, setPreselectedBike] = useState<Bike | null>(() => {
    try {
      const saved = localStorage.getItem('pedalae_preselected_bike');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return null;
  });

  const [preselectedPlan, setPreselectedPlan] = useState<RentalPlan | null>(() => {
    try {
      const saved = localStorage.getItem('pedalae_preselected_plan');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return null;
  });

  // Track active reservation ID for tracker (specific to this customer's device)
  const [activeRideReservationId, setActiveRideReservationId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('pedalae_active_ride_id');
    } catch {
      return null;
    }
  });

  // Identified returning customer session
  const [identifiedCustomer, setIdentifiedCustomer] = useState<CustomerData | null>(() => {
    try {
      const saved = localStorage.getItem('pedalae_identified_customer');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [isCustomerLoginOpen, setIsCustomerLoginOpen] = useState(false);

  const handleCustomerIdentified = (customer: CustomerData) => {
    setIdentifiedCustomer(customer);
    try {
      localStorage.setItem('pedalae_identified_customer', JSON.stringify(customer));
    } catch {}
  };

  const handleLogoutCustomer = () => {
    setIdentifiedCustomer(null);
    try {
      localStorage.removeItem('pedalae_identified_customer');
      localStorage.removeItem('pedalae_booking_draft');
    } catch {}
  };

  // Keep view saved
  const handleSetView = (nextView: AppView) => {
    setView(nextView);
    try {
      localStorage.setItem('pedalae_current_view', nextView);
    } catch {}
  };

  // Initialize DB and real-time Firestore subscriptions
  useEffect(() => {
    initializeDatabaseIfEmpty();

    const unsubSettings = subscribeSettings((st) => setSettings(st));
    const unsubBikes = subscribeBikes((bList) => setBikes(bList));
    const unsubRes = subscribeReservations((rList) => setReservations(rList));
    const unsubClients = subscribeClients((cList) => setClients(cList));

    return () => {
      unsubSettings();
      unsubBikes();
      unsubRes();
      unsubClients();
    };
  }, []);

  // Listen to hash changes (e.g. #admin, #ride-tracker, #home)
  useEffect(() => {
    const handleHash = () => {
      if (typeof window === 'undefined') return;
      const hash = window.location.hash.toLowerCase();
      if (hash === '#admin' || hash === '#painel') {
        setView('admin');
      } else if (hash === '#ride-tracker' || hash === '#meu-pedal' || hash === '#minha-locacao') {
        setView('ride-tracker');
      } else if (hash === '#home' || hash === '#inicio') {
        setView('home');
      } else if (hash === '#reservar' || hash === '#reserva') {
        setView('booking');
      }
    };

    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Find currently active rental belonging specifically to this customer's session for today
  const currentActiveReservation = React.useMemo(() => {
    // 1. Verificar por activeRideReservationId
    if (activeRideReservationId) {
      const found = reservations.find((r) => r.id === activeRideReservationId);
      if (found) {
        const isActiveStatus =
          found.status === 'bike_em_uso' ||
          found.status === 'pagamento_confirmado' ||
          found.status === 'bike_retirada';
        const isToday = found.date === getLocalDateString();
        if (isActiveStatus && (isToday || found.status === 'bike_em_uso')) {
          return found;
        }
      }
    }

    // 2. Verificar por cliente autenticado/identificado
    if (identifiedCustomer) {
      const cleanCpf = identifiedCustomer.cpfClean || (identifiedCustomer.cpf || '').replace(/\D/g, '');
      const found = reservations.find((r) => {
        const rCpf = r.customerSnapshot?.cpfClean || (r.customerSnapshot?.cpf || '').replace(/\D/g, '');
        return rCpf === cleanCpf && (r.status === 'bike_em_uso' || r.status === 'bike_retirada' || r.status === 'pagamento_confirmado');
      });
      if (found) return found;
    }

    // 3. Verificar se há alguma reserva com status 'bike_em_uso' no aparelho
    const anyInUse = reservations.find((r) => r.status === 'bike_em_uso');
    if (anyInUse && anyInUse.id === activeRideReservationId) {
      return anyInUse;
    }

    return null;
  }, [reservations, activeRideReservationId, identifiedCustomer]);

  const handleSelectBikeForBooking = (bike: Bike) => {
    setPreselectedBike(bike);
    try {
      localStorage.setItem('pedalae_preselected_bike', JSON.stringify(bike));
    } catch {}
    handleSetView('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectPlanForBooking = (plan: RentalPlan) => {
    setPreselectedPlan(plan);
    try {
      localStorage.setItem('pedalae_preselected_plan', JSON.stringify(plan));
    } catch {}
    const el = document.getElementById('section-bikes');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      handleSetView('booking');
    }
  };

  const handleStartBooking = () => {
    setPreselectedBike(null);
    try {
      localStorage.removeItem('pedalae_preselected_bike');
    } catch {}
    handleSetView('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateHome = () => {
    handleSetView('home');
  };

  const handleToggleAdmin = () => {
    handleSetView(view === 'admin' ? 'home' : 'admin');
  };

  const handleStartRideTracker = (reservation: Reservation) => {
    setActiveRideReservationId(reservation.id);
    try {
      localStorage.setItem('pedalae_active_ride_id', reservation.id);
    } catch {}
    handleSetView('ride-tracker');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenRideTracker = (reservation?: Reservation) => {
    const target = reservation || currentActiveReservation;
    if (target) {
      setActiveRideReservationId(target.id);
      try {
        localStorage.setItem('pedalae_active_ride_id', target.id);
      } catch {}
    }
    handleSetView('ride-tracker');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-amber-400 selection:text-black">
      {/* Top Header - hidden when full screen in ride tracker for maximal mobile screen real-estate */}
      {view !== 'ride-tracker' && (
        <Header
          onNavigateHome={handleNavigateHome}
          onOpenBooking={handleStartBooking}
          onOpenAdmin={handleToggleAdmin}
          isAdminOpen={view === 'admin'}
          whatsappUrl={settings.whatsappOfficialUrl}
          instagramUrl={settings.instagramUrl}
          facebookUrl={settings.facebookUrl}
          tiktokUrl={settings.tiktokUrl}
          identifiedCustomer={identifiedCustomer}
          onOpenCustomerLogin={() => setIsCustomerLoginOpen(true)}
          onLogoutCustomer={handleLogoutCustomer}
          activeRental={
            currentActiveReservation
              ? {
                  code: currentActiveReservation.code,
                  bikeName: currentActiveReservation.bikeSnapshot.name,
                }
              : null
          }
          onOpenActiveTracker={() => {
            if (currentActiveReservation) {
              handleOpenRideTracker(currentActiveReservation);
            }
          }}
          isTrackerOpen={false}
        />
      )}

      {/* Main Views */}
      <div className="flex-grow">
        {view === 'home' && (
          <HomePage
            settings={settings}
            bikes={bikes}
            reservations={reservations}
            plans={settings.plans}
            selectedPlan={preselectedPlan}
            onSelectPlanForBooking={handleSelectPlanForBooking}
            identifiedCustomer={identifiedCustomer}
            onOpenCustomerLogin={() => setIsCustomerLoginOpen(true)}
            onLogoutCustomer={handleLogoutCustomer}
            onSelectBikeForBooking={handleSelectBikeForBooking}
            onStartBooking={handleStartBooking}
            onScrollToBikes={() => {
              const el = document.getElementById('section-bikes');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            activeReservation={currentActiveReservation}
            onOpenActiveRide={() => handleOpenRideTracker(currentActiveReservation || undefined)}
          />
        )}

        {view === 'booking' && (
          <BookingFlow
            settings={settings}
            bikes={bikes}
            reservations={reservations}
            initialBike={preselectedBike}
            initialCustomer={identifiedCustomer}
            initialPlan={preselectedPlan}
            onCancel={handleNavigateHome}
            onFinished={(res) => {
              // Reservation created, save ID
              setActiveRideReservationId(res.id);
              try {
                localStorage.setItem('pedalae_active_ride_id', res.id);
              } catch {}
            }}
            onStartTracking={(res) => {
              handleOpenRideTracker(res);
            }}
          />
        )}

        {view === 'admin' && (
          <AdminPanel
            settings={settings}
            bikes={bikes}
            reservations={reservations}
            clients={clients}
            onClose={handleNavigateHome}
          />
        )}

        {view === 'ride-tracker' && (
          currentActiveReservation ? (
            <ActiveRideTracker
              reservation={currentActiveReservation}
              settings={settings}
              onExitTracker={handleNavigateHome}
            />
          ) : (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl mb-4">
                🚲
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Nenhum pedal em andamento no momento</h2>
              <p className="text-sm text-zinc-400 max-w-md mb-6">
                Assim que você confirmar o pagamento de uma locação e retirar a bicicleta, você poderá acompanhar todo o trajeto em tempo real pelo mapa.
              </p>
              <button
                onClick={handleNavigateHome}
                className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm uppercase tracking-wider transition-all"
              >
                Voltar para o Início
              </button>
            </div>
          )
        )}
      </div>

      {/* Quick Customer Login Modal */}
      <CustomerLoginModal
        isOpen={isCustomerLoginOpen}
        onClose={() => setIsCustomerLoginOpen(false)}
        onCustomerIdentified={(customer) => {
          handleCustomerIdentified(customer);
        }}
        onStartBooking={handleStartBooking}
      />
    </div>
  );
}
