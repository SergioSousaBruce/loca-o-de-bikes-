import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Bike, 
  CustomerData, 
  Reservation, 
  ReservationStatus, 
  SystemSettings,
  RentalPlan
} from '../types';
import { 
  createBike, 
  updateBike, 
  deleteBike, 
  updateSettings, 
  updateReservationStatus,
  deleteReservation,
  deleteClient,
  timeToMinutes,
  minutesToTime,
  exportDatabaseBackup,
  importDatabaseBackup,
  getCloudQuotaStatus
} from '../lib/dbService';
import { getLocalDateString } from '../lib/bikeAvailability';
import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  Bike as BikeIcon, 
  Users, 
  DollarSign, 
  FileText, 
  BarChart3, 
  Settings as SettingsIcon, 
  Search, 
  Filter, 
  Check, 
  X, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  CheckCircle2, 
  LogOut, 
  Plus, 
  Edit2, 
  Trash2, 
  Camera, 
  QrCode, 
  Download, 
  Upload,
  Eye, 
  EyeOff,
  Send,
  Lock,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  UserCheck,
  RefreshCw,
  ChevronRight,
  MapPin,
  PenTool,
  History as HistoryIcon,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Share2
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { 
  generateReservationPDF, 
  downloadOrShareReservationPDF, 
  openReservationPDFInNewTab 
} from '../lib/pdfGenerator';
import { OFFICIAL_WHATSAPP_LINK, getWhatsAppSendTermToClientUrl } from '../lib/whatsapp';
import { RentalHistoryView } from './RentalHistoryView';
import { parseDateTimeToEpoch, formatDurationHMS } from '../lib/geoUtils';
import { compressImage } from '../lib/imageUtils';

interface AdminPanelProps {
  settings: SystemSettings;
  bikes: Bike[];
  reservations: Reservation[];
  clients: CustomerData[];
  onClose: () => void;
}

type AdminTab = 
  | 'dashboard'
  | 'historico_locacoes'
  | 'reservas'
  | 'calendario'
  | 'bikes'
  | 'clientes'
  | 'financeiro'
  | 'documentos'
  | 'relatorios'
  | 'configuracoes';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  settings,
  bikes,
  reservations,
  clients,
  onClose,
}) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('pedalae_admin_auth') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemainingSeconds, setLockoutRemainingSeconds] = useState(0);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [loggedAdminUser, setLoggedAdminUser] = useState<User | null>(null);

  // Dedicated Password & Access Management in Settings
  const [editAdminEmail, setEditAdminEmail] = useState(settings.adminEmail || 'sergiobruce19@gmail.com');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Navigation tab with localStorage persistence
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    try {
      const savedTab = localStorage.getItem('pedalae_admin_tab') as AdminTab;
      const validTabs: AdminTab[] = [
        'dashboard',
        'historico_locacoes',
        'reservas',
        'calendario',
        'bikes',
        'clientes',
        'financeiro',
        'documentos',
        'relatorios',
        'configuracoes',
      ];
      if (savedTab && validTabs.includes(savedTab)) {
        return savedTab;
      }
    } catch {}
    return 'dashboard';
  });

  const handleSetActiveTab = (tab: AdminTab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('pedalae_admin_tab', tab);
    } catch {}
  };

  // Selected reservation for check-in / check-out modal
  const [selectedResForDetail, setSelectedResForDetail] = useState<Reservation | null>(null);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutRemainingSeconds(remaining);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setAuthError('');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  // Sync Google Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setLoggedAdminUser(user);
      if (user && user.email) {
        const allowedEmail = (settings.adminEmail || 'sergiobruce19@gmail.com').toLowerCase();
        if (user.email.toLowerCase() === allowedEmail) {
          setIsAuthenticated(true);
          sessionStorage.setItem('pedalae_admin_auth', 'true');
        }
      }
    });
    return () => unsub();
  }, [settings.adminEmail]);

  // Check-in modal form
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [checkinOperator, setCheckinOperator] = useState('Admin Pedalaê');
  const [checkinBikeOk, setCheckinBikeOk] = useState(true);
  const [checkinNotes, setCheckinNotes] = useState('');
  const [checkinTermSigned, setCheckinTermSigned] = useState(true);
  const [startTimerNow, setStartTimerNow] = useState(true);
  const [checkinStartTime, setCheckinStartTime] = useState('');
  const [checkinEndTime, setCheckinEndTime] = useState('');
  const [checkinAllGroupBikes, setCheckinAllGroupBikes] = useState(true);

  // Check-out modal form
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutOperator, setCheckoutOperator] = useState('Admin Pedalaê');
  const [checkoutCondition, setCheckoutCondition] = useState<'normal' | 'avaria' | 'problema_mecanico' | 'outros'>('normal');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [checkoutPhoto, setCheckoutPhoto] = useState<string>('');

  // Bike Management Modal
  const [isBikeModalOpen, setIsBikeModalOpen] = useState(false);
  const [editingBike, setEditingBike] = useState<Bike | null>(null);
  const [bikeCode, setBikeCode] = useState('');
  const [bikeName, setBikeName] = useState('');
  const [bikeModel, setBikeModel] = useState('');
  const [bikeColor, setBikeColor] = useState('');
  const [bikeDescription, setBikeDescription] = useState('');
  const [bikePhotoUrl, setBikePhotoUrl] = useState('');
  const [bikeStatus, setBikeStatus] = useState<'available' | 'maintenance' | 'inactive'>('available');
  const [bikeNotes, setBikeNotes] = useState('');
  const [hasSmartTag, setHasSmartTag] = useState(false);
  const [smartTagType, setSmartTagType] = useState<'samsung' | 'apple' | 'google' | 'other'>('samsung');
  const [smartTagName, setSmartTagName] = useState('');
  const [smartTagSerial, setSmartTagSerial] = useState('');
  const [smartTagFindUrl, setSmartTagFindUrl] = useState('');

  // Bike photo upload & camera state
  const [isProcessingBikePhoto, setIsProcessingBikePhoto] = useState(false);
  const [showManualUrlInput, setShowManualUrlInput] = useState(false);
  const bikePhotoInputRef = useRef<HTMLInputElement>(null);
  const bikeCameraInputRef = useRef<HTMLInputElement>(null);
  const quickCardPhotoInputRef = useRef<HTMLInputElement>(null);
  const [quickUpdateBikeId, setQuickUpdateBikeId] = useState<string | null>(null);
  const [isQuickUpdatingPhoto, setIsQuickUpdatingPhoto] = useState(false);

  // Settings Form State
  const [editCompanyName, setEditCompanyName] = useState(settings.companyName);
  const [editSlogan, setEditSlogan] = useState(settings.slogan);
  const [editAddress, setEditAddress] = useState(settings.address);
  const [editWhatsappDisplay, setEditWhatsappDisplay] = useState(settings.whatsappDisplay);
  const [editPixKey, setEditPixKey] = useState(settings.pixKey);
  const [editOpeningTime, setEditOpeningTime] = useState(settings.openingTime);
  const [editClosingTime, setEditClosingTime] = useState(settings.closingTime);
  const [editTermText, setEditTermText] = useState(settings.termText);
  const [editPlans, setEditPlans] = useState<RentalPlan[]>(settings.plans);
  const [editInstagramUrl, setEditInstagramUrl] = useState(settings.instagramUrl || 'https://www.instagram.com/pedalae.parintins?stkn=MTl4YmZrMnM4MDhpYg==');
  const [editFacebookUrl, setEditFacebookUrl] = useState(
    settings.facebookUrl && !settings.facebookUrl.includes('61573909772391') && !settings.facebookUrl.includes('61594762945870')
      ? settings.facebookUrl
      : 'https://www.facebook.com/profile.php?id=61595687457272'
  );
  const [editTiktokUrl, setEditTiktokUrl] = useState(settings.tiktokUrl || 'https://www.tiktok.com/@pedalae.parintins');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setEditCompanyName(settings.companyName);
    setEditSlogan(settings.slogan);
    setEditAddress(settings.address);
    setEditWhatsappDisplay(settings.whatsappDisplay);
    setEditPixKey(settings.pixKey);
    setEditOpeningTime(settings.openingTime);
    setEditClosingTime(settings.closingTime);
    setEditTermText(settings.termText);
    setEditPlans(settings.plans);
    if (settings.instagramUrl) setEditInstagramUrl(settings.instagramUrl);
    if (settings.facebookUrl) {
      setEditFacebookUrl(
        settings.facebookUrl.includes('61573909772391') || settings.facebookUrl.includes('61594762945870')
          ? 'https://www.facebook.com/profile.php?id=61595687457272'
          : settings.facebookUrl
      );
    }
    if (settings.tiktokUrl) setEditTiktokUrl(settings.tiktokUrl);
  }, [settings]);

  // Filters
  const [reservationSearch, setReservationSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Quick QR Code Scanner input
  const [qrScanInput, setQrScanInput] = useState('');

  // Backup Export & Import Handlers
  const handleExportBackup = () => {
    try {
      const json = exportDatabaseBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const nowStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `pedalae-backup-oficial-${nowStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showAdminToast('Backup completo exportado com sucesso! Arquivo JSON salvo com segurança.');
    } catch (e: any) {
      showAdminToast(`Erro ao exportar backup: ${e.message}`, 'error');
    }
  };

  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const res = importDatabaseBackup(text);
        if (res.success) {
          showAdminToast(res.message, 'success');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          showAdminToast(res.message, 'error');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Current date string for filtering "Today" (using local timezone of Brazil/Parintins)
  const todayStr = getLocalDateString(new Date());

  // Non-blocking Admin Toast notification system
  const [adminToast, setAdminToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showAdminToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setAdminToast({ message, type });
    setTimeout(() => setAdminToast(null), 4500);
  };

  // Bike deletion modal state
  const [bikeToDelete, setBikeToDelete] = useState<Bike | null>(null);
  const [isDeletingBike, setIsDeletingBike] = useState(false);

  // Handle Master Password Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutUntil && Date.now() < lockoutUntil) {
      setAuthError(`Acesso bloqueado temporariamente por segurança. Aguarde ${lockoutRemainingSeconds}s.`);
      return;
    }

    const validPass = settings.adminPasswordHash || 'admin123';
    if (passwordInput.trim() === validPass) {
      setIsAuthenticated(true);
      sessionStorage.setItem('pedalae_admin_auth', 'true');
      setAuthError('');
      setPasswordInput('');
      setFailedAttempts(0);
      setLockoutUntil(null);
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 5) {
        const lockTime = Date.now() + 60000;
        setLockoutUntil(lockTime);
        setLockoutRemainingSeconds(60);
        setAuthError('Bloqueio de segurança ativado após 5 tentativas incorretas. Aguarde 60 segundos.');
      } else {
        const remaining = 5 - newAttempts;
        setAuthError(`Senha incorreta. Acesso restrito exclusivamente ao administrador do PEDALAÊ. (${remaining} ${remaining === 1 ? 'tentativa restante' : 'tentativas restantes'})`);
      }
    }
  };

  // Handle Google Admin OAuth Login
  const handleGoogleAdminLogin = async () => {
    setIsGoogleLoading(true);
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const loggedEmail = result.user.email?.toLowerCase() || '';
      const allowedEmail = (settings.adminEmail || 'sergiobruce19@gmail.com').toLowerCase();

      if (loggedEmail === allowedEmail) {
        setIsAuthenticated(true);
        sessionStorage.setItem('pedalae_admin_auth', 'true');
        setAuthError('');
        setFailedAttempts(0);
        setLockoutUntil(null);
      } else {
        await signOut(auth);
        setAuthError(`Acesso Negado: A conta Google "${result.user.email}" não possui permissão de Administrador. Apenas ${allowedEmail} tem acesso.`);
      }
    } catch (err: any) {
      console.warn('Google sign-in:', err);
      if (err.code === 'auth/popup-blocked') {
        setAuthError('A janela de login do Google foi bloqueada pelo navegador. Permita popups para este site ou entre usando sua senha.');
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setAuthError('Não foi possível autenticar com o Google. Utilize a sua Senha Mestre de administrador.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('pedalae_admin_auth');
    try {
      await signOut(auth);
    } catch {}
  };

  // Dedicated Password Change Handler
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError('');
    setPasswordChangeSuccess('');

    if (!newAdminPassword || newAdminPassword.trim().length < 4) {
      setPasswordChangeError('A nova senha deve conter no mínimo 4 caracteres.');
      return;
    }
    if (newAdminPassword !== confirmAdminPassword) {
      setPasswordChangeError('A confirmação de senha não confere. Digite a mesma senha nos dois campos.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await updateSettings({
        adminPasswordHash: newAdminPassword.trim(),
        adminEmail: editAdminEmail.trim() || 'sergiobruce19@gmail.com',
      });
      setPasswordChangeSuccess('✅ Senha de Administrador atualizada com sucesso no banco de dados! Apenas você com esta senha ou sua conta Google autorizada tem acesso.');
      setNewAdminPassword('');
      setConfirmAdminPassword('');
    } catch (err: any) {
      setPasswordChangeError('Erro ao salvar no banco de dados: ' + err.message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Status Colors & Badges
  const getStatusBadge = (status: ReservationStatus) => {
    switch (status) {
      case 'aguardando_pagamento':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Aguardando Pagamento
          </span>
        );
      case 'pagamento_confirmado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Pagamento Confirmado
          </span>
        );
      case 'aguardando_retirada':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Aguardando Retirada
          </span>
        );
      case 'bike_retirada':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            Bike Retirada
          </span>
        );
      case 'bike_em_uso':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            Bike em Uso
          </span>
        );
      case 'devolvida_finalizada':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
            <Check className="w-3 h-3 text-emerald-400" />
            Devolvida / Finalizada
          </span>
        );
      case 'cancelada':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Cancelada
          </span>
        );
      case 'cancelamento_solicitado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-950/60 text-red-300 border border-red-500/40">
            Cancelamento Solicitado
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  // Overdue check
  const isOverdue = (res: Reservation) => {
    if (res.status !== 'bike_retirada' && res.status !== 'bike_em_uso') return false;
    const now = new Date();
    const [year, month, day] = res.date.split('-').map(Number);
    const [endHour, endMin] = res.endTime.split(':').map(Number);
    const endDateTime = new Date(year, month - 1, day, endHour, endMin);
    return now.getTime() > endDateTime.getTime();
  };

  // Dashboard Metrics
  const todayReservations = reservations.filter((r) => r.date === todayStr);
  const availableBikesCount = bikes.filter((b) => b.status === 'available').length;
  const inUseBikesCount = reservations.filter(
    (r) => r.status === 'bike_retirada' || r.status === 'bike_em_uso'
  ).length;
  const waitingPaymentCount = reservations.filter(
    (r) => r.status === 'aguardando_pagamento'
  ).length;
  const confirmedTodayCount = todayReservations.filter(
    (r) => r.status !== 'cancelada' && r.status !== 'aguardando_pagamento'
  ).length;
  const finishedTodayCount = todayReservations.filter(
    (r) => r.status === 'devolvida_finalizada'
  ).length;
  const revenueToday = todayReservations
    .filter((r) => r.status !== 'cancelada' && r.paymentConfirmedAt)
    .reduce((acc, curr) => acc + curr.totalPrice, 0);

  // Overdue reservations list
  const overdueReservations = reservations.filter(isOverdue);

  // Filtered reservations list
  const filteredReservations = reservations.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (dateFilter && r.date !== dateFilter) return false;
    if (reservationSearch) {
      const q = reservationSearch.toLowerCase();
      const codeMatch = r.code.toLowerCase().includes(q);
      const nameMatch = r.customerSnapshot.fullName.toLowerCase().includes(q);
      const cpfMatch = r.customerSnapshot.cpf.includes(q);
      const bikeMatch = r.bikeSnapshot.name.toLowerCase().includes(q);
      if (!codeMatch && !nameMatch && !cpfMatch && !bikeMatch) return false;
    }
    return true;
  });

  // Action: Open Checkin Modal
  const openCheckin = (res: Reservation) => {
    setSelectedResForDetail(res);
    setCheckinOperator('Administrador Pedalaê');
    setCheckinBikeOk(true);
    setCheckinNotes('');
    setCheckinTermSigned(true);

    // Calculate current hour and minute in Parintins/local time
    const now = new Date();
    const currentHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const durationHours = res.durationHours || 1;
    const currentMins = timeToMinutes(currentHHmm);
    const newEndHHmm = minutesToTime(currentMins + durationHours * 60);

    setStartTimerNow(true);
    setCheckinStartTime(currentHHmm);
    setCheckinEndTime(newEndHHmm);
    setCheckinAllGroupBikes(true);
    setIsCheckinModalOpen(true);
  };

  // Double-click protection and checkout timing calculations (ETAPA 6)
  const [isCheckingIn, setIsCheckingIn] = useState<boolean>(false);
  const [isFinalizingCheckout, setIsFinalizingCheckout] = useState<boolean>(false);

  const checkoutElapsedStr = useMemo(() => {
    if (!selectedResForDetail) return '0 min';
    const startEpoch = selectedResForDetail.checkin?.checkedInAt || parseDateTimeToEpoch(selectedResForDetail.date, selectedResForDetail.startTime);
    const now = Date.now();
    const elapsedSec = Math.max(0, Math.floor((now - startEpoch) / 1000));
    const hours = Math.floor(elapsedSec / 3600);
    const mins = Math.floor((elapsedSec % 3600) / 60);
    if (hours === 0) return `${mins} min`;
    return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
  }, [selectedResForDetail]);

  const checkoutOverdueInfo = useMemo(() => {
    if (!selectedResForDetail) return { isOverdue: false, overdueMins: 0 };
    const endEpoch = parseDateTimeToEpoch(selectedResForDetail.date, selectedResForDetail.endTime);
    const now = Date.now();
    if (now > endEpoch) {
      const diffSec = Math.floor((now - endEpoch) / 1000);
      const overdueMins = Math.floor(diffSec / 60);
      return { isOverdue: true, overdueMins };
    }
    return { isOverdue: false, overdueMins: 0 };
  }, [selectedResForDetail]);

  const handleConfirmCheckin = async () => {
    if (!selectedResForDetail || isCheckingIn) return;
    setIsCheckingIn(true);
    try {
      const nowEpoch = Date.now();
      const actualStart = startTimerNow && checkinStartTime ? checkinStartTime : selectedResForDetail.startTime;
      const actualEnd = startTimerNow && checkinEndTime ? checkinEndTime : selectedResForDetail.endTime;

      const updatePayload: Partial<Reservation> = {
        startTime: actualStart,
        endTime: actualEnd,
        actualStartTime: actualStart,
        actualEndTime: actualEnd,
        checkin: {
          checkedInAt: nowEpoch,
          checkedInBy: checkinOperator,
          bikeConditionOk: checkinBikeOk,
          notes: checkinNotes,
          termAgreedPhysically: checkinTermSigned,
        },
        rideStats: {
          distanceKm: selectedResForDetail.rideStats?.distanceKm || 0,
          avgSpeedKmH: selectedResForDetail.rideStats?.avgSpeedKmH || 0,
          currentSpeedKmH: 0,
          startedAtEpoch: nowEpoch,
          pathPoints: selectedResForDetail.rideStats?.pathPoints || [],
        },
      };

      await updateReservationStatus(selectedResForDetail.id, 'bike_em_uso', updatePayload);

      // If part of group booking and option selected, also check-in sibling bikes
      if (checkinAllGroupBikes && selectedResForDetail.groupBookingId) {
        const groupSiblings = reservations.filter(
          (r) => r.groupBookingId === selectedResForDetail.groupBookingId &&
                 r.id !== selectedResForDetail.id &&
                 r.status !== 'cancelada' &&
                 r.status !== 'devolvida_finalizada'
        );
        for (const sib of groupSiblings) {
          await updateReservationStatus(sib.id, 'bike_em_uso', updatePayload);
        }
      }

      setIsCheckinModalOpen(false);
      setSelectedResForDetail(null);
      showAdminToast('Retirada confirmada e contagem da bike iniciada agora!', 'success');
    } catch (err: any) {
      showAdminToast(err.message || 'Erro ao confirmar retirada', 'error');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Action: Open Checkout Modal
  const openCheckout = (res: Reservation) => {
    setSelectedResForDetail(res);
    setCheckoutOperator('Administrador Pedalaê');
    setCheckoutCondition('normal');
    setCheckoutNotes('');
    setCheckoutPhoto('');
    setIsCheckoutModalOpen(true);
  };

  const handleConfirmCheckout = async () => {
    if (!selectedResForDetail || isFinalizingCheckout) return;
    setIsFinalizingCheckout(true);
    try {
      const now = new Date();
      const currentHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      await updateReservationStatus(selectedResForDetail.id, 'devolvida_finalizada', {
        actualEndTime: currentHHmm,
        checkout: {
          checkedOutAt: Date.now(),
          checkedOutBy: checkoutOperator,
          conditionStatus: checkoutCondition,
          notes: checkoutNotes,
          photoUrl: checkoutPhoto,
        },
      });
      showAdminToast(`Locação da bike ${selectedResForDetail.bikeSnapshot.code} finalizada com sucesso! Rastreamento encerrado.`, 'success');
      setIsCheckoutModalOpen(false);
      setSelectedResForDetail(null);
    } catch (err: any) {
      showAdminToast(`Erro ao finalizar locação: ${err?.message || err}`, 'error');
    } finally {
      setIsFinalizingCheckout(false);
    }
  };

  // In-App Modal for Cancellation (replaces window.prompt)
  const [resToCancel, setResToCancel] = useState<Reservation | null>(null);
  const [cancellationReasonInput, setCancellationReasonInput] = useState<string>('');
  const [isCancellingRes, setIsCancellingRes] = useState<boolean>(false);

  // Action: Cancel Reservation
  const handleCancelReservation = (reservation: Reservation) => {
    setResToCancel(reservation);
    setCancellationReasonInput('Cancelado pela administração');
  };

  const handleExecuteCancelReservation = async () => {
    if (!resToCancel) return;
    setIsCancellingRes(true);
    try {
      await updateReservationStatus(resToCancel.id, 'cancelada', {
        cancellationReason: cancellationReasonInput.trim() || 'Cancelado pela administração',
        cancellationReviewedAt: Date.now(),
        cancellationReviewedBy: 'Administrador Pedalaê',
      });
      if (selectedResForDetail?.id === resToCancel.id) {
        setSelectedResForDetail(null);
      }
      setResToCancel(null);
      showAdminToast('Reserva cancelada com sucesso.', 'info');
    } catch (err: any) {
      console.error('Erro ao cancelar reserva:', err);
      showAdminToast('Erro ao cancelar reserva: ' + err.message, 'error');
    } finally {
      setIsCancellingRes(false);
    }
  };

  // Action: Delete Reservation Permanently
  const [resToDelete, setResToDelete] = useState<Reservation | null>(null);
  const [isDeletingRes, setIsDeletingRes] = useState<boolean>(false);
  const [deleteSuccessToast, setDeleteSuccessToast] = useState<string | null>(null);
  const [pdfConfirmedToast, setPdfConfirmedToast] = useState<string | null>(null);
  const [generatingPdfResId, setGeneratingPdfResId] = useState<string | null>(null);
  const [lastGeneratedPdf, setLastGeneratedPdf] = useState<{ resId: string; code: string; blobUrl: string; filename: string } | null>(null);

  // Action: Delete Client Permanently (Full Owner Autonomy)
  const [clientToDelete, setClientToDelete] = useState<CustomerData | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState<boolean>(false);
  const [deleteClientToast, setDeleteClientToast] = useState<string | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');

  // Dashboard Toggle: Today vs All Permanent Reservations
  const [dashboardViewMode, setDashboardViewMode] = useState<'today' | 'all'>('today');

  // In-App Modal for Payment Confirmation (works reliably without window.confirm blocks)
  const [resToConfirmPayment, setResToConfirmPayment] = useState<Reservation | null>(null);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState<boolean>(false);
  const [paymentSuccessToast, setPaymentSuccessToast] = useState<string | null>(null);

  // Action: Confirm Payment
  const handleConfirmPayment = (reservation: Reservation) => {
    setResToConfirmPayment(reservation);
  };

  const handleExecuteConfirmPayment = async () => {
    if (!resToConfirmPayment) return;
    setIsConfirmingPayment(true);
    try {
      const now = Date.now();
      await updateReservationStatus(resToConfirmPayment.id, 'pagamento_confirmado', {
        paymentConfirmedAt: now,
        paymentConfirmedBy: 'Sergio de Sousa Bruce (Administrador)',
      });
      // Refresh current detail modal if open
      setSelectedResForDetail((prev) =>
        prev && prev.id === resToConfirmPayment.id
          ? { ...prev, status: 'pagamento_confirmado', paymentConfirmedAt: now, paymentConfirmedBy: 'Sergio de Sousa Bruce (Administrador)' }
          : prev
      );
      setPaymentSuccessToast(`Pagamento da reserva ${resToConfirmPayment.code} confirmado com sucesso!`);
      setTimeout(() => setPaymentSuccessToast(null), 4000);
      setResToConfirmPayment(null);
    } catch (err: any) {
      console.error('Erro ao confirmar pagamento:', err);
      showAdminToast('Erro ao confirmar pagamento: ' + err.message, 'error');
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  // Automatic confirmation of payment when admin marks paid and downloads PDF
  const handleDownloadPDFAndMarkPaid = async (res: Reservation) => {
    if (generatingPdfResId) return; // Prevent double taps!
    setGeneratingPdfResId(res.id);
    try {
      // 1. If not yet paid, mark as paid first
      if (res.status === 'aguardando_pagamento') {
        const now = Date.now();
        await updateReservationStatus(res.id, 'pagamento_confirmado', {
          paymentConfirmedAt: now,
          paymentConfirmedBy: 'Sergio de Sousa Bruce (Administrador)',
        });

        const updatedRes: Reservation = {
          ...res,
          status: 'pagamento_confirmado',
          paymentConfirmedAt: now,
          paymentConfirmedBy: 'Sergio de Sousa Bruce (Administrador)',
        };

        if (selectedResForDetail?.id === res.id) {
          setSelectedResForDetail(updatedRes);
        }

        // Generate PDF with updated paid status using robust mobile downloader
        const result = await downloadOrShareReservationPDF(updatedRes, settings);
        setLastGeneratedPdf({
          resId: res.id,
          code: res.code,
          blobUrl: result.blobUrl,
          filename: result.filename,
        });

        if (result.method === 'share') {
          setPdfConfirmedToast(`Pagamento da reserva ${res.code} confirmado! Termo PDF enviado para o compartilhador do celular.`);
        } else {
          setPdfConfirmedToast(`Pagamento da reserva ${res.code} confirmado! PDF com sua assinatura (Sergio de Sousa Bruce) e foto baixado.`);
        }
        setTimeout(() => setPdfConfirmedToast(null), 10000);
      } else {
        const result = await downloadOrShareReservationPDF(res, settings);
        setLastGeneratedPdf({
          resId: res.id,
          code: res.code,
          blobUrl: result.blobUrl,
          filename: result.filename,
        });

        if (result.method === 'share') {
          setPdfConfirmedToast(`Termo oficial da reserva ${res.code} aberto no compartilhador!`);
        } else {
          setPdfConfirmedToast(`PDF oficial da reserva ${res.code} baixado com sucesso!`);
        }
        setTimeout(() => setPdfConfirmedToast(null), 8000);
      }
    } catch (err: any) {
      console.error('Erro ao processar download do PDF e confirmação:', err);
      showAdminToast('Atenção: Não foi possível processar o PDF automaticamente. Verifique se o navegador bloqueou popups ou downloads.', 'error');
    } finally {
      setGeneratingPdfResId(null);
    }
  };

  // Open WhatsApp directly to send PDF/Confirmation to client
  const handleSendPdfToClientWhatsApp = (res: Reservation) => {
    const url = getWhatsAppSendTermToClientUrl(res);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  const handleDeleteReservationConfirm = async () => {
    if (!resToDelete) return;
    setIsDeletingRes(true);
    try {
      await deleteReservation(resToDelete.id);
      setDeleteSuccessToast(`Reserva ${resToDelete.code} excluída permanentemente com sucesso!`);
      if (selectedResForDetail?.id === resToDelete.id) {
        setSelectedResForDetail(null);
      }
      setResToDelete(null);
      setTimeout(() => setDeleteSuccessToast(null), 4000);
    } catch (err: any) {
      console.error(err);
      showAdminToast(err.message || 'Erro ao excluir reserva do sistema.', 'error');
    } finally {
      setIsDeletingRes(false);
    }
  };

  const handleDeleteClientConfirm = async () => {
    if (!clientToDelete) return;
    setIsDeletingClient(true);
    try {
      const clientId = clientToDelete.id || clientToDelete.cpfClean || clientToDelete.cpf;
      await deleteClient(clientId);
      setDeleteClientToast(`Cliente ${clientToDelete.fullName} (CPF: ${clientToDelete.cpf}) excluído permanentemente!`);
      setClientToDelete(null);
      setTimeout(() => setDeleteClientToast(null), 5000);
    } catch (err: any) {
      console.error(err);
      showAdminToast(err.message || 'Erro ao excluir cadastro do cliente.', 'error');
    } finally {
      setIsDeletingClient(false);
    }
  };

  // Bike CRUD
  const openAddBikeModal = () => {
    setEditingBike(null);
    // Calculate the next numeric sequence from existing bikes
    let maxNum = 0;
    bikes.forEach((b) => {
      const match = (b.code || '').match(/\d+/) || (b.name || '').match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextNum = Math.max(bikes.length + 1, maxNum + 1);
    const codeStr = `PED-${String(nextNum).padStart(3, '0')}`;
    const defaultName = `Bike ${String(nextNum).padStart(2, '0')}`;

    setBikeCode(codeStr);
    setBikeName(defaultName);
    setBikeModel('Colli Aro 29');
    setBikeColor('Azul Metálica');
    setBikeDescription('Bicicleta revisada com marcha, suspensão dianteira e freios a disco.');
    setBikePhotoUrl('');
    setBikeStatus('available');
    setBikeNotes('');
    setHasSmartTag(false);
    setSmartTagType('samsung');
    setSmartTagName('');
    setSmartTagSerial('');
    setSmartTagFindUrl('');
    setShowManualUrlInput(false);
    setIsBikeModalOpen(true);
  };

  const openEditBikeModal = (bike: Bike) => {
    setEditingBike(bike);
    setBikeCode(bike.code);
    setBikeName(bike.name);
    setBikeModel(bike.model);
    setBikeColor(bike.color);
    setBikeDescription(bike.description);
    setBikePhotoUrl(bike.photoUrl);
    setBikeStatus(bike.status);
    setBikeNotes(bike.notes || '');
    setHasSmartTag(bike.hasSmartTag || false);
    setSmartTagType(bike.smartTagType || 'samsung');
    setSmartTagName(bike.smartTagName || '');
    setSmartTagSerial(bike.smartTagSerial || '');
    setSmartTagFindUrl(bike.smartTagFindUrl || '');
    setShowManualUrlInput(false);
    setIsBikeModalOpen(true);
  };

  // Direct phone photo upload & compression for the modal
  const handleBikePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingBikePhoto(true);
      // High-resolution yet lightweight JPEG (1200x900, 0.82 quality)
      const compressed = await compressImage(file, 1200, 900, 0.82);
      setBikePhotoUrl(compressed);
      showAdminToast('Foto da bike carregada e pronta para o catálogo!', 'success');
    } catch (err: any) {
      console.error('Erro ao processar foto da bike:', err);
      showAdminToast('Não foi possível carregar a foto selecionada. Tente outra foto.', 'error');
    } finally {
      setIsProcessingBikePhoto(false);
      e.target.value = '';
    }
  };

  // Quick photo update directly from the fleet card without opening the full edit modal
  const triggerQuickBikePhotoChange = (bikeId: string) => {
    setQuickUpdateBikeId(bikeId);
    quickCardPhotoInputRef.current?.click();
  };

  const handleQuickCardPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = quickUpdateBikeId;
    if (!file || !targetId) return;

    try {
      setIsQuickUpdatingPhoto(true);
      const targetBike = bikes.find((b) => b.id === targetId);
      const bikeLabel = targetBike?.name || 'Bike';
      showAdminToast(`Otimizando foto de ${bikeLabel}...`, 'info');

      const compressed = await compressImage(file, 1200, 900, 0.82);
      await updateBike(targetId, { photoUrl: compressed });
      showAdminToast(`Foto de ${bikeLabel} atualizada com sucesso!`, 'success');
    } catch (err: any) {
      console.error('Erro ao atualizar foto da bike:', err);
      showAdminToast('Erro ao salvar nova foto da bike.', 'error');
    } finally {
      setIsQuickUpdatingPhoto(false);
      setQuickUpdateBikeId(null);
      e.target.value = '';
    }
  };

  const handleSaveBike = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bikeName || !bikeCode) {
      showAdminToast('Nome e Código são obrigatórios.', 'error');
      return;
    }

    const finalPhotoUrl = bikePhotoUrl.trim() || 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80';

    try {
      if (editingBike) {
        await updateBike(editingBike.id, {
          code: bikeCode,
          name: bikeName,
          model: bikeModel,
          color: bikeColor,
          description: bikeDescription,
          photoUrl: finalPhotoUrl,
          status: bikeStatus,
          notes: bikeNotes,
          hasSmartTag,
          smartTagType,
          smartTagName,
          smartTagSerial,
          smartTagFindUrl,
        });
        showAdminToast(`Bike ${bikeName} atualizada com sucesso!`, 'success');
      } else {
        await createBike({
          code: bikeCode,
          name: bikeName,
          model: bikeModel,
          color: bikeColor,
          description: bikeDescription,
          photoUrl: finalPhotoUrl,
          status: bikeStatus,
          notes: bikeNotes,
          hasSmartTag,
          smartTagType,
          smartTagName,
          smartTagSerial,
          smartTagFindUrl,
          createdAt: Date.now(),
        });
        showAdminToast(`Nova bike ${bikeName} cadastrada na frota! Já visível para os clientes.`, 'success');
      }
      setIsBikeModalOpen(false);
    } catch (err: any) {
      showAdminToast('Erro ao salvar bike: ' + err.message, 'error');
    }
  };

  const handleDeleteBike = (bike: Bike) => {
    setBikeToDelete(bike);
  };

  const handleConfirmDeleteBike = async () => {
    if (!bikeToDelete) return;
    setIsDeletingBike(true);
    try {
      await deleteBike(bikeToDelete.id);
      showAdminToast(`Bike ${bikeToDelete.name} excluída com sucesso!`, 'success');
      setBikeToDelete(null);
    } catch (err: any) {
      showAdminToast('Erro ao excluir bike: ' + err.message, 'error');
    } finally {
      setIsDeletingBike(false);
    }
  };

  // Save System Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const cleanPhone = editWhatsappDisplay.replace(/\D/g, '');
      const waUrl = cleanPhone.length >= 10 ? `https://wa.me/55${cleanPhone}` : `https://wa.me/${cleanPhone}`;
      await updateSettings({
        companyName: editCompanyName,
        slogan: editSlogan,
        address: editAddress,
        whatsappDisplay: editWhatsappDisplay,
        whatsappOfficialUrl: waUrl,
        pixKey: editPixKey,
        openingTime: editOpeningTime,
        closingTime: editClosingTime,
        termText: editTermText,
        plans: editPlans,
        adminEmail: editAdminEmail.trim() || 'sergiobruce19@gmail.com',
        instagramUrl: editInstagramUrl.trim(),
        facebookUrl: editFacebookUrl.trim(),
        tiktokUrl: editTiktokUrl.trim(),
      });
      showAdminToast('Configurações atualizadas com sucesso no Firebase!', 'success');
    } catch (err: any) {
      showAdminToast('Erro ao salvar configurações: ' + err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Quick QR Scan Search
  const handleQuickQrSearch = () => {
    if (!qrScanInput) return;
    const clean = qrScanInput.trim().toUpperCase();
    const found = reservations.find((r) => r.code.toUpperCase() === clean);
    if (found) {
      setSelectedResForDetail(found);
    } else {
      showAdminToast(`Nenhuma reserva encontrada com o código ${clean}`, 'error');
    }
    setQrScanInput('');
  };

  // ---------------- LOGIN SCREEN (PROTECTED AUTHENTICATION) ----------------
  if (!isAuthenticated) {
    const isLocked = lockoutUntil !== null && Date.now() < lockoutUntil;
    const targetAdminEmail = settings.adminEmail || 'sergiobruce19@gmail.com';

    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-900 transition-colors"
            title="Fechar e voltar ao site público"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3">
              <img src="/logo.png" alt="PEDALAÊ" className="w-20 h-20 rounded-full border-2 border-amber-500 shadow-lg shadow-amber-500/20 object-cover" />
              <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black p-1.5 rounded-full shadow">
                <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-extrabold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3 h-3" />
              Área Administrativa Restrita
            </div>

            <h2 className="text-xl font-black text-white tracking-tight">Painel de Controle</h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
              Acesso exclusivo para o proprietário: <span className="text-amber-400 font-semibold">{targetAdminEmail}</span>
            </p>
          </div>

          {/* Lockout Warning */}
          {isLocked && (
            <div className="mb-4 p-4 rounded-2xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs flex items-start gap-3 animate-pulse">
              <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-300">Acesso temporariamente suspenso</p>
                <p className="mt-0.5 text-zinc-300">
                  Por medidas de segurança contra invasão, aguarde <strong>{lockoutRemainingSeconds}s</strong> para tentar novamente.
                </p>
              </div>
            </div>
          )}

          {/* Primary Option: Google Authentication */}
          <div className="space-y-4">
            <button
              id="btn-admin-google-login"
              type="button"
              disabled={isLocked || isGoogleLoading}
              onClick={handleGoogleAdminLogin}
              className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.99]"
            >
              {isGoogleLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-700" />
                  <span>Verificando Conta Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Entrar com Google do Administrador</span>
                </>
              )}
            </button>

            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-zinc-800 w-full" />
              <span className="bg-zinc-950 px-3 text-[10px] uppercase font-bold text-zinc-500 tracking-wider flex-shrink-0">
                Ou acesse com sua Senha
              </span>
              <div className="border-t border-zinc-800 w-full" />
            </div>

            {/* Password Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Senha de Administrador</span>
                  <span className="text-[10px] text-zinc-500 font-normal">Apenas proprietário</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="input-admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={isLocked}
                    placeholder="Digite sua senha de acesso"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-10 py-3 text-white text-sm focus:outline-none focus:border-amber-400 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                id="btn-admin-submit-login"
                type="submit"
                disabled={isLocked}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Entrar no Painel</span>
              </button>
            </form>
          </div>

          {/* Security Information Footer */}
          <div className="mt-6 pt-5 border-t border-zinc-900/80 text-center space-y-2">
            <p className="text-[11px] text-zinc-500 leading-relaxed flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Proteção com criptografia e controle de acesso restrito</span>
            </p>
            <div>
              <button
                onClick={onClose}
                className="text-xs text-zinc-500 hover:text-amber-400 transition-colors inline-flex items-center gap-1 font-medium"
              >
                ← Voltar para o Site Público
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- AUTHENTICATED ADMIN DASHBOARD ----------------
  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-zinc-950 border-r border-zinc-900 flex flex-col justify-between flex-shrink-0">
        <div>
          {/* Brand header */}
          <div className="p-4 sm:p-5 border-b border-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="PEDALAÊ" className="w-10 h-10 rounded-full border border-amber-500" />
              <div>
                <h3 className="font-black text-white text-base">PEDALAÊ</h3>
                <span className="text-[10px] text-amber-400 block font-semibold">ADMINISTRAÇÃO</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="md:hidden text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick QR Search in Sidebar */}
          <div className="p-3 border-b border-zinc-900">
            <div className="flex items-center gap-1.5 bg-zinc-900 rounded-xl px-2.5 py-1.5 border border-zinc-800">
              <QrCode className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Buscar cód. PED-000001"
                value={qrScanInput}
                onChange={(e) => setQrScanInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickQrSearch()}
                className="bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none w-full"
              />
              <button
                onClick={handleQuickQrSearch}
                className="text-[10px] bg-amber-500 text-black font-bold px-2 py-1 rounded-md"
              >
                Ir
              </button>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="p-3 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'historico_locacoes', label: '📋 Histórico de Locações', icon: HistoryIcon },
              { id: 'reservas', label: 'Reservas', icon: Clock },
              { id: 'calendario', label: 'Calendário', icon: CalendarIcon },
              { id: 'bikes', label: 'Bikes', icon: BikeIcon },
              { id: 'clientes', label: 'Clientes', icon: Users },
              { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
              { id: 'documentos', label: 'Documentos', icon: FileText },
              { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
              { id: 'configuracoes', label: 'Configurações', icon: SettingsIcon },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`btn-nav-tab-${item.id}`}
                  onClick={() => handleSetActiveTab(item.id as AdminTab)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions & Identity */}
        <div className="p-3 border-t border-zinc-900 space-y-2">
          {/* Authenticated Admin Account Pill */}
          <div className="px-3 py-2 bg-zinc-900/60 rounded-xl border border-zinc-800/80">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Admin Conectado</span>
            </div>
            <p className="text-[11px] text-zinc-200 font-medium truncate mt-0.5">
              {loggedAdminUser?.email || settings.adminEmail || 'sergiobruce19@gmail.com'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Ver Site Público</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-semibold cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair da Sessão</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-black">
        {/* Permanent Storage Vault Status Bar */}
        <div className="mb-6 p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-zinc-200">
              🛡️ Armazenamento Permanente (Cofre IndexedDB):
            </span>
            <span className="text-xs text-amber-400 font-black">
              {reservations.length} Reservas
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-xs text-amber-400 font-black">
              {clients.length} Clientes Salvos
            </span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
              100% Protegido
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportBackup}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 hover:text-amber-300 font-bold text-xs border border-zinc-700 cursor-pointer transition-all"
              title="Baixar arquivo de segurança com todas as reservas e clientes para o seu celular ou computador"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Backup (.JSON)</span>
            </button>
          </div>
        </div>

        {/* Quota Notice if Cloud Daily Quota is triggered */}
        {getCloudQuotaStatus().isExceeded && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-950/60 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-amber-400 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-amber-300 text-sm">
                  Cofre Local Ativo: Todas as informações e clientes estão salvos e seguros!
                </h4>
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  A cota de leituras gratuitas da nuvem renova diariamente à meia-noite. O PEDALAÊ está salvando e lendo tudo com segurança no <strong>Cofre IndexedDB</strong> permanente do seu dispositivo — nenhum dado, cadastro ou reserva sumiu ou será perdido!
                </p>
              </div>
            </div>
            <a
              href={getCloudQuotaStatus().upgradeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs whitespace-nowrap cursor-pointer transition-all shadow"
            >
              <span>Gerenciar Cota no Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
        {/* Security Advisory Banner if default password is in use */}
        {(!settings.adminPasswordHash || settings.adminPasswordHash === 'admin123') && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-amber-950/20">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-amber-400 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-amber-300 text-sm">
                  Ação de Segurança Recomendada: Cadastre sua Senha Mestre Pessoal
                </h4>
                <p className="text-xs text-amber-200/80">
                  O painel está utilizando a senha inicial temporária. Para garantir que <strong>apenas você</strong> acesse os contratos, fotos de documentos e dados financeiros, cadastre uma senha exclusiva agora.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveTab('configuracoes');
                setTimeout(() => {
                  const el = document.getElementById('section-admin-security');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl whitespace-nowrap cursor-pointer transition-all shadow-md shadow-amber-500/20"
            >
              Criar Minha Senha Agora
            </button>
          </div>
        )}

        {/* Overdue Alert Banner if any */}
        {overdueReservations.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-950/70 border-2 border-rose-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-rose-950/40">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0" />
              <div>
                <h4 className="font-black text-rose-300 text-sm">
                  ⚠️ ALERTA: {overdueReservations.length} {overdueReservations.length === 1 ? 'BIKE EM ATRASO' : 'BIKES EM ATRASO'}!
                </h4>
                <p className="text-xs text-rose-200/80">
                  O horário previsto de devolução foi ultrapassado. Verifique os dados com o cliente.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {overdueReservations.map((ov) => (
                <button
                  key={ov.id}
                  onClick={() => setSelectedResForDetail(ov)}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg"
                >
                  Ver {ov.code}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ================= 1. TAB: DASHBOARD ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-white">RESERVAS DE HOJE</h2>
                <p className="text-xs text-zinc-400">
                  Visão operacional em tempo real de Parintins/AM ({todayStr.split('-').reverse().join('/')})
                </p>
              </div>
              <button
                onClick={() => handleSetActiveTab('reservas')}
                className="bg-zinc-900 border border-zinc-800 hover:border-amber-500 text-xs font-bold text-zinc-300 px-3.5 py-2 rounded-xl self-start sm:self-auto"
              >
                Gerenciar Todas as Reservas →
              </button>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
                  <span>Bikes Disponíveis</span>
                  <BikeIcon className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white mt-2">
                  🚲 {availableBikesCount}
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Total de {bikes.length} bikes cadastradas
                </span>
              </div>

              <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
                  <span>Reservas Hoje</span>
                  <CalendarIcon className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white mt-2">
                  📅 {todayReservations.length}
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  {confirmedTodayCount} confirmadas
                </span>
              </div>

              <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
                  <span>Recebido Hoje</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-2">
                  {revenueToday.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Via pagamentos PIX confirmados
                </span>
              </div>

              <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
                  <span>Aguardando Pagamento</span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-2">
                  ⏳ {waitingPaymentCount}
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Requer conferência de comprovante
                </span>
              </div>
            </div>

            {/* Active Schedule & Permanent Historical View */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              {/* Permanent Storage & Autonomy Assurance Banner */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
                <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-amber-300">
                    Armazenamento Permanente e Autonomia Total ({reservations.length} reservas registradas)
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Nenhuma reserva ou informação de cliente é excluída automaticamente pelo sistema. Todos os registros ficam salvos permanentemente e somente você, como administrador, tem o poder de excluir manualmente quando desejar.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                  <h3 className="font-bold text-white text-base">
                    {dashboardViewMode === 'today' ? 'Atendimentos de Hoje' : 'Todas as Reservas Registradas'}
                  </h3>
                  <span className="text-xs text-zinc-400">
                    {dashboardViewMode === 'today'
                      ? `${todayReservations.length} agendamentos para a data de hoje`
                      : `${reservations.length} reservas salvas permanentemente no histórico`}
                  </span>
                </div>

                {/* View Mode Toggle: Today vs All */}
                <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setDashboardViewMode('today')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      dashboardViewMode === 'today'
                        ? 'bg-amber-500 text-black shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Hoje ({todayReservations.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashboardViewMode('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      dashboardViewMode === 'all'
                        ? 'bg-amber-500 text-black shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Ver Todas ({reservations.length})
                  </button>
                </div>
              </div>

              {(dashboardViewMode === 'today' ? todayReservations : reservations).length === 0 ? (
                <div className="py-10 text-center text-zinc-500 text-sm">
                  {dashboardViewMode === 'today'
                    ? 'Nenhuma reserva agendada para hoje ainda. Clique em "Ver Todas" acima para conferir o histórico completo.'
                    : 'Nenhuma reserva registrada no sistema.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {(dashboardViewMode === 'today' ? todayReservations : reservations).map((res) => {
                    const overdue = isOverdue(res);
                    return (
                      <div
                        key={res.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          overdue 
                            ? 'bg-rose-950/20 border-rose-500/50 shadow-md shadow-rose-950/30' 
                            : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
                        } flex flex-col md:flex-row md:items-center justify-between gap-4`}
                      >
                        <div className="flex items-start sm:items-center gap-3.5">
                          {res.customerSnapshot.photoBase64 ? (
                            <img
                              src={res.customerSnapshot.photoBase64}
                              alt={res.customerSnapshot.fullName}
                              className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-500 shadow-sm flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-black text-amber-400 flex-shrink-0">
                              {res.customerSnapshot.fullName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                {res.code}
                              </span>
                              <span className="text-sm font-extrabold text-white">
                                {res.customerSnapshot.fullName}
                              </span>
                              {getStatusBadge(res.status)}
                            </div>
                            <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <span className="text-zinc-300 font-medium">🚲 {res.bikeSnapshot.name} ({res.bikeSnapshot.code})</span>
                              <span className="text-zinc-600">•</span>
                              <span className="text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 font-mono">
                                ⏱ {res.startTime} às {res.endTime}
                              </span>
                              <span className="text-zinc-600">•</span>
                              <span className="text-emerald-400 font-bold">
                                {res.totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-800/80">
                          {res.status === 'aguardando_pagamento' && (
                            <button
                              onClick={() => handleConfirmPayment(res)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Confirmar PIX</span>
                            </button>
                          )}

                          {res.status === 'pagamento_confirmado' && (
                            <button
                              onClick={() => openCheckin(res)}
                              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/20 active:scale-95 transition-all"
                            >
                              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>Fazer Retirada</span>
                            </button>
                          )}

                          {(res.status === 'bike_em_uso' || res.status === 'bike_retirada') && (
                            <button
                              onClick={() => openCheckout(res)}
                              className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-black px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-600/20 active:scale-95 transition-all"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Registrar Devolução</span>
                            </button>
                          )}

                          <button
                            disabled={generatingPdfResId === res.id}
                            onClick={() => handleDownloadPDFAndMarkPaid(res)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-bold px-3 py-2 rounded-xl border border-zinc-700 flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                            title="Baixar Contrato PDF Assinado por Sergio de Sousa Bruce"
                          >
                            {generatingPdfResId === res.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-amber-400" />
                            )}
                            <span>{generatingPdfResId === res.id ? 'Gerando...' : 'PDF'}</span>
                          </button>

                          <button
                            onClick={() => handleSendPdfToClientWhatsApp(res)}
                            className="bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors"
                            title="Enviar WhatsApp com Confirmação e PDF para o Cliente"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </button>

                          <button
                            onClick={() => setSelectedResForDetail(res)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold px-3 py-2 rounded-xl border border-zinc-700 cursor-pointer transition-colors"
                          >
                            Detalhes
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB: HISTÓRICO DE LOCAÇÕES (ETAPA 6) ================= */}
        {activeTab === 'historico_locacoes' && (
          <RentalHistoryView
            settings={settings}
            bikes={bikes}
            reservations={reservations}
            clients={clients}
          />
        )}

        {/* ================= 2. TAB: RESERVAS ================= */}
        {activeTab === 'reservas' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-white">GERENCIAMENTO DE RESERVAS</h2>
                <p className="text-xs text-zinc-400">
                  Todas as reservas registradas no sistema ({reservations.length} reservas salvas permanentemente)
                </p>
              </div>
            </div>

            {/* Permanent Storage & Autonomy Banner */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
              <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-amber-300">
                  Arquivo Permanente e Autonomia Total ({reservations.length} reservas registradas)
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  As informações dos clientes e suas reservas nunca somem sozinhas. Você possui autonomia total para manter os dados pelo tempo que desejar ou excluir manualmente cada registro quando quiser.
                </p>
              </div>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar cliente, CPF, cód. ou bike..."
                  value={reservationSearch}
                  onChange={(e) => setReservationSearch(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="all">Todos os Status</option>
                  <option value="aguardando_pagamento">Aguardando Pagamento</option>
                  <option value="pagamento_confirmado">Pagamento Confirmado</option>
                  <option value="bike_em_uso">Bike em Uso</option>
                  <option value="devolvida_finalizada">Devolvida / Finalizada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>

              <div>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Feedback Toasts */}
            {deleteSuccessToast && (
              <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between">
                <span>✓ {deleteSuccessToast}</span>
                <button onClick={() => setDeleteSuccessToast(null)} className="text-emerald-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {pdfConfirmedToast && (
              <div className="bg-amber-500/15 border-2 border-amber-500/50 text-amber-300 p-4 rounded-xl text-xs font-bold space-y-2.5 shadow-lg shadow-amber-500/10 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 stroke-[3] flex-shrink-0" />
                    <span>{pdfConfirmedToast}</span>
                  </span>
                  <button onClick={() => setPdfConfirmedToast(null)} className="text-amber-400 hover:text-white ml-2 flex-shrink-0 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {lastGeneratedPdf && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/30">
                    <a
                      href={lastGeneratedPdf.blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-amber-400/60 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      <span>Abrir / Ver PDF no Celular</span>
                    </a>
                    <span className="text-[10px] text-zinc-400">
                      (Dica: toque para abrir em nova aba e salvar nos seus arquivos)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Reservations Mobile Cards (Visible on Phones) */}
            <div className="md:hidden space-y-3">
              {filteredReservations.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-zinc-500 text-xs">
                  Nenhuma reserva encontrada com os filtros selecionados.
                </div>
              ) : (
                filteredReservations.map((res) => (
                  <div 
                    key={`mobile-${res.id}`} 
                    className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono font-black text-amber-400 text-sm">{res.code}</span>
                        <div className="text-[11px] text-zinc-400">
                          {res.date.split('-').reverse().join('/')} • {res.startTime} às {res.endTime}
                        </div>
                      </div>
                      <div>{getStatusBadge(res.status)}</div>
                    </div>

                    <div className="bg-black/50 p-3 rounded-xl border border-zinc-800/80 text-xs space-y-1">
                      <div className="text-white font-bold">{res.customerSnapshot.fullName}</div>
                      <div className="text-[11px] text-zinc-400 flex justify-between">
                        <span>CPF: {res.customerSnapshot.cpf}</span>
                        <span className="text-amber-400 font-bold">
                          {res.totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 pt-0.5 border-t border-zinc-800/60">
                        Bike: <strong className="text-zinc-200">{res.bikeSnapshot.name}</strong> ({res.bikeSnapshot.code})
                      </div>
                      {res.digitalSignatureUrl ? (
                        <div className="text-[10px] text-emerald-400 font-medium pt-1 flex items-center gap-1">
                          ✓ Contrato com Assinatura Online
                        </div>
                      ) : (
                        <div className="text-[10px] text-zinc-500 pt-1">
                          Assinatura digital online pendente
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => setSelectedResForDetail(res)}
                        className="flex-1 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detalhes</span>
                      </button>
                      <button
                        disabled={generatingPdfResId === res.id}
                        onClick={() => handleDownloadPDFAndMarkPaid(res)}
                        className="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Baixar PDF (Identifica como Pago e Pronto para Uso)"
                      >
                        {generatingPdfResId === res.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileText className="w-3.5 h-3.5" />
                        )}
                        <span>{generatingPdfResId === res.id ? 'Gerando...' : 'PDF'}</span>
                      </button>
                      <button
                        onClick={() => setResToDelete(res)}
                        className="py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-semibold flex items-center gap-1"
                        title="Excluir Reserva"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Reservations Desktop Table */}
            <div className="hidden md:block bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-800">
                    <tr>
                      <th className="py-3 px-4">Código / Data</th>
                      <th className="py-3 px-4">Cliente / CPF</th>
                      <th className="py-3 px-4">Bicicleta</th>
                      <th className="py-3 px-4">Horário</th>
                      <th className="py-3 px-4">Valor</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredReservations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-zinc-500">
                          Nenhuma reserva encontrada com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredReservations.map((res) => (
                        <tr key={res.id} className="hover:bg-zinc-850/50">
                          <td className="py-3 px-4 font-mono">
                            <span className="font-bold text-amber-400">{res.code}</span>
                            <div className="text-[11px] text-zinc-400">
                              {res.date.split('-').reverse().join('/')}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-white block">
                              {res.customerSnapshot.fullName}
                            </span>
                            <span className="text-[11px] text-zinc-400">{res.customerSnapshot.cpf}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-white">{res.bikeSnapshot.name}</span>
                            <div className="text-[10px] text-zinc-500">{res.bikeSnapshot.code}</div>
                          </td>
                          <td className="py-3 px-4 text-zinc-200">
                            {res.startTime} às {res.endTime}
                            <div className="text-[10px] text-zinc-400">{res.durationHours}h</div>
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            {res.totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className="py-3 px-4">{getStatusBadge(res.status)}</td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setSelectedResForDetail(res)}
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] cursor-pointer"
                            >
                              Ver
                            </button>
                            <button
                              disabled={generatingPdfResId === res.id}
                              onClick={() => handleDownloadPDFAndMarkPaid(res)}
                              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                              title="Baixar Contrato PDF Assinado por Sergio de Sousa Bruce"
                            >
                              {generatingPdfResId === res.id ? (
                                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                              ) : null}
                              <span>{generatingPdfResId === res.id ? 'Gerando...' : 'PDF'}</span>
                            </button>
                            <button
                              onClick={() => handleSendPdfToClientWhatsApp(res)}
                              className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1"
                              title="Enviar Confirmação e PDF para WhatsApp do Cliente"
                            >
                              <Send className="w-3 h-3" />
                              <span>WhatsApp</span>
                            </button>
                            <button
                              onClick={() => setResToDelete(res)}
                              className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-rose-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                              title="Excluir Reserva"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Excluir</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= 3. TAB: CALENDÁRIO ================= */}
        {activeTab === 'calendario' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black text-white">CALENDÁRIO DE RESERVAS</h2>
              <p className="text-xs text-zinc-400">
                Visualização por horário e status das bicicletas
              </p>
            </div>

            {/* Date selection */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-zinc-300">Data:</label>
              <input
                type="date"
                value={dateFilter || todayStr}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={() => setDateFilter(todayStr)}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-xl text-zinc-200"
              >
                Hoje
              </button>
            </div>

            {/* Calendar Grid: Bikes (columns) x Hours (rows) */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 overflow-x-auto">
              <div className="min-w-[650px] space-y-3">
                <div className="grid grid-cols-5 gap-2 border-b border-zinc-800 pb-2 text-xs font-bold text-zinc-400 uppercase">
                  <div className="col-span-1">Horário</div>
                  {bikes.slice(0, 4).map((b) => (
                    <div key={b.id} className="text-center text-white">
                      {b.code} ({b.name})
                    </div>
                  ))}
                </div>

                {/* Rows for each hour 08:00 to 22:00 */}
                {Array.from({ length: 14 }).map((_, idx) => {
                  const hour = 8 + idx;
                  const hourStr = `${String(hour).padStart(2, '0')}:00`;
                  const targetDate = dateFilter || todayStr;

                  return (
                    <div key={hour} className="grid grid-cols-5 gap-2 items-center py-1.5 border-b border-zinc-900 text-xs">
                      <div className="col-span-1 font-mono text-zinc-400">{hourStr}</div>
                      {bikes.slice(0, 4).map((b) => {
                        const matchingRes = reservations.find((r) => {
                          if (r.bikeId !== b.id || r.date !== targetDate || r.status === 'cancelada') return false;
                          const rStart = parseInt(r.startTime.split(':')[0], 10);
                          const rEnd = parseInt(r.endTime.split(':')[0], 10);
                          return hour >= rStart && hour < rEnd;
                        });

                        if (matchingRes) {
                          return (
                            <div
                              key={b.id}
                              onClick={() => setSelectedResForDetail(matchingRes)}
                              className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-[10px] font-bold text-amber-300 text-center cursor-pointer hover:bg-amber-500/30 truncate"
                            >
                              {matchingRes.code} • {matchingRes.customerSnapshot.fullName.split(' ')[0]}
                            </div>
                          );
                        }

                        return (
                          <div
                            key={b.id}
                            className="p-1.5 rounded-lg bg-zinc-950 text-zinc-600 text-[10px] text-center"
                          >
                            Livre
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= 4. TAB: BIKES ================= */}
        {activeTab === 'bikes' && (
          <div className="space-y-6">
            {/* Hidden file input for one-tap photo replacement on any bike card */}
            <input
              ref={quickCardPhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleQuickCardPhotoUpload}
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-white">CADASTRO E GESTÃO DE BIKES</h2>
                <p className="text-xs text-zinc-400">
                  Cadastre novas bikes com fotos tiradas na hora pelo celular ou escolha da galeria
                </p>
              </div>
              <button
                id="btn-add-bike-modal"
                onClick={openAddBikeModal}
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ADICIONAR NOVA BIKE</span>
              </button>
            </div>

            {/* Quick banner tips */}
            <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-zinc-300">
                <span className="text-lg">📸</span>
                <span>
                  <strong className="text-amber-400">Praticidade no Celular:</strong> Você pode tirar uma foto na hora com a câmera do telefone ou atualizar a foto de qualquer bike tocando no botão <strong>"Trocar Foto"</strong> no card.
                </span>
              </div>
              <span className="hidden sm:inline-block font-mono text-[11px] text-zinc-400 font-bold bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800 flex-shrink-0">
                {bikes.length} bikes na frota
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {bikes.map((bike) => (
                <div
                  key={bike.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between group hover:border-amber-500/40 transition-all shadow-md"
                >
                  <div>
                    <div className="relative h-40 rounded-xl overflow-hidden mb-3 bg-zinc-950 border border-zinc-850">
                      <img
                        src={bike.photoUrl}
                        alt={bike.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80';
                        }}
                      />
                      <span className="absolute top-2 left-2 bg-black/85 font-mono text-[10px] font-bold text-amber-400 px-2 py-0.5 rounded shadow">
                        {bike.code}
                      </span>
                      <span
                        className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded shadow ${
                          bike.status === 'available'
                            ? 'bg-emerald-500/90 text-black'
                            : 'bg-rose-500/90 text-white'
                        }`}
                      >
                        {bike.status === 'available' ? 'Ativa' : 'Inativa'}
                      </span>

                      {/* One-tap Quick photo update button directly on bike image */}
                      <button
                        type="button"
                        onClick={() => triggerQuickBikePhotoChange(bike.id)}
                        disabled={isQuickUpdatingPhoto && quickUpdateBikeId === bike.id}
                        title="Tirar foto do celular ou escolher da galeria"
                        className="absolute bottom-2 right-2 bg-black/85 hover:bg-amber-500 hover:text-black text-amber-400 text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-md border border-amber-500/50 flex items-center gap-1 shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        {isQuickUpdatingPhoto && quickUpdateBikeId === bike.id ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-3 h-3" />
                            <span>Trocar Foto</span>
                          </>
                        )}
                      </button>
                    </div>

                    <h4 className="font-bold text-white text-sm">{bike.name}</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {bike.model} • <span className="text-amber-400 font-semibold">{bike.color}</span>
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-2 line-clamp-2">
                      {bike.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-800">
                    <button
                      onClick={() => openEditBikeModal(bike)}
                      className="flex-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Edit2 className="w-3 h-3 text-amber-400" />
                      <span>Editar Dados</span>
                    </button>
                    <button
                      onClick={() => handleDeleteBike(bike)}
                      className="py-1.5 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold cursor-pointer transition-colors"
                      title="Excluir bike da frota"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= 5. TAB: CLIENTES ================= */}
        {activeTab === 'clientes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-white">CADASTRO PERMANENTE DE CLIENTES ({clients.length})</h2>
                <p className="text-xs text-zinc-400">
                  Histórico completo, login rápido e proteção permanente no cofre local e nuvem
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportBackup}
                  type="button"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-bold text-xs border border-zinc-700 cursor-pointer transition-all shadow-sm"
                  title="Baixar lista completa de clientes e contatos"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Backup de Clientes (.JSON)</span>
                </button>
              </div>
            </div>

            {/* Permanent Storage & Autonomy Assurance Banner */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
              <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-amber-300">
                  Armazenamento Permanente e Autonomia Total ({clients.length} clientes salvos)
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Os cadastros dos seus clientes nunca são apagados automaticamente. Eles ficam salvos permanentemente no banco de dados e apenas você, como administrador, tem autonomia para excluir um cadastro manualmente clicando no botão "Excluir".
                </p>
              </div>
            </div>

            {/* Client Search and Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative max-w-md w-full">
                <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar cliente por nome, CPF ou WhatsApp..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {deleteClientToast && (
                <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{deleteClientToast}</span>
                </div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-800">
                    <tr>
                      <th className="py-3 px-4">Foto / Nome</th>
                      <th className="py-3 px-4">CPF</th>
                      <th className="py-3 px-4">WhatsApp</th>
                      <th className="py-3 px-4">Endereço</th>
                      <th className="py-3 px-4 text-center">Locações</th>
                      <th className="py-3 px-4">Última Reserva</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {clients.filter(c => {
                      if (!clientSearchQuery.trim()) return true;
                      const q = clientSearchQuery.toLowerCase();
                      return (
                        c.fullName.toLowerCase().includes(q) ||
                        c.cpf.includes(q) ||
                        c.whatsapp.includes(q)
                      );
                    }).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-zinc-500">
                          {clientSearchQuery.trim()
                            ? 'Nenhum cliente encontrado com este filtro de busca.'
                            : 'Nenhum cliente cadastrado ainda.'}
                        </td>
                      </tr>
                    ) : (
                      clients
                        .filter(c => {
                          if (!clientSearchQuery.trim()) return true;
                          const q = clientSearchQuery.toLowerCase();
                          return (
                            c.fullName.toLowerCase().includes(q) ||
                            c.cpf.includes(q) ||
                            c.whatsapp.includes(q)
                          );
                        })
                        .map((c) => (
                          <tr key={c.id || c.cpf} className="hover:bg-zinc-850/50">
                            <td className="py-3 px-4 flex items-center gap-3">
                              {c.photoBase64 || c.photoUrl ? (
                                <img
                                  src={c.photoBase64 || c.photoUrl}
                                  alt={c.fullName}
                                  className="w-9 h-9 rounded-full object-cover border border-amber-500 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-400">
                                  {c.fullName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span className="font-bold text-white">{c.fullName}</span>
                            </td>
                            <td className="py-3 px-4 text-zinc-300 font-mono">{c.cpf}</td>
                            <td className="py-3 px-4 text-emerald-400">{c.whatsapp}</td>
                            <td className="py-3 px-4 text-zinc-400 max-w-xs truncate">{c.fullAddress}</td>
                            <td className="py-3 px-4 text-center font-bold text-amber-400">
                              {c.totalReservations || 1}
                            </td>
                            <td className="py-3 px-4 text-zinc-400">
                              {c.lastReservationAt
                                ? new Date(c.lastReservationAt).toLocaleDateString('pt-BR')
                                : 'Hoje'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setClientToDelete(c)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                title="Excluir cadastro deste cliente"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Excluir</span>
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= 6. TAB: FINANCEIRO ================= */}
        {activeTab === 'financeiro' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black text-white">RELATÓRIO FINANCEIRO</h2>
              <p className="text-xs text-zinc-400">
                Controle de receitas, ticket médio e locações por bicicleta
              </p>
            </div>

            {/* Financial metric overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <span className="text-xs text-zinc-400 font-semibold uppercase">Total Recebido Hoje</span>
                <div className="text-3xl font-black text-emerald-400 mt-1">
                  {revenueToday.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  {todayReservations.filter((r) => r.paymentConfirmedAt).length} locações pagas
                </span>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <span className="text-xs text-zinc-400 font-semibold uppercase">Total Geral de Receita</span>
                <div className="text-3xl font-black text-white mt-1">
                  {reservations
                    .filter((r) => r.paymentConfirmedAt)
                    .reduce((a, b) => a + b.totalPrice, 0)
                    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Acumulado histórico
                </span>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <span className="text-xs text-zinc-400 font-semibold uppercase">Ticket Médio</span>
                <div className="text-3xl font-black text-amber-400 mt-1">
                  {(
                    reservations.filter((r) => r.paymentConfirmedAt).length > 0
                      ? reservations
                          .filter((r) => r.paymentConfirmedAt)
                          .reduce((a, b) => a + b.totalPrice, 0) /
                        reservations.filter((r) => r.paymentConfirmedAt).length
                      : 15.00
                  ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Por reserva finalizada
                </span>
              </div>
            </div>

            {/* Bikes revenue rank */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="font-bold text-white text-base mb-4">Bikes Mais Alugadas</h3>
              <div className="space-y-3">
                {bikes.map((b) => {
                  const bikeReservations = reservations.filter((r) => r.bikeId === b.id && r.status !== 'cancelada');
                  const bikeRevenue = bikeReservations
                    .filter((r) => r.paymentConfirmedAt)
                    .reduce((acc, curr) => acc + curr.totalPrice, 0);

                  return (
                    <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-850">
                      <div className="flex items-center gap-3">
                        <img src={b.photoUrl} alt={b.name} className="w-10 h-10 rounded-lg object-cover" />
                        <div>
                          <span className="font-mono text-xs text-amber-400 font-bold">{b.code}</span>
                          <h4 className="font-bold text-white text-sm">{b.name}</h4>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-400">
                          {bikeRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        <div className="text-[11px] text-zinc-400">{bikeReservations.length} reservas</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= 7. TAB: DOCUMENTOS ================= */}
        {activeTab === 'documentos' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black text-white">TERMOS E FICHAS DE LOCAÇÃO</h2>
              <p className="text-xs text-zinc-400">
                Gere e imprima os termos oficiais de responsabilidade com QR Code e dados completos
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reservations.map((r) => (
                <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs font-bold text-amber-400">{r.code}</span>
                      <h4 className="font-bold text-white text-sm">{r.customerSnapshot.fullName}</h4>
                    </div>
                    {getStatusBadge(r.status)}
                  </div>

                  <div className="text-xs text-zinc-400 space-y-1">
                    <div>Data: {r.date.split('-').reverse().join('/')}</div>
                    <div>Horário: {r.startTime} às {r.endTime}</div>
                    <div>Bike: {r.bikeSnapshot.name}</div>
                  </div>

                  <button
                    disabled={generatingPdfResId === r.id}
                    onClick={async () => {
                      if (generatingPdfResId) return;
                      setGeneratingPdfResId(r.id);
                      try {
                        const result = await downloadOrShareReservationPDF(r, settings);
                        setLastGeneratedPdf({
                          resId: r.id,
                          code: r.code,
                          blobUrl: result.blobUrl,
                          filename: result.filename,
                        });
                        setPdfConfirmedToast(`PDF oficial da reserva ${r.code} gerado com sucesso!`);
                        setTimeout(() => setPdfConfirmedToast(null), 8000);
                      } catch (err) {
                        console.error('Erro ao gerar PDF:', err);
                      } finally {
                        setGeneratingPdfResId(null);
                      }
                    }}
                    className={`w-full py-2.5 rounded-xl text-black font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      generatingPdfResId === r.id
                        ? 'bg-amber-400/70 cursor-not-allowed opacity-80'
                        : 'bg-amber-500 hover:bg-amber-400 active:scale-95'
                    }`}
                  >
                    {generatingPdfResId === r.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>GERANDO PDF (AGUARDE)...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>BAIXAR / IMPRIMIR PDF OFICIAL</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= 8. TAB: RELATÓRIOS ================= */}
        {activeTab === 'relatorios' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black text-white">CENTRAL DE RELATÓRIOS</h2>
              <p className="text-xs text-zinc-400">
                Exportação de dados operacionais e métricas de desempenho
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-white text-base">Relatório de Reservas</h3>
                <p className="text-xs text-zinc-400">
                  Exportar lista completa de reservas com dados de horário, clientes e status.
                </p>
                <button
                  onClick={() => {
                    const csvContent =
                      'data:text/csv;charset=utf-8,' +
                      'Codigo,Cliente,CPF,Bike,Data,Inicio,Fim,Valor,Status\n' +
                      reservations
                        .map(
                          (r) =>
                            `"${r.code}","${r.customerSnapshot.fullName}","${r.customerSnapshot.cpf}","${r.bikeSnapshot.name}","${r.date}","${r.startTime}","${r.endTime}","${r.totalPrice}","${r.status}"`
                        )
                        .join('\n');
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement('a');
                    link.setAttribute('href', encodedUri);
                    link.setAttribute('download', `pedalae_reservas_${todayStr}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Exportar Reservas (CSV)</span>
                </button>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-white text-base">Relatório de Clientes</h3>
                <p className="text-xs text-zinc-400">
                  Exportar base de clientes cadastrados, telefones e frequência de locações.
                </p>
                <button
                  onClick={() => {
                    const csvContent =
                      'data:text/csv;charset=utf-8,' +
                      'Nome,CPF,WhatsApp,Email,Endereco,TotalReservas\n' +
                      clients
                        .map(
                          (c) =>
                            `"${c.fullName}","${c.cpf}","${c.whatsapp}","${c.email}","${c.fullAddress}","${c.totalReservations || 1}"`
                        )
                        .join('\n');
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement('a');
                    link.setAttribute('href', encodedUri);
                    link.setAttribute('download', `pedalae_clientes_${todayStr}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Exportar Clientes (CSV)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 9. TAB: CONFIGURAÇÕES ================= */}
        {activeTab === 'configuracoes' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black text-white">CONFIGURAÇÕES DO SISTEMA</h2>
              <p className="text-xs text-zinc-400">
                Altere preços, horários de funcionamento, chave PIX e dados da empresa
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* General business info */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider text-amber-400">
                  Dados da Empresa & Contato
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                      Nome da Empresa
                    </label>
                    <input
                      type="text"
                      value={editCompanyName}
                      onChange={(e) => setEditCompanyName(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                      Slogan Oficial
                    </label>
                    <input
                      type="text"
                      value={editSlogan}
                      onChange={(e) => setEditSlogan(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                      WhatsApp para Exibição
                    </label>
                    <input
                      type="text"
                      value={editWhatsappDisplay}
                      onChange={(e) => setEditWhatsappDisplay(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                      Chave PIX Oficial
                    </label>
                    <input
                      type="text"
                      value={editPixKey}
                      onChange={(e) => setEditPixKey(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                    Endereço Completo em Parintins
                  </label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Redes Sociais Oficiais */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <span>📱 Redes Sociais Oficiais (Pedalaê)</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Links das redes sociais para os clientes acessarem, seguirem e marcarem fotos de seus passeios.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                      Instagram (Link Completo)
                    </label>
                    <input
                      type="text"
                      value={editInstagramUrl}
                      onChange={(e) => setEditInstagramUrl(e.target.value)}
                      placeholder="https://www.instagram.com/pedalae.parintins..."
                      className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                      Facebook (Link Completo)
                    </label>
                    <input
                      type="text"
                      value={editFacebookUrl}
                      onChange={(e) => setEditFacebookUrl(e.target.value)}
                      placeholder="https://www.facebook.com/profile.php?id=61595687457272"
                      className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                      TikTok (Link Completo)
                    </label>
                    <input
                      type="text"
                      value={editTiktokUrl}
                      onChange={(e) => setEditTiktokUrl(e.target.value)}
                      placeholder="https://www.tiktok.com/@pedalae.parintins"
                      className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Operating Hours */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider text-amber-400">
                  Horário de Funcionamento
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                      Hora de Abertura
                    </label>
                    <input
                      type="time"
                      value={editOpeningTime}
                      onChange={(e) => setEditOpeningTime(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                      Hora de Fechamento
                    </label>
                    <input
                      type="time"
                      value={editClosingTime}
                      onChange={(e) => setEditClosingTime(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Rental Plans (Prices) */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider text-amber-400">
                  Tabela de Preços dos Planos
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {editPlans.map((p, idx) => (
                    <div key={p.id} className="bg-black border border-zinc-800 rounded-xl p-3">
                      <span className="text-xs font-bold text-white block mb-1">{p.label}</span>
                      <label className="text-[10px] text-zinc-400">Valor (R$):</label>
                      <input
                        type="number"
                        step="0.50"
                        value={p.price}
                        onChange={(e) => {
                          const updated = [...editPlans];
                          updated[idx] = { ...updated[idx], price: parseFloat(e.target.value) || 0 };
                          setEditPlans(updated);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white mt-1"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Term Text */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider text-amber-400">
                  Termo de Compromisso e Responsabilidade
                </h3>
                <textarea
                  rows={6}
                  value={editTermText}
                  onChange={(e) => setEditTermText(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-xs text-white leading-relaxed font-mono"
                />
              </div>

              {/* Security & Access Management Card */}
              <div id="section-admin-security" className="bg-zinc-900 border border-amber-500/40 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                      Segurança e Controle de Acesso Restrito
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Garantia de que <strong>somente você</strong> pode acessar o painel administrativo, gerenciar contratos e visualizar os dados dos clientes e financeiro.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                      E-mail do Administrador Titular
                    </label>
                    <input
                      type="email"
                      value={editAdminEmail}
                      onChange={(e) => setEditAdminEmail(e.target.value)}
                      placeholder="sergiobruce19@gmail.com"
                      className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Apenas login com este e-mail do Google oficial é aceito pelo sistema.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                      Status da Senha de Administrador
                    </label>
                    <div className="bg-black/60 border border-zinc-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs">
                        {(!settings.adminPasswordHash || settings.adminPasswordHash === 'admin123') ? (
                          <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" /> Senha temporária ativa
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" /> Senha pessoal exclusiva ativa
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Você pode redefinir sua senha secreta a qualquer momento no formulário abaixo.
                    </p>
                  </div>
                </div>

                {/* Sub-form for changing master password */}
                <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>Cadastrar ou Redefinir Minha Senha Mestre</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                        Nova Senha Mestre
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newAdminPassword}
                          onChange={(e) => setNewAdminPassword(e.target.value)}
                          placeholder="Digite a nova senha secreta"
                          className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300"
                        >
                          {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                        Confirmar Nova Senha
                      </label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={confirmAdminPassword}
                        onChange={(e) => setConfirmAdminPassword(e.target.value)}
                        placeholder="Repita a mesma senha"
                        className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {passwordChangeError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                      {passwordChangeError}
                    </div>
                  )}

                  {passwordChangeSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{passwordChangeSuccess}</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={isSavingPassword || !newAdminPassword}
                      onClick={handleSaveNewPassword}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                      {isSavingPassword ? 'Salvando Senha...' : 'Salvar Minha Nova Senha'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Backup & Data Permanence Section */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-white text-sm uppercase tracking-wider text-emerald-400">
                      💾 Backup e Persistência Permanente de Dados
                    </h3>
                  </div>
                  <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    PROTEÇÃO DUPLA ATIVA
                  </span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  Todas as suas <strong>reservas ({reservations.length})</strong>, <strong>clientes ({clients.length})</strong>, frotas de bikes e configurações são gravados de forma redundante no <strong>armazenamento permanente do seu navegador</strong> e sincronizados na <strong>nuvem do Firebase</strong>. Suas informações nunca são perdidas mesmo em quedas de sinal ou reinicializações.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="p-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 hover:border-amber-400 text-left transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-black text-white group-hover:text-amber-400 block uppercase">
                        📥 Baixar Backup Completo (.JSON)
                      </span>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">
                        Salva um arquivo de segurança no seu computador ou celular com todas as reservas e clientes.
                      </span>
                    </div>
                    <Download className="w-5 h-5 text-amber-400 flex-shrink-0 ml-2" />
                  </button>

                  <label className="p-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 hover:border-emerald-400 text-left transition-all flex items-center justify-between group cursor-pointer">
                    <div>
                      <span className="text-xs font-black text-white group-hover:text-emerald-400 block uppercase">
                        📤 Restaurar Backup (.JSON)
                      </span>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">
                        Carrega um arquivo de backup anterior para restaurar todo o histórico de reservas e clientes.
                      </span>
                    </div>
                    <Upload className="w-5 h-5 text-emerald-400 flex-shrink-0 ml-2" />
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackupFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20"
              >
                {savingSettings ? 'Salvando no Firebase...' : 'SALVAR TODAS AS CONFIGURAÇÕES'}
              </button>
            </form>
          </div>
        )}

        {/* ================= MODAL: DETALHES DA RESERVA ================= */}
        {selectedResForDetail && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div>
                  <span className="font-mono text-xs font-bold text-amber-400">
                    {selectedResForDetail.code}
                  </span>
                  <h3 className="font-black text-white text-lg">Detalhes da Reserva</h3>
                </div>
                <button
                  onClick={() => setSelectedResForDetail(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Header */}
              <div className="flex items-center justify-between bg-black p-3.5 rounded-xl border border-zinc-800">
                <span className="text-xs text-zinc-400">Status Atual:</span>
                <div>{getStatusBadge(selectedResForDetail.status)}</div>
              </div>

              {/* Client and Bike Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-black/60 p-4 rounded-xl border border-zinc-800 space-y-2">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                    Dados do Cliente
                  </span>
                  <div className="flex items-center gap-3">
                    {selectedResForDetail.customerSnapshot.photoBase64 && (
                      <img
                        src={selectedResForDetail.customerSnapshot.photoBase64}
                        alt="Cliente"
                        className="w-12 h-12 rounded-full object-cover border border-amber-500"
                      />
                    )}
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        {selectedResForDetail.customerSnapshot.fullName}
                      </h4>
                      <p className="text-xs text-zinc-400">
                        CPF: {selectedResForDetail.customerSnapshot.cpf}
                      </p>
                      <a
                        href={`https://wa.me/55${selectedResForDetail.customerSnapshot.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        WhatsApp: {selectedResForDetail.customerSnapshot.whatsapp} ↗
                      </a>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-400 pt-1">
                    Endereço: {selectedResForDetail.customerSnapshot.fullAddress}
                  </p>
                </div>

                <div className="bg-black/60 p-4 rounded-xl border border-zinc-800 space-y-2">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                    Bicicleta & Horário
                  </span>
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedResForDetail.bikeSnapshot.photoUrl}
                      alt="Bike"
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        {selectedResForDetail.bikeSnapshot.name}
                      </h4>
                      <p className="text-xs text-zinc-400">
                        {selectedResForDetail.bikeSnapshot.model} • {selectedResForDetail.bikeSnapshot.color}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-amber-300 font-bold pt-1">
                    {selectedResForDetail.date.split('-').reverse().join('/')} • {selectedResForDetail.startTime} às {selectedResForDetail.endTime}
                  </div>
                  <div className="text-xs text-zinc-400">
                    Valor: {selectedResForDetail.totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              </div>

              {/* Comprovante de Pagamento Anexado */}
              {selectedResForDetail.paymentProofBase64 && (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <a
                      href={selectedResForDetail.paymentProofBase64}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block cursor-pointer"
                    >
                      <img
                        src={selectedResForDetail.paymentProofBase64}
                        alt="Comprovante PIX"
                        className="w-12 h-12 rounded-lg object-cover border border-emerald-500/50 bg-black"
                      />
                    </a>
                    <div>
                      <span className="text-xs font-bold text-emerald-400 block">
                        Comprovante do PIX Anexado pelo Cliente
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {selectedResForDetail.paymentProofUploadedAt
                          ? `Enviado em ${new Date(selectedResForDetail.paymentProofUploadedAt).toLocaleString('pt-BR')}`
                          : 'Disponível para conferência'}
                      </span>
                    </div>
                  </div>
                  <a
                    href={selectedResForDetail.paymentProofBase64}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap"
                  >
                    Ver Comprovante em Tela Cheia ↗
                  </a>
                </div>
              )}

              {/* Assinatura Digital do Locatário */}
              <div className="bg-black/60 border border-zinc-800 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5" />
                    Assinatura Online do Contrato
                  </span>
                  {selectedResForDetail.digitalSignatureUrl ? (
                    <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Assinado Online
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                      Assinatura Presencial Pendente
                    </span>
                  )}
                </div>

                {selectedResForDetail.digitalSignatureUrl ? (
                  <div className="space-y-2">
                    <div className="bg-white p-3 rounded-xl border border-zinc-700 flex items-center justify-center">
                      <img
                        src={selectedResForDetail.digitalSignatureUrl}
                        alt={`Assinatura de ${selectedResForDetail.customerSnapshot.fullName}`}
                        className="max-h-24 object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
                      <span>Signatário: <strong className="text-zinc-200">{selectedResForDetail.digitalSignerName || selectedResForDetail.customerSnapshot.fullName}</strong></span>
                      <span className="text-amber-400 font-mono text-[10px]">
                        {selectedResForDetail.digitalSignedAt
                          ? new Date(selectedResForDetail.digitalSignedAt).toLocaleString('pt-BR')
                          : new Date(selectedResForDetail.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">
                    O cliente concordou com os termos online. Caso deseje, você pode coletar a assinatura física na retirada ou gerar o contrato PDF completo para impressão e arquivo.
                  </p>
                )}
              </div>

              {/* Action buttons inside detail */}
              <div className="flex flex-col gap-2.5 pt-2 border-t border-zinc-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedResForDetail.status === 'aguardando_pagamento' && (
                    <button
                      onClick={() => handleConfirmPayment(selectedResForDetail)}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Confirmar Pagamento PIX</span>
                    </button>
                  )}

                  {selectedResForDetail.status === 'pagamento_confirmado' && (
                    <button
                      onClick={() => openCheckin(selectedResForDetail)}
                      className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>Iniciar Check-in / Retirada</span>
                    </button>
                  )}

                  {selectedResForDetail.status === 'bike_em_uso' && (
                    <button
                      onClick={() => openCheckout(selectedResForDetail)}
                      className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Iniciar Devolução</span>
                    </button>
                  )}

                  {/* Primary Download Button with Sergio de Sousa Bruce Signature */}
                  <button
                    disabled={generatingPdfResId === selectedResForDetail.id}
                    onClick={() => handleDownloadPDFAndMarkPaid(selectedResForDetail)}
                    className={`w-full py-3 px-4 rounded-xl text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                      generatingPdfResId === selectedResForDetail.id
                        ? 'bg-amber-400/70 cursor-not-allowed opacity-80'
                        : 'bg-amber-500 hover:bg-amber-400 active:scale-95 shadow-amber-500/20'
                    }`}
                    title="Baixar Contrato PDF Assinado por Sergio de Sousa Bruce com foto do cliente"
                  >
                    {generatingPdfResId === selectedResForDetail.id ? (
                      <>
                        <Loader2 className="w-4 h-4 text-black animate-spin" />
                        <span>Gerando PDF (Aguarde)...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 text-black" />
                        <span>Baixar / Compartilhar PDF (Assinado por Sergio Bruce)</span>
                      </>
                    )}
                  </button>

                  {/* Immediate Mobile Preview Fallback for Detail Modal */}
                  {lastGeneratedPdf && lastGeneratedPdf.resId === selectedResForDetail.id && (
                    <div className="p-3 bg-zinc-900 border border-amber-500/40 rounded-xl space-y-2 animate-fade-in shadow-inner">
                      <div className="flex items-center justify-between text-[11px] text-amber-300 font-bold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          PDF Oficial Pronto ({lastGeneratedPdf.code})
                        </span>
                        <span className="text-[10px] text-zinc-400">Assinado Oficial</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={lastGeneratedPdf.blobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 border border-zinc-700 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-400" />
                          <span>Abrir / Ver PDF</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDownloadPDFAndMarkPaid(selectedResForDetail)}
                          disabled={generatingPdfResId === selectedResForDetail.id}
                          className="py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 border border-amber-500/40 transition-colors cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Compartilhar</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-400 text-center leading-relaxed">
                        💡 <strong>Dica celular:</strong> Se o arquivo não baixou direto, clique em <strong>"Abrir / Ver PDF"</strong> para visualizá-lo em tela cheia no navegador.
                      </p>
                    </div>
                  )}
                </div>

                {/* Send PDF / Confirmation directly to Client's WhatsApp */}
                <button
                  onClick={() => handleSendPdfToClientWhatsApp(selectedResForDetail)}
                  className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                  title="Enviar mensagem oficial com confirmação e enviar PDF no WhatsApp do cliente"
                >
                  <Send className="w-4 h-4 fill-white" />
                  <span>Enviar Confirmação e PDF para WhatsApp do Cliente</span>
                </button>

                <div className="flex items-center justify-end gap-2 pt-1">
                  {selectedResForDetail.status !== 'cancelada' && (
                    <button
                      onClick={() => handleCancelReservation(selectedResForDetail)}
                      className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs cursor-pointer"
                    >
                      Cancelar Reserva
                    </button>
                  )}

                  <button
                    onClick={() => setResToDelete(selectedResForDetail)}
                    className="py-2 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-rose-200 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Excluir Reserva Definitivamente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: CHECK-IN / RETIRADA ================= */}
        {isCheckinModalOpen && selectedResForDetail && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <h3 className="font-black text-white text-base">CHECK-IN / RETIRADA DA BIKE</h3>
                <button onClick={() => setIsCheckinModalOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-black p-3.5 rounded-xl border border-zinc-800 text-xs space-y-1.5">
                <div><strong>Cliente:</strong> {selectedResForDetail.customerSnapshot.fullName} ({selectedResForDetail.customerSnapshot.cpf})</div>
                <div><strong>Bike:</strong> {selectedResForDetail.bikeSnapshot.name} ({selectedResForDetail.bikeSnapshot.code})</div>
                <div><strong>Horário Original Contratado:</strong> {selectedResForDetail.startTime} às {selectedResForDetail.endTime} ({selectedResForDetail.durationHours}h)</div>
                {selectedResForDetail.groupBookingId && (
                  <div className="text-amber-400 font-bold">
                    👥 Reserva em Grupo ({reservations.filter((r) => r.groupBookingId === selectedResForDetail.groupBookingId).length} bikes contratadas)
                  </div>
                )}
              </div>

              {/* Delivery delay & live timer adjustment */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl space-y-2.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={startTimerNow}
                    onChange={(e) => setStartTimerNow(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-zinc-900 border-zinc-700"
                  />
                  <div className="text-xs">
                    <span className="font-black text-amber-300 block">
                      ⏱ Iniciar contagem do aluguel a partir de agora? (Recomendado para atrasos)
                    </span>
                    <span className="text-[11px] text-zinc-300 leading-relaxed block mt-0.5">
                      Se o cliente atrasou para buscar a bike, a contagem de {selectedResForDetail.durationHours}h começará no momento da entrega, garantindo todo o tempo contratado para ele pedalar!
                    </span>
                  </div>
                </label>

                {startTimerNow && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-500/20 text-xs">
                    <div>
                      <label className="text-[10px] text-zinc-300 font-bold block mb-1">
                        Início da Corrida (Agora):
                      </label>
                      <input
                        type="time"
                        value={checkinStartTime}
                        onChange={(e) => {
                          const newStart = e.target.value;
                          setCheckinStartTime(newStart);
                          const endMins = timeToMinutes(newStart) + (selectedResForDetail.durationHours || 1) * 60;
                          setCheckinEndTime(minutesToTime(endMins));
                        }}
                        className="w-full bg-black border border-zinc-700 rounded-lg px-2.5 py-2 text-white font-mono text-xs focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-300 font-bold block mb-1">
                        Nova Devolução ({selectedResForDetail.durationHours}h):
                      </label>
                      <input
                        type="time"
                        value={checkinEndTime}
                        onChange={(e) => setCheckinEndTime(e.target.value)}
                        className="w-full bg-black border border-zinc-700 rounded-lg px-2.5 py-2 text-amber-400 font-mono font-bold text-xs focus:border-amber-400"
                      />
                    </div>
                  </div>
                )}

                {selectedResForDetail.groupBookingId && (
                  <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-amber-500/20">
                    <input
                      type="checkbox"
                      checked={checkinAllGroupBikes}
                      onChange={(e) => setCheckinAllGroupBikes(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-zinc-900 border-zinc-700"
                    />
                    <span className="text-[11px] text-zinc-200 font-bold">
                      Iniciar contagem simultânea para todas as bikes deste cliente no grupo
                    </span>
                  </label>
                )}
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkinBikeOk}
                    onChange={(e) => setCheckinBikeOk(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-zinc-900 border-zinc-700"
                  />
                  <span className="text-xs text-zinc-300 font-semibold">
                    Bike entregue em boas condições mecânicas e calibrada?
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkinTermSigned}
                    onChange={(e) => setCheckinTermSigned(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-zinc-900 border-zinc-700"
                  />
                  <span className="text-xs text-zinc-300 font-semibold">
                    Termo assinado presencialmente pelo cliente no balcão?
                  </span>
                </label>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Responsável pelo Atendimento:
                  </label>
                  <input
                    type="text"
                    value={checkinOperator}
                    onChange={(e) => setCheckinOperator(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Observações de Retirada:
                  </label>
                  <textarea
                    rows={2}
                    value={checkinNotes}
                    onChange={(e) => setCheckinNotes(e.target.value)}
                    placeholder="Ex: Entregue com capacete, pneus 38 PSI..."
                    className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <button
                disabled={isCheckingIn}
                onClick={handleConfirmCheckin}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isCheckingIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Iniciando Locação...</span>
                  </>
                ) : (
                  <span>CONFIRMAR RETIRADA (BIKE EM USO)</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ================= MODAL: DEVOLUÇÃO / CHECK-OUT (ETAPA 6 COM CONFIRMAÇÃO) ================= */}
        {isCheckoutModalOpen && selectedResForDetail && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-850 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {selectedResForDetail.code}
                  </span>
                  <h3 className="font-black text-white text-base">FINALIZAÇÃO DA LOCAÇÃO</h3>
                </div>
                <button 
                  onClick={() => !isFinalizingCheckout && setIsCheckoutModalOpen(false)} 
                  disabled={isFinalizingCheckout}
                  className="text-zinc-400 hover:text-white disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Estado da Bicicleta na Devolução:
                  </label>
                  <select
                    value={checkoutCondition}
                    onChange={(e: any) => setCheckoutCondition(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="normal">☑ Bike devolvida normalmente (perfeito estado)</option>
                    <option value="avaria">☑ Com avaria (arranhões, peças tortas)</option>
                    <option value="problema_mecanico">☑ Com problema mecânico (corrente, freio)</option>
                    <option value="outros">☑ Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Observações e Possíveis Danos:
                  </label>
                  <textarea
                    rows={2}
                    value={checkoutNotes}
                    onChange={(e) => setCheckoutNotes(e.target.value)}
                    placeholder="Descreva as condições da bike na entrega..."
                    className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Responsável pelo Recebimento:
                  </label>
                  <input
                    type="text"
                    value={checkoutOperator}
                    onChange={(e) => setCheckoutOperator(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* CARD DE CONFIRMAÇÃO EXCLUSIVO (ETAPA 6 - Requisito 3) */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 space-y-3">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Finalizar locação?</span>
                </div>

                <div className="space-y-1.5 text-xs text-zinc-300 bg-black/60 p-3 rounded-xl border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">🚲 Bicicleta:</span>
                    <strong className="text-white">{selectedResForDetail.bikeSnapshot.name} ({selectedResForDetail.bikeSnapshot.code})</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">👤 Cliente:</span>
                    <strong className="text-white">{selectedResForDetail.customerSnapshot.fullName}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">⏱️ Tempo Contratado:</span>
                    <span className="text-zinc-300 font-semibold">{selectedResForDetail.durationHours}h ({selectedResForDetail.startTime} às {selectedResForDetail.endTime})</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-zinc-800 pt-1.5">
                    <span className="text-zinc-400">⏱️ Tempo Utilizado:</span>
                    <strong className="text-amber-400 font-mono font-bold">{checkoutElapsedStr}</strong>
                  </div>
                  {checkoutOverdueInfo.isOverdue && (
                    <div className="flex items-center justify-between text-rose-400 font-bold pt-1 border-t border-zinc-800">
                      <span>🔴 TEMPO EXCEDIDO:</span>
                      <span>+{checkoutOverdueInfo.overdueMins} minutos</span>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Ao confirmar: a reserva passa para <strong>FINALIZADA</strong> e a bike <strong>{selectedResForDetail.bikeSnapshot.code}</strong> volta a ficar <strong>DISPONÍVEL</strong> para novas locações.
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isFinalizingCheckout}
                    onClick={() => setIsCheckoutModalOpen(false)}
                    className="w-1/2 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border border-zinc-800 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isFinalizingCheckout}
                    onClick={handleConfirmCheckout}
                    className="w-1/2 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25"
                  >
                    {isFinalizingCheckout ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Finalizando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Finalizar locação</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: ADICIONAR / EDITAR BIKE ================= */}
        {isBikeModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <h3 className="font-black text-white text-base">
                  {editingBike ? 'EDITAR BIKE' : 'ADICIONAR NOVA BIKE'}
                </h3>
                <button onClick={() => setIsBikeModalOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveBike} className="space-y-4">
                {/* Hidden File Inputs for Phone Camera & Gallery */}
                <input
                  ref={bikeCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleBikePhotoUpload}
                />
                <input
                  ref={bikePhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBikePhotoUpload}
                />

                {/* ================= FOTO DA BIKE (CELULAR / CÂMERA) ================= */}
                <div className="bg-zinc-950 border-2 border-dashed border-amber-500/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-amber-400" />
                      <span>Foto da Bike (Carregar do Celular) *</span>
                    </label>
                    {bikePhotoUrl && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" /> Pronta para o catálogo
                      </span>
                    )}
                  </div>

                  {isProcessingBikePhoto ? (
                    <div className="p-8 text-center bg-black/60 rounded-xl border border-zinc-800 space-y-3 animate-pulse">
                      <RefreshCw className="w-8 h-8 mx-auto text-amber-400 animate-spin" />
                      <div>
                        <p className="text-xs font-bold text-white">Otimizando foto do celular...</p>
                        <p className="text-[11px] text-zinc-400">Deixando a imagem leve e de alta qualidade para o site.</p>
                      </div>
                    </div>
                  ) : bikePhotoUrl ? (
                    <div className="space-y-2.5">
                      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-zinc-800 group">
                        <img
                          src={bikePhotoUrl}
                          alt="Prévia da Bike"
                          className="w-full h-full object-cover object-center"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80';
                          }}
                        />
                        <div className="absolute top-2 left-2 bg-black/80 font-mono text-[10px] font-bold text-amber-400 px-2 py-0.5 rounded shadow">
                          {bikeCode || 'NOVA BIKE'}
                        </div>
                      </div>

                      {/* Photo action buttons */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => bikeCameraInputRef.current?.click()}
                          className="py-2 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[11px] flex items-center justify-center gap-1.5 shadow transition-all active:scale-95 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Tirar Outra</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => bikePhotoInputRef.current?.click()}
                          className="py-2 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-[11px] flex items-center justify-center gap-1.5 border border-zinc-700 transition-all active:scale-95 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-amber-400" />
                          <span>Galeria</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBikePhotoUrl('')}
                          className="py-2 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-[11px] flex items-center justify-center gap-1.5 border border-rose-500/30 transition-all active:scale-95 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 sm:p-5 text-center bg-black/60 rounded-xl border border-zinc-850 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center shadow-inner">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-white">
                          Carregue a foto direto do seu celular
                        </h4>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Tire uma foto agora com a câmera ou selecione da sua galeria
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => bikeCameraInputRef.current?.click()}
                          className="py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
                        >
                          <Camera className="w-4 h-4 stroke-[2.5]" />
                          <span>TIRAR FOTO AGORA</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => bikePhotoInputRef.current?.click()}
                          className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-zinc-700 active:scale-95 transition-all cursor-pointer"
                        >
                          <Upload className="w-4 h-4 text-amber-400" />
                          <span>ESCOLHER DA GALERIA</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Optional advanced toggle for pasting URL or using sample photos */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowManualUrlInput(!showManualUrlInput)}
                      className="text-[11px] text-zinc-400 hover:text-amber-400 underline cursor-pointer"
                    >
                      {showManualUrlInput ? '▲ Ocultar link manual de internet' : '▼ Ou colar link de foto da internet / fotos prontas'}
                    </button>

                    {showManualUrlInput && (
                      <div className="mt-2.5 p-3 rounded-xl bg-black border border-zinc-800 space-y-2">
                        <input
                          type="url"
                          placeholder="https://exemplo.com/foto-bike.jpg"
                          value={bikePhotoUrl}
                          onChange={(e) => setBikePhotoUrl(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-[10px] text-zinc-500 font-semibold">Exemplos rápidos:</span>
                          <button
                            type="button"
                            onClick={() => setBikePhotoUrl('https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80')}
                            className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded cursor-pointer"
                          >
                            MTB Aro 29
                          </button>
                          <button
                            type="button"
                            onClick={() => setBikePhotoUrl('https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?auto=format&fit=crop&w=800&q=80')}
                            className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded cursor-pointer"
                          >
                            Sport Aro 29
                          </button>
                          <button
                            type="button"
                            onClick={() => setBikePhotoUrl('https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?auto=format&fit=crop&w=800&q=80')}
                            className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded cursor-pointer"
                          >
                            Conforto
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ================= DADOS BÁSICOS DA BIKE ================= */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">
                      Código da Bike *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="PED-005"
                      value={bikeCode}
                      onChange={(e) => setBikeCode(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">
                      Nome da Bike *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Bike 05"
                      value={bikeName}
                      onChange={(e) => setBikeName(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">
                      Modelo
                    </label>
                    <input
                      type="text"
                      placeholder="Colli Aro 29"
                      value={bikeModel}
                      onChange={(e) => setBikeModel(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {['Colli Aro 29', 'Caloi Vulcan', 'Oggi Aro 29', 'Passeio'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setBikeModel(m)}
                          className="text-[9px] bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white px-1.5 py-0.5 rounded border border-zinc-800 cursor-pointer"
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">
                      Cor
                    </label>
                    <input
                      type="text"
                      placeholder="Azul Metálica"
                      value={bikeColor}
                      onChange={(e) => setBikeColor(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {['Azul', 'Vermelha', 'Preta', 'Amarela', 'Verde Neon'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setBikeColor(c)}
                          className="text-[9px] bg-zinc-950 hover:bg-zinc-800 text-amber-300/80 hover:text-amber-300 px-1.5 py-0.5 rounded border border-zinc-800 cursor-pointer"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Descrição para os Clientes
                  </label>
                  <textarea
                    rows={2}
                    value={bikeDescription}
                    onChange={(e) => setBikeDescription(e.target.value)}
                    placeholder="Detalhes, marchas, suspensão..."
                    className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">
                      Status da Bike
                    </label>
                    <select
                      value={bikeStatus}
                      onChange={(e: any) => setBikeStatus(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="available">🟢 Disponível</option>
                      <option value="maintenance">🔴 Manutenção</option>
                      <option value="inactive">⚪ Inativa (Não visível)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">
                      Observações Internas
                    </label>
                    <input
                      type="text"
                      placeholder="Última revisão, peças..."
                      value={bikeNotes}
                      onChange={(e) => setBikeNotes(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                {/* Seção SmartTag / Rastreador Físico Antifurto */}
                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-400 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasSmartTag}
                        onChange={(e) => setHasSmartTag(e.target.checked)}
                        className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <span>🏷️ Possui SmartTag / Rastreador Físico</span>
                    </label>
                    <span className="text-[10px] text-zinc-500 font-mono">Antifurto Backup</span>
                  </div>

                  {hasSmartTag && (
                    <div className="space-y-2.5 pt-1 border-t border-zinc-900 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                            Tipo de Tag
                          </label>
                          <select
                            value={smartTagType}
                            onChange={(e: any) => setSmartTagType(e.target.value)}
                            className="w-full bg-black border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                          >
                            <option value="samsung">Samsung SmartTag</option>
                            <option value="apple">Apple AirTag</option>
                            <option value="google">Google Find My Device</option>
                            <option value="other">Outro Rastreador</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                            Serial / ID da Tag
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: TAG-COLLI-01"
                            value={smartTagSerial}
                            onChange={(e) => setSmartTagSerial(e.target.value)}
                            className="w-full bg-black border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Nome / Local Oculto
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: SmartTag instalada embaixo do Selim"
                          value={smartTagName}
                          onChange={(e) => setSmartTagName(e.target.value)}
                          className="w-full bg-black border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Link Direto de Busca (Opcional)
                        </label>
                        <input
                          type="url"
                          placeholder="https://smartthingsfind.samsung.com ou link do rastreador"
                          value={smartTagFindUrl}
                          onChange={(e) => setSmartTagFindUrl(e.target.value)}
                          className="w-full bg-black border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider"
                >
                  {editingBike ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR BICICLETA'}
                </button>
              </form>
            </div>
          </div>
        )}
        {/* ================= MODAL: CONFIRMAR EXCLUSÃO DE RESERVA ================= */}
        {resToDelete && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-rose-500/50 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">Excluir Reserva?</h3>
                  <span className="text-xs text-zinc-400">Esta ação não pode ser desfeita</span>
                </div>
              </div>

              <div className="bg-black/60 p-4 rounded-2xl border border-zinc-800 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Código:</span>
                  <strong className="text-amber-400 font-mono">{resToDelete.code}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Cliente:</span>
                  <strong className="text-white">{resToDelete.customerSnapshot.fullName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">CPF:</span>
                  <span className="text-zinc-300 font-mono">{resToDelete.customerSnapshot.cpf}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Data e Horário:</span>
                  <span className="text-zinc-300">
                    {resToDelete.date.split('-').reverse().join('/')} ({resToDelete.startTime} às {resToDelete.endTime})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Bicicleta:</span>
                  <span className="text-zinc-300">{resToDelete.bikeSnapshot.name}</span>
                </div>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Tem certeza que deseja apagar definitivamente este registro do banco de dados? O horário reservado voltará a ficar disponível para outros clientes.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeletingRes}
                  onClick={() => setResToDelete(null)}
                  className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingRes}
                  onClick={handleDeleteReservationConfirm}
                  className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
                >
                  {isDeletingRes ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: CONFIRMAR EXCLUSÃO DE CLIENTE ================= */}
        {clientToDelete && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-rose-500/50 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">Excluir Cadastro do Cliente?</h3>
                  <span className="text-xs text-zinc-400">Autonomia do Administrador</span>
                </div>
              </div>

              <div className="bg-black/60 p-4 rounded-2xl border border-zinc-800 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Nome:</span>
                  <strong className="text-white">{clientToDelete.fullName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">CPF:</span>
                  <span className="text-zinc-300 font-mono">{clientToDelete.cpf}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">WhatsApp:</span>
                  <span className="text-emerald-400">{clientToDelete.whatsapp}</span>
                </div>
                {clientToDelete.fullAddress && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Endereço:</span>
                    <span className="text-zinc-300 truncate max-w-[200px]">{clientToDelete.fullAddress}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Tem certeza que deseja apagar permanentemente o cadastro deste cliente? Os registros nunca somem sozinhos; você tem autonomia total para mantê-los ou excluí-los.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeletingClient}
                  onClick={() => setClientToDelete(null)}
                  className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingClient}
                  onClick={handleDeleteClientConfirm}
                  className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
                >
                  {isDeletingClient ? 'Excluindo...' : 'Sim, Excluir Cliente'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: CONFIRMAR PAGAMENTO PIX ================= */}
        {resToConfirmPayment && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-emerald-500/50 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-emerald-400">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">Confirmar Pagamento PIX?</h3>
                  <span className="text-xs text-zinc-400">Libera a retirada da bike para o cliente</span>
                </div>
              </div>

              <div className="bg-black/60 p-4 rounded-2xl border border-zinc-800 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Código da Reserva:</span>
                  <strong className="text-amber-400 font-mono">{resToConfirmPayment.code}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Cliente:</span>
                  <strong className="text-white">{resToConfirmPayment.customerSnapshot.fullName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Bicicleta:</span>
                  <span className="text-zinc-200">{resToConfirmPayment.bikeSnapshot.name} ({resToConfirmPayment.bikeSnapshot.code})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Horário:</span>
                  <span className="text-zinc-300">
                    {resToConfirmPayment.date.split('-').reverse().join('/')} • {resToConfirmPayment.startTime} às {resToConfirmPayment.endTime}
                  </span>
                </div>
                <div className="flex justify-between border-t border-zinc-800 pt-2 font-bold">
                  <span className="text-zinc-400">Valor Total:</span>
                  <span className="text-emerald-400 text-sm">
                    {resToConfirmPayment.totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isConfirmingPayment}
                  onClick={() => setResToConfirmPayment(null)}
                  className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={isConfirmingPayment}
                  onClick={handleExecuteConfirmPayment}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  {isConfirmingPayment ? 'Confirmando...' : 'Sim, Confirmar PIX'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* In-App Modal de Cancelamento de Reserva (Substitui window.prompt) */}
        {resToCancel && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-md bg-zinc-900 border border-rose-500/40 rounded-3xl p-6 shadow-2xl space-y-5 animate-scale-up">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Cancelar Reserva?</h3>
                  <p className="text-xs text-zinc-400">Reserva {resToCancel.code} • {resToCancel.customerSnapshot.fullName}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 block">Motivo do Cancelamento</label>
                <input
                  type="text"
                  value={cancellationReasonInput}
                  onChange={(e) => setCancellationReasonInput(e.target.value)}
                  placeholder="Ex: Cliente desistiu, reagendamento, etc."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isCancellingRes}
                  onClick={() => setResToCancel(null)}
                  className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={isCancellingRes}
                  onClick={handleExecuteCancelReservation}
                  className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
                >
                  {isCancellingRes ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notificação de Pagamento Confirmado */}
        {paymentSuccessToast && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-slide-up">
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{paymentSuccessToast}</span>
          </div>
        )}

        {/* Global Admin Toast */}
        {adminToast && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-2xl border shadow-2xl flex items-center gap-3 max-w-md ${
            adminToast.type === 'error'
              ? 'bg-rose-950/95 border-rose-500 text-rose-100'
              : adminToast.type === 'info'
              ? 'bg-blue-950/95 border-blue-500 text-blue-100'
              : 'bg-zinc-900/95 border-amber-500/80 text-amber-200'
          }`}>
            {adminToast.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-semibold">{adminToast.message}</span>
            <button
              onClick={() => setAdminToast(null)}
              className="p-1 hover:text-white text-zinc-400 ml-auto cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Modal: Confirmação de Exclusão de Bike */}
        {bikeToDelete && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-rose-400">
                <Trash2 className="w-6 h-6 flex-shrink-0" />
                <h3 className="font-black text-white text-base">EXCLUIR BICICLETA?</h3>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Tem certeza que deseja excluir a bicicleta <strong className="text-white">{bikeToDelete.name} ({bikeToDelete.code})</strong> da frota? Esta ação não pode ser desfeita.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeletingBike}
                  onClick={() => setBikeToDelete(null)}
                  className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingBike}
                  onClick={handleConfirmDeleteBike}
                  className="py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/30 cursor-pointer"
                >
                  {isDeletingBike ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
