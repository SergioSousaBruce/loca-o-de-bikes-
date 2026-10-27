import React, { useState, useEffect, useRef } from 'react';
import { 
  Navigation, 
  MapPin, 
  Clock, 
  Gauge, 
  AlertTriangle, 
  PlusCircle, 
  RotateCcw, 
  ChevronRight, 
  ArrowLeft, 
  Compass, 
  X, 
  Check, 
  Copy, 
  Sparkles, 
  ExternalLink,
  ShieldAlert,
  LocateFixed,
  Send,
  Info
} from 'lucide-react';
import { Reservation, SystemSettings } from '../types';
import { 
  LatLng, 
  PEDALAE_STATION_COORDS, 
  calculateDistanceKm, 
  isSignificantMovement, 
  formatSpeedKmH, 
  estimateBikeReturnMinutes, 
  formatDurationHMS, 
  parseDateTimeToEpoch 
} from '../lib/geoUtils';
import { PARINTINS_ROUTES, PedalaeRoute } from '../lib/parintinsRoutes';
import { saveRideTelemetry, extendReservationDuration, updateReservationStatus } from '../lib/dbService';
import { RideSummaryModal } from './RideSummaryModal';

interface ActiveRideTrackerProps {
  reservation: Reservation;
  settings: SystemSettings;
  onExitTracker: () => void;
}

export const ActiveRideTracker: React.FC<ActiveRideTrackerProps> = ({
  reservation,
  settings,
  onExitTracker,
}) => {
  // Current GPS Position
  const [currentPosition, setCurrentPosition] = useState<LatLng>(() => {
    return {
      lat: PEDALAE_STATION_COORDS.lat,
      lng: PEDALAE_STATION_COORDS.lng,
    };
  });

  // GPS Permission & Status
  const [gpsStatus, setGpsStatus] = useState<'requesting' | 'granted' | 'denied' | 'unavailable'>('requesting');
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

  // Path coordinates array (breadcrumb)
  const [pathPoints, setPathPoints] = useState<LatLng[]>(() => {
    return reservation.rideStats?.pathPoints || [PEDALAE_STATION_COORDS];
  });

  // Telemetry metrics
  const [distanceKm, setDistanceKm] = useState<number>(() => reservation.rideStats?.distanceKm || 0.0);
  const [currentSpeedKmH, setCurrentSpeedKmH] = useState<number>(0.0);
  const [avgSpeedKmH, setAvgSpeedKmH] = useState<number>(() => reservation.rideStats?.avgSpeedKmH || 0.0);
  const speedReadingsRef = useRef<number[]>([]);

  // Time calculations based on timestamps (not simple JS counter)
  const [timeUsedSeconds, setTimeUsedSeconds] = useState<number>(0);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(0);
  const [isOverdue, setIsOverdue] = useState<boolean>(false);

  // Smart Return Calculations
  const [distanceToStationKm, setDistanceToStationKm] = useState<number>(0);
  const [estimatedReturnMinutes, setEstimatedReturnMinutes] = useState<number>(0);
  const [showSmartReturnAlert, setShowSmartReturnAlert] = useState<boolean>(false);
  const hasDismissedSmartReturnAlertRef = useRef<boolean>(false);

  // 15-minute alert
  const [show15MinAlert, setShow15MinAlert] = useState<boolean>(false);
  const hasTriggered15MinAlertRef = useRef<boolean>(false);

  // Route overlay
  const [selectedRoute, setSelectedRoute] = useState<PedalaeRoute | null>(() => {
    if (reservation.rideStats?.selectedRouteId) {
      return PARINTINS_ROUTES.find((r) => r.id === reservation.rideStats?.selectedRouteId) || null;
    }
    return null;
  });
  const [showRoutesModal, setShowRoutesModal] = useState<boolean>(false);

  // Renewal Modal (+1h, +2h)
  const [showRenewalModal, setShowRenewalModal] = useState<boolean>(false);
  const [selectedExtraHours, setSelectedExtraHours] = useState<number>(1);
  const [isRenewing, setIsRenewing] = useState<boolean>(false);
  const [renewalSuccess, setRenewalSuccess] = useState<boolean>(false);
  const [renewalCopiedPix, setRenewalCopiedPix] = useState<boolean>(false);
  const [trackerErrorMessage, setTrackerErrorMessage] = useState<string | null>(null);

  // Finish Ride Modal
  const [showConfirmFinishModal, setShowConfirmFinishModal] = useState<boolean>(false);
  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false);
  const [finishedReservation, setFinishedReservation] = useState<Reservation | null>(null);

  // Watch position reference & save throttling
  const watchIdRef = useRef<number | null>(null);
  const lastSavedTimestampRef = useRef<number>(Date.now());
  const canvasMapRef = useRef<HTMLCanvasElement>(null);

  // Dynamic end time that updates upon in-app renewal
  const [currentEndTime, setCurrentEndTime] = useState<string>(reservation.endTime);

  // Sync if prop updates
  useEffect(() => {
    setCurrentEndTime(reservation.endTime);
  }, [reservation.endTime]);

  // Determine start and end epoch milliseconds from reservation dynamically
  const startEpoch =
    reservation.rideStats?.startedAtEpoch ||
    (reservation.checkin?.checkedInAt
      ? reservation.checkin.checkedInAt
      : parseDateTimeToEpoch(reservation.date, reservation.startTime));

  // Track end epoch (recomputes if currentEndTime changes)
  const endEpoch = parseDateTimeToEpoch(reservation.date, currentEndTime);

  // ---------------- 1. TIMERS CALCULATION (PERMANENT EPOCH-BASED) ----------------
  useEffect(() => {
    const updateTimes = () => {
      const now = Date.now();
      
      // Time Used: now - startEpoch
      const usedSec = Math.max(0, Math.floor((now - startEpoch) / 1000));
      setTimeUsedSeconds(usedSec);

      // Time Remaining: endEpoch - now
      const remainSec = Math.floor((endEpoch - now) / 1000);
      if (remainSec <= 0) {
        setTimeRemainingSeconds(0);
        setIsOverdue(true);
      } else {
        setTimeRemainingSeconds(remainSec);
        setIsOverdue(false);
      }

      // Check 15-minute alert (between 14 and 16 minutes remaining)
      if (remainSec > 0 && remainSec <= 900 && !hasTriggered15MinAlertRef.current) {
        setShow15MinAlert(true);
        hasTriggered15MinAlertRef.current = true;
      }
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, [startEpoch, endEpoch]);

  // ---------------- 2. SMART RETURN CHECK ----------------
  useEffect(() => {
    // Distance to Pedalaê Station
    const distToStation = calculateDistanceKm(currentPosition, PEDALAE_STATION_COORDS);
    setDistanceToStationKm(distToStation);

    // Estimated return minutes at bicycle pace (~12 km/h)
    const returnMins = estimateBikeReturnMinutes(distToStation, avgSpeedKmH);
    setEstimatedReturnMinutes(returnMins);

    // If remaining minutes are less than estimated return minutes + 5 min margin, trigger alert
    const remainingMinutes = Math.floor(timeRemainingSeconds / 60);
    if (
      remainingMinutes > 0 &&
      remainingMinutes <= returnMins + 5 &&
      distToStation > 0.3 && // At least 300m away from station
      !hasDismissedSmartReturnAlertRef.current
    ) {
      setShowSmartReturnAlert(true);
    }
  }, [currentPosition, avgSpeedKmH, timeRemainingSeconds]);

  // ---------------- 3. GEOLOCATION GPS WATCHER ----------------
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('unavailable');
      setGpsErrorMsg('Geolocalização não suportada neste navegador.');
      return;
    }

    const onGeoSuccess = (position: GeolocationPosition) => {
      setGpsStatus('granted');
      setGpsErrorMsg(null);

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const speed = formatSpeedKmH(position.coords.speed);
      const accuracy = position.coords.accuracy;

      const newPoint: LatLng = {
        lat,
        lng,
        timestamp: Date.now(),
        speed: position.coords.speed,
        accuracy,
      };

      setCurrentPosition(newPoint);
      setCurrentSpeedKmH(speed);

      if (speed > 1) {
        speedReadingsRef.current.push(speed);
        if (speedReadingsRef.current.length > 30) {
          speedReadingsRef.current.shift();
        }
        const sum = speedReadingsRef.current.reduce((a, b) => a + b, 0);
        const avg = Math.round((sum / speedReadingsRef.current.length) * 10) / 10;
        setAvgSpeedKmH(avg);
      }

      // Check if movement is significant (avoid false odometer increments)
      setPathPoints((prev) => {
        const lastPoint = prev[prev.length - 1] || null;
        if (isSignificantMovement(lastPoint, newPoint, 8)) {
          const addedDistance = lastPoint ? calculateDistanceKm(lastPoint, newPoint) : 0;
          setDistanceKm((currDist) => {
            const updatedDist = Math.round((currDist + addedDistance) * 100) / 100;
            
            // Throttle database telemetry saves to at least 45 seconds to prevent quota burn
            const now = Date.now();
            if (now - lastSavedTimestampRef.current > 45000) {
              lastSavedTimestampRef.current = now;
              saveRideTelemetry(reservation.id, {
                distanceKm: updatedDist,
                avgSpeedKmH: avgSpeedKmH || 11.5,
                currentSpeedKmH: speed,
                lastRecordedAtEpoch: now,
                selectedRouteId: selectedRoute?.id,
              }).catch((e) => console.warn('Telemetry save warning:', e));
            }

            return updatedDist;
          });
          // Cap points at 500 to keep high performance without memory bloat
          const updated = [...prev, newPoint];
          if (updated.length > 500) {
            return [updated[0], ...updated.slice(updated.length - 490)];
          }
          return updated;
        }
        return prev;
      });
    };

    const onGeoError = (error: GeolocationPositionError) => {
      console.warn('GPS Error code:', error.code, error.message);
      if (error.code === error.PERMISSION_DENIED) {
        setGpsStatus('denied');
        setGpsErrorMsg('Permissão de GPS negada. Ative a localização no navegador para ver o mapa.');
      } else {
        setGpsStatus('unavailable');
        setGpsErrorMsg('Buscando sinal do satélite GPS...');
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(onGeoSuccess, onGeoError, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 20000,
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [reservation.id, selectedRoute, avgSpeedKmH]);

  // ---------------- 4. CANVAS INTERACTIVE MAP RENDERER ----------------
  const [renderTrigger, setRenderTrigger] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      setRenderTrigger((prev) => prev + 1);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const canvas = canvasMapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Collect all coordinates to calculate viewport bounding box
    const allCoords: LatLng[] = [
      PEDALAE_STATION_COORDS,
      currentPosition,
      ...(selectedRoute?.waypoints || []),
      ...pathPoints,
    ];

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (const c of allCoords) {
      if (c.lat < minLat) minLat = c.lat;
      if (c.lat > maxLat) maxLat = c.lat;
      if (c.lng < minLng) minLng = c.lng;
      if (c.lng > maxLng) maxLng = c.lng;
    }

    // Add safe padding to map
    const padLat = Math.max((maxLat - minLat) * 0.25, 0.005);
    const padLng = Math.max((maxLng - minLng) * 0.25, 0.005);
    minLat -= padLat;
    maxLat += padLat;
    minLng -= padLng;
    maxLng += padLng;

    // Helper: LatLng to Canvas Pixel (Mercator-like normalized)
    const toPixel = (pt: LatLng) => {
      const x = ((pt.lng - minLng) / (maxLng - minLng)) * width;
      // Invert Y because canvas origin (0,0) is top-left
      const y = ((maxLat - pt.lat) / (maxLat - minLat)) * height;
      return { x, y };
    };

    // Draw Dark Theme Map Background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    // Draw Map Grid / Water Accent (Rio Amazonas background flair)
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw River Contour Guide
    ctx.fillStyle = 'rgba(14, 165, 233, 0.07)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(width * 0.3, height * 0.15, width * 0.7, height * 0.05, width, height * 0.25);
    ctx.lineTo(width, 0);
    ctx.closePath();
    ctx.fill();

    // 1. Draw Selected Tour Route (if active)
    if (selectedRoute && selectedRoute.waypoints.length > 1) {
      ctx.strokeStyle = selectedRoute.color || '#3b82f6';
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      selectedRoute.waypoints.forEach((wp, idx) => {
        const { x, y } = toPixel(wp);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Draw Return Line to Station (dashed line from current position to station)
    const currentPx = toPixel(currentPosition);
    const stationPx = toPixel(PEDALAE_STATION_COORDS);

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(currentPx.x, currentPx.y);
    ctx.lineTo(stationPx.x, stationPx.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Draw Actual Recorded Ride Path (Solid Amber/Emerald Polyline)
    if (pathPoints.length > 1) {
      ctx.strokeStyle = '#F59E0B'; // Amber 500
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pathPoints.forEach((pt, idx) => {
        const { x, y } = toPixel(pt);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // 4. Draw Pedalaê Station Marker (Base / Ponto de Devolução)
    ctx.fillStyle = '#10B981'; // Emerald
    ctx.beginPath();
    ctx.arc(stationPx.x, stationPx.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label: Ponto Pedalaê
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#A7F3D0';
    ctx.fillText('📍 Ponto Pedalaê', stationPx.x + 12, stationPx.y + 4);

    // 5. Draw Current Position Marker (Pulsing Rider Marker)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.beginPath();
    ctx.arc(currentPx.x, currentPx.y, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3B82F6'; // Bright Blue
    ctx.beginPath();
    ctx.arc(currentPx.x, currentPx.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Label: Você
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#93C5FD';
    ctx.fillText('🚲 Você', currentPx.x + 12, currentPx.y + 4);
  }, [currentPosition, pathPoints, selectedRoute, renderTrigger]);

  // ---------------- 5. EXTEND / RENEW RENTAL HANDLER ----------------
  const handleConfirmRenewal = async () => {
    setIsRenewing(true);
    try {
      // Find plan or calculate price (R$ 10 per hour default)
      const hourlyPrice = settings.plans.find((p) => p.durationHours === 1)?.price || 10.0;
      const additionalPrice = hourlyPrice * selectedExtraHours;

      const { newEndTime } = await extendReservationDuration(
        reservation.id,
        selectedExtraHours,
        additionalPrice
      );

      setCurrentEndTime(newEndTime);

      // Reset alert flags so user gets notified properly near the new end time
      hasTriggered15MinAlertRef.current = false;
      hasDismissedSmartReturnAlertRef.current = false;
      setShow15MinAlert(false);
      setShowSmartReturnAlert(false);
      setRenewalSuccess(true);

      setTimeout(() => {
        setRenewalSuccess(false);
        setShowRenewalModal(false);
      }, 2000);
    } catch (err: any) {
      setTrackerErrorMessage('Erro ao renovar locação: ' + err.message);
      setTimeout(() => setTrackerErrorMessage(null), 5000);
    } finally {
      setIsRenewing(false);
    }
  };

  // ---------------- 6. FINISH RIDE HANDLER ----------------
  const handleFinalizeRide = async () => {
    setShowConfirmFinishModal(false);
    const now = Date.now();
    try {
      await updateReservationStatus(reservation.id, 'devolvida_finalizada', {
        rideStats: {
          ...(reservation.rideStats || { currentSpeedKmH: 0 }),
          distanceKm,
          avgSpeedKmH: avgSpeedKmH || 11.5,
          currentSpeedKmH: 0,
          startedAtEpoch: startEpoch,
          endedAtEpoch: now,
        },
      });

      const updated: Reservation = {
        ...reservation,
        status: 'devolvida_finalizada',
        rideStats: {
          ...(reservation.rideStats || { currentSpeedKmH: 0 }),
          distanceKm,
          avgSpeedKmH: avgSpeedKmH || 11.5,
          currentSpeedKmH: 0,
          startedAtEpoch: startEpoch,
          endedAtEpoch: now,
          pathPoints,
        },
      };

      setFinishedReservation(updated);
      setShowSummaryModal(true);
    } catch (err: any) {
      setTrackerErrorMessage('Erro ao finalizar locação: ' + err.message);
      setTimeout(() => setTrackerErrorMessage(null), 5000);
    }
  };

  // Share ride summary via WhatsApp
  const handleShareOnWhatsApp = () => {
    const text = `🎉 *CONCLUÍ MEU PEDAL NO PEDALAÊ!* 🚲✨\n\n` +
      `📍 *Parintins - AM*\n` +
      `🚲 Bike: ${reservation.bikeSnapshot.name} (${reservation.bikeSnapshot.code})\n` +
      `⏱ Tempo: ${formatDurationHMS(timeUsedSeconds)}\n` +
      `📏 Distância: ${distanceKm.toFixed(1)} km\n` +
      `⚡ Velocidade Média: ${avgSpeedKmH.toFixed(1)} km/h\n\n` +
      `_Alugue. Pedale. Viva o momento com o Pedalaê!_`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans pb-10">
      {/* ================= TOP HEADER CONTROLS ================= */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-amber-500/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onExitTracker}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Minimizar Acompanhamento"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h1 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-1.5">
                <span>PEDAL EM ANDAMENTO</span>
              </h1>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">
              Reserva: <span className="text-amber-400 font-bold">{reservation.code}</span> • {reservation.bikeSnapshot.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Routes Selector Button */}
          <button
            onClick={() => setShowRoutesModal(true)}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200 flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Rotas Parintins</span>
            <span className="sm:hidden">Rotas</span>
          </button>

          {/* Quick Renewal Button */}
          <button
            onClick={() => setShowRenewalModal(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black flex items-center gap-1 cursor-pointer shadow-md shadow-amber-500/20"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Renovar</span>
          </button>
        </div>
      </div>

      {/* ================= ALERTS BANNER NOTIFICATIONS ================= */}
      {/* Error Message Banner */}
      {trackerErrorMessage && (
        <div className="bg-rose-950/80 border-b border-rose-500/50 px-4 py-3 flex items-center justify-between gap-3 text-xs text-rose-200 animate-slide-down">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span className="font-bold text-white">{trackerErrorMessage}</span>
          </div>
          <button
            onClick={() => setTrackerErrorMessage(null)}
            className="p-1 text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. 15-Minute Alert */}
      {show15MinAlert && (
        <div className="bg-amber-500/15 border-b border-amber-500/40 px-4 py-3 flex items-center justify-between gap-3 text-xs text-amber-200 animate-slide-down">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <span className="font-extrabold text-white block">
                ⚠️ SUA LOCAÇÃO TERMINA EM 15 MINUTOS!
              </span>
              <span>Deseja renovar sua locação ou iniciar o retorno ao ponto Pedalaê?</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowRenewalModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] uppercase cursor-pointer"
            >
              Renovar +1h
            </button>
            <button
              onClick={() => setShow15MinAlert(false)}
              className="p-1 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Smart Return Alert */}
      {showSmartReturnAlert && (
        <div className="bg-rose-950/80 border-b border-rose-500/50 px-4 py-3 flex items-center justify-between gap-3 text-xs text-rose-200 animate-slide-down">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <div>
              <span className="font-extrabold text-white block">⚠️ HORA DE RETORNAR!</span>
              <span>
                Você está a ~{estimatedReturnMinutes} min do ponto Pedalaê ({distanceToStationKm.toFixed(1)} km), e restam {Math.floor(timeRemainingSeconds / 60)} min.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowRenewalModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] uppercase cursor-pointer"
            >
              Renovar
            </button>
            <button
              onClick={() => {
                setShowSmartReturnAlert(false);
                hasDismissedSmartReturnAlertRef.current = true;
              }}
              className="p-1 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* GPS Warning if disabled */}
      {gpsStatus === 'denied' && (
        <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 text-xs text-zinc-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Permissão de GPS negada. Ative a localização do celular para o mapa em tempo real.</span>
          </div>
        </div>
      )}

      {/* ================= MAIN CONTAINER ================= */}
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-4 space-y-4">
        {/* ================= 1. PRIMARY METRICS BAR ================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Time Remaining */}
          <div className={`p-3.5 rounded-2xl border ${isOverdue ? 'bg-rose-950/40 border-rose-500/50' : 'bg-zinc-900/90 border-zinc-800'}`}>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
              ⏱ Tempo Restante
            </span>
            <div className={`text-xl sm:text-2xl font-black font-mono mt-0.5 ${isOverdue ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`}>
              {isOverdue ? 'TEMPO ESGOTADO' : formatDurationHMS(timeRemainingSeconds)}
            </div>
            <span className="text-[10px] text-zinc-500 mt-1 block">
              Término: {currentEndTime}
            </span>
          </div>

          {/* Time Used */}
          <div className="bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-2xl">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
              ⏳ Tempo Utilizado
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">
              {formatDurationHMS(timeUsedSeconds)}
            </div>
            <span className="text-[10px] text-zinc-500 mt-1 block">
              Início: {reservation.startTime}
            </span>
          </div>

          {/* Distance Traveled */}
          <div className="bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-2xl">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
              📏 Distância Percorrida
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-0.5">
              {distanceKm.toFixed(1)} <span className="text-xs font-normal text-zinc-400">km</span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-1 block">
              Registrado por GPS
            </span>
          </div>

          {/* Current & Average Speed */}
          <div className="bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-2xl">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
              🚲 Velocidade Atual
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono text-blue-400 mt-0.5">
              {currentSpeedKmH.toFixed(1)} <span className="text-xs font-normal text-zinc-400">km/h</span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-1 block">
              Média: {avgSpeedKmH.toFixed(1)} km/h
            </span>
          </div>
        </div>

        {/* ================= 2. INTERACTIVE MAP VIEW ================= */}
        <div className="relative w-full h-80 sm:h-96 bg-zinc-950 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl">
          <canvas
            ref={canvasMapRef}
            className="w-full h-full block"
          />

          {/* Station Badge Overlay */}
          <div className="absolute top-3 left-3 bg-black/85 backdrop-blur-md border border-zinc-800 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-lg">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <div className="text-[11px]">
              <span className="text-zinc-400 block text-[9px] uppercase font-bold">Ponto Pedalaê</span>
              <span className="font-extrabold text-white">
                {distanceToStationKm.toFixed(1)} km de distância
              </span>
            </div>
          </div>

          {/* Active Tour Route Badge (if selected) */}
          {selectedRoute && (
            <div className="absolute top-3 right-3 bg-black/85 backdrop-blur-md border border-blue-500/40 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedRoute.color }} />
              <div className="text-[11px]">
                <span className="text-blue-300 font-bold block">{selectedRoute.name}</span>
                <span className="text-[10px] text-zinc-400">{selectedRoute.distanceKm} km • ~{selectedRoute.estimatedMinutes} min</span>
              </div>
              <button
                onClick={() => setSelectedRoute(null)}
                className="ml-1 text-zinc-400 hover:text-white"
                title="Remover rota sugerida"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Recenter Map & Compass Action */}
          <div className="absolute bottom-3 right-3 flex flex-col gap-2">
            <button
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition((pos) => {
                    setCurrentPosition({
                      lat: pos.coords.latitude,
                      lng: pos.coords.longitude,
                    });
                  });
                }
              }}
              className="p-3 bg-black/80 hover:bg-black text-amber-400 rounded-2xl border border-zinc-700 shadow-lg active:scale-95 transition-all cursor-pointer"
              title="Centralizar na Minha Posição"
            >
              <LocateFixed className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= 3. RETURN NAVIGATION & ACTIONS ================= */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-zinc-400 uppercase font-bold block">
                  PONTO OFICIAL DE DEVOLUÇÃO
                </span>
                <span className="text-sm font-bold text-white">
                  Praça da Catedral / Orla de Parintins
                </span>
                <div className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                  <span>📍 {distanceToStationKm.toFixed(1)} km</span>
                  <span>•</span>
                  <span>⏱ Retorno estimado: ~{estimatedReturnMinutes} min em pedal regular</span>
                </div>
              </div>
            </div>

            {/* Return Button: Opens Google Maps or Apple Maps with cycling route to station */}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${PEDALAE_STATION_COORDS.lat},${PEDALAE_STATION_COORDS.lng}&travelmode=bicycling`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
            >
              <Navigation className="w-4 h-4 text-amber-400" />
              <span>ROTA PARA RETORNAR</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            </a>
          </div>

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => setShowRenewalModal(true)}
              className="py-4 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 active:scale-98 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>RENOVAR LOCAÇÃO (+ TEMPO)</span>
            </button>

            <button
              onClick={() => setShowConfirmFinishModal(true)}
              className="py-4 px-5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer border border-zinc-700 transition-colors"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>FINALIZAR PEDAL / DEVOLVER</span>
            </button>
          </div>
        </div>

        {/* Informative Privacy Note */}
        <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-850 text-[11px] text-zinc-400 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-zinc-300">Privacidade e Proteção de Dados:</span>
            <p className="mt-0.5 leading-relaxed">
              Sua localização é monitorada exclusivamente durante a pedalada ativa para cálculo de distância, velocidade e suporte de retorno ao Ponto Pedalaê. Nenhuma gravação contínua é mantida após a devolução da bicicleta.
            </p>
          </div>
        </div>
      </div>

      {/* ================= MODAL: ROTAS PARINTINS ================= */}
      {showRoutesModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Compass className="w-5 h-5 text-amber-400" />
                  <span>ROTAS TURÍSTICAS PEDALAÊ</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Escolha um percurso para visualizar no mapa em tempo real
                </p>
              </div>
              <button
                onClick={() => setShowRoutesModal(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {PARINTINS_ROUTES.map((route) => {
                const isSelected = selectedRoute?.id === route.id;
                return (
                  <div
                    key={route.id}
                    onClick={() => {
                      setSelectedRoute(route);
                      setShowRoutesModal(false);
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 shadow-md'
                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-black text-white text-sm">{route.name}</h4>
                        <p className="text-xs text-amber-400/90 font-medium mt-0.5">
                          {route.tagline}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                        {route.difficulty}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                      {route.description}
                    </p>

                    <div className="flex items-center gap-4 mt-3 text-xs font-mono text-zinc-300">
                      <span>📏 {route.distanceKm} km</span>
                      <span>⏱ ~{route.estimatedMinutes} min</span>
                      <span className="text-amber-400 font-bold">{isSelected ? '✓ Rota Ativa no Mapa' : 'Toque para Selecionar'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: RENOVAÇÃO DE LOCAÇÃO ================= */}
      {showRenewalModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="font-black text-white text-base flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-400" />
                <span>RENOVAR LOCAÇÃO</span>
              </h3>
              <button onClick={() => setShowRenewalModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {renewalSuccess ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-500 text-black rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h4 className="text-lg font-black text-white">LOCAÇÃO RENOVADA!</h4>
                <p className="text-xs text-zinc-400">
                  Mais {selectedExtraHours}h adicionadas ao seu horário de entrega sem reiniciar seu pedal!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-zinc-300">
                  Adicione mais tempo para pedalar tranquilamente. O percurso e odômetro não serão reiniciados:
                </p>

                {/* Duration Picker */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setSelectedExtraHours(1)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      selectedExtraHours === 1
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <span className="block font-black text-sm text-white">+1 HORA</span>
                    <span className="text-xs font-mono font-bold text-amber-400">R$ 10,00</span>
                  </button>

                  <button
                    onClick={() => setSelectedExtraHours(2)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      selectedExtraHours === 2
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <span className="block font-black text-sm text-white">+2 HORAS</span>
                    <span className="text-xs font-mono font-bold text-amber-400">R$ 15,00</span>
                  </button>
                </div>

                {/* PIX Quick Details */}
                <div className="bg-black border border-zinc-800 p-3 rounded-xl space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Chave PIX:</span>
                    <span className="font-mono text-white font-bold">{settings.pixKey}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Beneficiário:</span>
                    <span className="text-white">{settings.pixBeneficiary}</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(settings.pixKey);
                      setRenewalCopiedPix(true);
                      setTimeout(() => setRenewalCopiedPix(false), 2000);
                    }}
                    className="w-full mt-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{renewalCopiedPix ? 'Chave Copiada!' : 'Copiar Chave PIX'}</span>
                  </button>
                </div>

                <button
                  onClick={handleConfirmRenewal}
                  disabled={isRenewing}
                  className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider cursor-pointer shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {isRenewing ? 'Atualizando Horário...' : `Confirmar Renovação (+${selectedExtraHours}h)`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: CONFIRMAR FINALIZAÇÃO DO PEDAL ================= */}
      {showConfirmFinishModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-black text-white text-base">FINALIZAR LOCAÇÃO?</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Você já está no Ponto Pedalaê (Orla de Parintins) para devolver a <strong className="text-white">{reservation.bikeSnapshot.name}</strong>?
            </p>
            <p className="text-xs text-zinc-400">
              Ao confirmar, a telemetria será concluída e o resumo da pedalada será gerado para você.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowConfirmFinishModal(false)}
                className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase"
              >
                Voltar
              </button>
              <button
                onClick={handleFinalizeRide}
                className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase shadow-md shadow-emerald-600/20"
              >
                Sim, Devolver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: RESUMO DO PEDAL ================= */}
      {showSummaryModal && finishedReservation && (
        <RideSummaryModal
          reservation={finishedReservation}
          settings={settings}
          onClose={() => {
            setShowSummaryModal(false);
            onExitTracker();
          }}
          onShareWhatsApp={handleShareOnWhatsApp}
        />
      )}
    </div>
  );
};
