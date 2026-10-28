import React, { useState, useEffect, useRef } from 'react';
import { 
  Bike, 
  RentalPlan, 
  CustomerData, 
  Reservation, 
  SystemSettings 
} from '../types';
import { 
  checkReservationConflict, 
  createReservation, 
  generateNextReservationCode, 
  getClientByCpf, 
  findClientByCpfOrPhone,
  getReservationsForBikeAndDate, 
  saveOrUpdateClient, 
  timeToMinutes,
  minutesToTime,
  updateReservationStatus
} from '../lib/dbService';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Calendar as CalendarIcon, 
  Clock, 
  Camera, 
  Upload, 
  Copy, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  QrCode, 
  FileText, 
  Send,
  User,
  Sparkles,
  Smartphone,
  CheckCircle,
  Image as ImageIcon,
  AlertTriangle,
  X,
  Search,
  UserCheck,
  RefreshCw,
  Edit3,
  Key,
  ExternalLink,
  Filter,
  HelpCircle,
  ChevronRight,
  ThumbsUp,
  CheckCheck,
  Loader2,
  Download,
  Eye,
  Share2
} from 'lucide-react';
import { 
  buildReservationWhatsAppText, 
  OFFICIAL_WHATSAPP_LINK,
  getWhatsAppReservationUrl
} from '../lib/whatsapp';
import { 
  generateReservationPDF, 
  downloadOrShareReservationPDF, 
  openReservationPDFInNewTab 
} from '../lib/pdfGenerator';
import { getBikeCurrentStatus } from '../lib/bikeAvailability';
import QRCode from 'qrcode';
import { compressImage, generateDigitalSignatureDataUrl } from '../lib/imageUtils';
import { generatePixCopiaECola, copyToClipboardSafe } from '../lib/pixUtils';

interface BookingFlowProps {
  settings: SystemSettings;
  bikes: Bike[];
  reservations?: Reservation[];
  initialBike?: Bike | null;
  initialCustomer?: CustomerData | null;
  initialPlan?: RentalPlan | null;
  onCancel: () => void;
  onFinished: (reservation: Reservation) => void;
  onStartTracking?: (reservation: Reservation) => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export const BookingFlow: React.FC<BookingFlowProps> = ({
  settings,
  bikes,
  reservations = [],
  initialBike,
  initialCustomer,
  initialPlan,
  onCancel,
  onFinished,
  onStartTracking,
}) => {
  // Load draft from localStorage if available
  const savedBookingDraft = (() => {
    try {
      const raw = localStorage.getItem('pedalae_booking_draft');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  })();

  // Always start at Step 1 (choose bike & plan) so user always sees bike selection and time picker
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Step 1: Bike Selection & Plan - select bike(s) that are truly available
  const availableBikeFallback = bikes.find((b) => getBikeCurrentStatus(b, reservations).isAvailable) || null;
  const [selectedBikes, setSelectedBikes] = useState<Bike[]>(() => {
    if (savedBookingDraft?.selectedBikeIds && Array.isArray(savedBookingDraft.selectedBikeIds)) {
      const found = bikes.filter((b) => savedBookingDraft.selectedBikeIds.includes(b.id));
      if (found.length > 0) return found;
    }
    if (savedBookingDraft?.selectedBikeId) {
      const foundInBikes = bikes.find((b) => b.id === savedBookingDraft.selectedBikeId);
      if (foundInBikes) return [foundInBikes];
    }
    if (initialBike && getBikeCurrentStatus(initialBike, reservations).isAvailable) {
      return [initialBike];
    }
    return availableBikeFallback ? [availableBikeFallback] : (bikes.length > 0 ? [bikes[0]] : []);
  });

  // Backward compatibility alias for single bike views
  const selectedBike = selectedBikes[0] || null;

  const [selectedPlan, setSelectedPlan] = useState<RentalPlan>(() => {
    if (initialPlan) return initialPlan;
    if (savedBookingDraft?.selectedPlanId) {
      const foundPlan = settings.plans.find((p) => p.id === savedBookingDraft.selectedPlanId);
      if (foundPlan) return foundPlan;
    }
    if (savedBookingDraft?.selectedPlanDuration) {
      const foundPlan = settings.plans.find((p) => p.durationHours === savedBookingDraft.selectedPlanDuration);
      if (foundPlan) return foundPlan;
    }
    // Default to the first plan (e.g. 1 HORA - R$ 10,00)
    return settings.plans[0] || { id: 'p1', durationHours: 1, label: '1 HORA', price: 10.00 };
  });

  // Sync initialPlan if passed or changed
  useEffect(() => {
    if (initialPlan) {
      setSelectedPlan(initialPlan);
    }
  }, [initialPlan]);

  // Total price across all selected bikes
  const totalRentalPrice = (selectedPlan?.price || 0) * (selectedBikes.length || 1);

  // Bike Rental Mode: 'single' (super simple 1-bike rental for individuals) or 'group' (for families/groups)
  const [bikeRentalMode, setBikeRentalMode] = useState<'single' | 'group'>(() => {
    return (savedBookingDraft?.selectedBikeIds && savedBookingDraft.selectedBikeIds.length > 1) ? 'group' : 'single';
  });
  const [bikeFilter, setBikeFilter] = useState<'all' | 'available' | 'lotus'>('all');
  const [searchBikeQuery, setSearchBikeQuery] = useState<string>('');

  // Filter bikes according to filter chips and query
  const filteredBikes = React.useMemo(() => {
    return bikes.filter((b) => {
      const status = getBikeCurrentStatus(b, reservations);
      if (bikeFilter === 'available' && !status.isAvailable) return false;
      if (bikeFilter === 'lotus' && !b.model.toLowerCase().includes('lotus')) return false;
      if (searchBikeQuery.trim()) {
        const q = searchBikeQuery.toLowerCase();
        const matchesName = b.name.toLowerCase().includes(q);
        const matchesCode = b.code.toLowerCase().includes(q);
        const matchesColor = b.color.toLowerCase().includes(q);
        const matchesModel = b.model.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesColor && !matchesModel) return false;
      }
      return true;
    });
  }, [bikes, reservations, bikeFilter, searchBikeQuery]);

  // Handle single or multi-bike selection
  const handleSelectBike = (bike: Bike) => {
    setFormError(null);
    if (bikeRentalMode === 'single') {
      setSelectedBikes([bike]);
    } else {
      toggleSelectBike(bike);
    }
  };

  // Toggle bike selection in group mode
  const toggleSelectBike = (bike: Bike) => {
    setFormError(null);
    const isAlreadySelected = selectedBikes.some((b) => b.id === bike.id);
    if (isAlreadySelected) {
      if (selectedBikes.length <= 1) {
        triggerError('Pelo menos uma bicicleta deve permanecer selecionada.');
        return;
      }
      setSelectedBikes(selectedBikes.filter((b) => b.id !== bike.id));
    } else {
      setSelectedBikes([...selectedBikes, bike]);
    }
  };

  // Step 2: Date & Slot Selection
  // Default to today in YYYY-MM-DD local format
  const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return savedBookingDraft?.selectedDate || todayStr;
  });

  // Weekdays definition in Portuguese (segunda, terça, quarta, quinta, sexta, sábado, domingo)
  const WEEKDAYS_MAP = [
    { targetDayIndex: 1, key: 'segunda', label: 'Segunda', short: 'SEG', full: 'Segunda-feira' },
    { targetDayIndex: 2, key: 'terca', label: 'Terça', short: 'TER', full: 'Terça-feira' },
    { targetDayIndex: 3, key: 'quarta', label: 'Quarta', short: 'QUA', full: 'Quarta-feira' },
    { targetDayIndex: 4, key: 'quinta', label: 'Quinta', short: 'QUI', full: 'Quinta-feira' },
    { targetDayIndex: 5, key: 'sexta', label: 'Sexta', short: 'SEX', full: 'Sexta-feira' },
    { targetDayIndex: 6, key: 'sabado', label: 'Sábado', short: 'SÁB', full: 'Sábado' },
    { targetDayIndex: 0, key: 'domingo', label: 'Domingo', short: 'DOM', full: 'Domingo' },
  ];

  // Helper to calculate the next occurring date for a chosen weekday index (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const getNextDateForWeekday = (targetDayIndex: number): string => {
    const now = new Date();
    // Normalize to midnight
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDay = base.getDay();
    
    // Difference in days to reach the target day
    let diff = targetDayIndex - currentDay;
    if (diff < 0) {
      diff += 7; // Target is next week
    }
    // If diff === 0, it means it's today! We allow selecting today.
    const resultDate = new Date(base.getTime() + diff * 24 * 60 * 60 * 1000);
    return getLocalDateString(resultDate);
  };

  // Helper to determine the day of the week for any YYYY-MM-DD string
  const getWeekdayIndexFromDateStr = (dateStr: string): number => {
    if (!dateStr) return -1;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return -1;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.getDay();
  };

  const selectedWeekdayIndex = getWeekdayIndexFromDateStr(selectedDate);
  const [selectedStartTime, setSelectedStartTime] = useState<string>(() => {
    return savedBookingDraft?.selectedStartTime || '15:00';
  });
  const [existingDateReservations, setExistingDateReservations] = useState<Reservation[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Step 3: Customer Information
  const [fullName, setFullName] = useState<string>(() => initialCustomer?.fullName || savedBookingDraft?.fullName || '');
  const [cpf, setCpf] = useState<string>(() => initialCustomer?.cpf || savedBookingDraft?.cpf || '');
  const [birthDate, setBirthDate] = useState<string>(() => initialCustomer?.birthDate || savedBookingDraft?.birthDate || '');
  const [whatsapp, setWhatsapp] = useState<string>(() => initialCustomer?.whatsapp || savedBookingDraft?.whatsapp || '');
  const [email, setEmail] = useState<string>(() => initialCustomer?.email || savedBookingDraft?.email || '');
  const [fullAddress, setFullAddress] = useState<string>(() => initialCustomer?.fullAddress || savedBookingDraft?.fullAddress || '');
  const [photoBase64, setPhotoBase64] = useState<string>(() => initialCustomer?.photoBase64 || savedBookingDraft?.photoBase64 || '');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [searchingClient, setSearchingClient] = useState(false);
  const [clientFoundMessage, setClientFoundMessage] = useState<string | null>(() => {
    if (initialCustomer?.fullName) {
      return `🎉 Bem-vindo(a) de volta, ${initialCustomer.fullName}! Seus dados foram carregados.`;
    }
    return null;
  });
  
  // Returning client lookup state: 'prompt' (asks if returning), 'returning' (lookup input/result), 'new' (registration form)
  const [customerLookupMode, setCustomerLookupMode] = useState<'prompt' | 'returning' | 'new'>(() => {
    if (initialCustomer || (savedBookingDraft?.fullName && savedBookingDraft?.cpf)) {
      return 'returning';
    }
    return 'prompt';
  });
  const [lookupQuery, setLookupQuery] = useState<string>('');
  const [lookupNotFound, setLookupNotFound] = useState<boolean>(false);
  const [isEditingReturningData, setIsEditingReturningData] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Step 4: Terms & Summary
  const [termsAccepted, setTermsAccepted] = useState<boolean>(() => !!savedBookingDraft?.termsAccepted);
  const [lgpdAccepted, setLgpdAccepted] = useState<boolean>(() => savedBookingDraft?.lgpdAccepted ?? true);
  const [digitalSignatureUrl, setDigitalSignatureUrl] = useState<string | null>(() => savedBookingDraft?.digitalSignatureUrl || null);

  // Step 5 & 6: Confirmation & Created Reservation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdReservation, setCreatedReservation] = useState<Reservation | null>(() => {
    return savedBookingDraft?.createdReservation || null;
  });
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>(() => savedBookingDraft?.qrCodeUrl || '');
  const [paymentProofBase64, setPaymentProofBase64] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [proofSavedSuccess, setProofSavedSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New High-Visibility PIX State & Modes
  const [pixPaymentTab, setPixPaymentTab] = useState<'copia-cola' | 'qrcode'>('copia-cola');
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState<string>('');
  const [copiedPixType, setCopiedPixType] = useState<'payload' | 'key' | null>(null);
  const [pixToastMessage, setPixToastMessage] = useState<string | null>(null);

  // PDF State for High-Reliability Mobile Download & Share
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfReadyInfo, setPdfReadyInfo] = useState<{ blobUrl: string; filename: string } | null>(null);
  const [pdfToastNotice, setPdfToastNotice] = useState<string | null>(null);

  // Compute official standard PIX Copia e Cola EMV payload (BR Code)
  const pixCopiaEColaString = React.useMemo(() => {
    const amount = createdReservation
      ? (createdReservation.groupTotalPrice || createdReservation.totalPrice)
      : totalRentalPrice;
    const txId = createdReservation?.code || 'PEDALAE';
    return generatePixCopiaECola({
      pixKey: settings.pixKey,
      pixType: settings.pixType,
      beneficiaryName: settings.pixBeneficiary || 'PEDALAE BIKES',
      city: settings.cityState ? settings.cityState.split('-')[0].trim() : 'PARINTINS',
      amount: amount,
      txId: txId,
    });
  }, [createdReservation, settings, totalRentalPrice]);

  // Generate real PIX QR Code image data
  useEffect(() => {
    if (pixCopiaEColaString) {
      QRCode.toDataURL(pixCopiaEColaString, {
        margin: 1,
        width: 260,
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then((url) => setPixQrCodeUrl(url))
        .catch((err) => console.warn('Erro ao gerar QR Code Pix:', err));
    }
  }, [pixCopiaEColaString]);

  // Fast 1-touch copy with haptic & visual feedback
  const handleCopyPixCopiaCola = async () => {
    const code = pixCopiaEColaString || settings.pixKey;
    const ok = await copyToClipboardSafe(code);
    if (ok) {
      setCopiedPixType('payload');
      setPixToastMessage('🎉 Código Pix Copia e Cola copiado com sucesso! Abra seu aplicativo bancário (Nubank, Caixa, Inter, etc.) e escolha "Pix Copia e Cola".');
      setTimeout(() => setCopiedPixType(null), 4000);
      setTimeout(() => setPixToastMessage(null), 8000);
    }
  };

  const handleCopyPixKeyOnly = async () => {
    const ok = await copyToClipboardSafe(settings.pixKey);
    if (ok) {
      setCopiedPixType('key');
      setPixToastMessage(`🔑 Chave Pix (${settings.pixType}) copiada: ${settings.pixKey}`);
      setTimeout(() => setCopiedPixType(null), 4000);
      setTimeout(() => setPixToastMessage(null), 8000);
    }
  };

  const triggerError = (msg: string) => {
    setFormError(msg);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // Save draft to localStorage whenever relevant state changes
  useEffect(() => {
    try {
      const draft = {
        currentStep,
        selectedBikeId: selectedBike?.id,
        selectedBikeIds: selectedBikes.map((b) => b.id),
        selectedPlanId: selectedPlan?.id,
        selectedPlanDuration: selectedPlan?.durationHours,
        selectedDate,
        selectedStartTime,
        fullName,
        cpf,
        birthDate,
        whatsapp,
        email,
        fullAddress,
        photoBase64,
        termsAccepted,
        lgpdAccepted,
        digitalSignatureUrl,
        createdReservation,
        qrCodeUrl,
      };
      localStorage.setItem('pedalae_booking_draft', JSON.stringify(draft));
    } catch {}
  }, [
    currentStep,
    selectedBike,
    selectedBikes,
    selectedPlan,
    selectedDate,
    selectedStartTime,
    fullName,
    cpf,
    birthDate,
    whatsapp,
    email,
    fullAddress,
    photoBase64,
    termsAccepted,
    lgpdAccepted,
    digitalSignatureUrl,
    createdReservation,
    qrCodeUrl,
  ]);

  const clearBookingDraft = () => {
    try {
      localStorage.removeItem('pedalae_booking_draft');
    } catch {}
  };

  // Fetch reservations for all selected bikes & date to display slot statuses
  useEffect(() => {
    if (!selectedBikes.length || !selectedDate) return;
    setLoadingSlots(true);
    Promise.all(selectedBikes.map((b) => getReservationsForBikeAndDate(b.id, selectedDate)))
      .then((results) => {
        const merged = results.flat();
        setExistingDateReservations(merged);
      })
      .catch((err) => console.warn('Slots load error:', err))
      .finally(() => setLoadingSlots(false));
  }, [selectedBikes, selectedDate]);

  // Auto-search returning client when CPF has 11 digits
  const handleCpfChange = async (val: string) => {
    // Format CPF XXX.XXX.XXX-XX
    const digits = val.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 9) {
      formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    } else if (digits.length > 6) {
      formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;
    }
    setCpf(formatted);

    if (digits.length === 11) {
      setSearchingClient(true);
      try {
        const found = await getClientByCpf(digits);
        if (found) {
          setFullName(found.fullName || '');
          setBirthDate(found.birthDate || '');
          setWhatsapp(found.whatsapp || '');
          setEmail(found.email || '');
          setFullAddress(found.fullAddress || '');
          if (found.photoBase64) {
            setPhotoBase64(found.photoBase64);
          }
          setClientFoundMessage(`Cadastro localizado! Dados de ${found.fullName} preenchidos.`);
        } else {
          setClientFoundMessage(null);
        }
      } catch (err) {
        console.warn('Client search note:', err);
      } finally {
        setSearchingClient(false);
      }
    }
  };

  // Perform search by CPF or WhatsApp for returning client
  const handlePerformLookup = async (queryVal?: string) => {
    const raw = queryVal !== undefined ? queryVal : lookupQuery;
    const clean = raw.replace(/\D/g, '');
    if (clean.length < 8) {
      triggerError('Por favor, informe seu CPF completo (11 dígitos) ou WhatsApp com DDD para buscar seu cadastro.');
      return;
    }
    setSearchingClient(true);
    setLookupNotFound(false);
    setFormError(null);
    try {
      const found = await findClientByCpfOrPhone(clean);
      if (found) {
        setFullName(found.fullName || '');
        setCpf(found.cpf || '');
        setBirthDate(found.birthDate || '');
        setWhatsapp(found.whatsapp || '');
        setEmail(found.email || '');
        setFullAddress(found.fullAddress || '');
        if (found.photoBase64) {
          setPhotoBase64(found.photoBase64);
        }
        setClientFoundMessage(`🎉 Bem-vindo(a) de volta, ${found.fullName}! Seus dados foram carregados.`);
        setCustomerLookupMode('returning');
        setLookupNotFound(false);
        setIsEditingReturningData(false);
      } else {
        setLookupNotFound(true);
        setClientFoundMessage(null);
      }
    } catch (err) {
      console.warn('Lookup error:', err);
      setLookupNotFound(true);
    } finally {
      setSearchingClient(false);
    }
  };

  // Camera capture handlers
  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Camera access note:', err);
      triggerError('Não foi possível acessar a câmera. Você também pode anexar uma foto da sua galeria.');
      setIsCameraActive(false);
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      try {
        setIsCompressingPhoto(true);
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const rawData = canvas.toDataURL('image/jpeg', 0.85);
          const compressed = await compressImage(rawData, 800, 800, 0.75);
          setPhotoBase64(compressed);
        }
      } catch (err) {
        console.error('Camera capture error:', err);
        triggerError('Erro ao capturar foto da câmera. Tente selecionar uma foto da galeria.');
      } finally {
        setIsCompressingPhoto(false);
        // Stop video tracks
        if (videoRef.current?.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
        }
        setIsCameraActive(false);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsCompressingPhoto(true);
      setFormError(null);
      const compressed = await compressImage(file, 800, 800, 0.75);
      setPhotoBase64(compressed);
    } catch (err: any) {
      console.error('File photo error:', err);
      triggerError('Não foi possível carregar esta foto. Verifique se o arquivo é uma imagem válida ou tire uma foto com a câmera.');
    } finally {
      setIsCompressingPhoto(false);
      e.target.value = '';
    }
  };

  // Calculate return time
  const calculateEndTime = (start: string, hours: number): string => {
    const startMins = timeToMinutes(start);
    const endMins = startMins + hours * 60;
    return minutesToTime(endMins);
  };

  const calculatedEndTime = calculateEndTime(selectedStartTime, selectedPlan.durationHours);

  // Generate hourly slots between opening and closing time
  const getSlots = () => {
    const openMins = timeToMinutes(settings.openingTime || '08:00');
    const closeMins = timeToMinutes(settings.closingTime || '22:00');
    const interval = settings.slotIntervalMinutes || 60;
    const slots: { time: string; available: boolean; conflictReason?: string }[] = [];

    for (let m = openMins; m + selectedPlan.durationHours * 60 <= closeMins; m += interval) {
      const slotStart = minutesToTime(m);
      const slotEnd = minutesToTime(m + selectedPlan.durationHours * 60);

      // Check conflict with existing reservations for any selected bike
      let isBusy = false;
      let reason = '';
      for (const res of existingDateReservations) {
        const rStart = timeToMinutes(res.startTime);
        const rEnd = timeToMinutes(res.endTime);
        const candStart = timeToMinutes(slotStart);
        const candEnd = timeToMinutes(slotEnd);

        if (candStart < rEnd && candEnd > rStart) {
          isBusy = true;
          reason = `Ocupado (${res.startTime} - ${res.endTime})`;
          break;
        }
      }

      slots.push({
        time: slotStart,
        available: !isBusy,
        conflictReason: reason,
      });
    }
    return slots;
  };

  // Step 2 validation across all selected bikes
  const validateStep2 = async () => {
    setConflictError(null);
    if (!selectedBikes.length) {
      setConflictError('Selecione pelo menos uma bicicleta.');
      return;
    }

    for (const bike of selectedBikes) {
      const { conflict, conflictingReservation } = await checkReservationConflict(
        bike.id,
        selectedDate,
        selectedStartTime,
        calculatedEndTime
      );

      if (conflict && conflictingReservation) {
        setConflictError(
          `Horário indisponível! A bicicleta "${bike.name} (${bike.code})" já possui reserva de ${conflictingReservation.startTime} às ${conflictingReservation.endTime}. Por favor, escolha outro horário ou altere as bikes selecionadas.`
        );
        return;
      }
    }

    setCurrentStep(3);
  };

  // Step 3 validation
  const validateStep3 = () => {
    setFormError(null);
    if (!fullName.trim() || fullName.trim().split(' ').length < 2) {
      triggerError('Por favor, informe seu nome completo (nome e sobrenome).');
      return;
    }
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      triggerError('Por favor, digite um CPF válido com 11 dígitos.');
      return;
    }
    if (!whatsapp.trim() || whatsapp.replace(/\D/g, '').length < 10) {
      triggerError('Por favor, informe um número de WhatsApp válido com DDD.');
      return;
    }
    if (!fullAddress.trim()) {
      triggerError('Por favor, preencha seu endereço completo.');
      return;
    }
    if (!photoBase64) {
      triggerError('A foto do cliente é obrigatória para segurança e conferência no check-in. Tire uma foto ou envie da galeria.');
      return;
    }
    setCurrentStep(4);
  };

  // Final Step: Submit reservation
  const handleFinalSubmit = async () => {
    setFormError(null);
    if (!termsAccepted) {
      triggerError('É obrigatório ler e aceitar o Termo de Compromisso e Responsabilidade.');
      return;
    }
    if (!selectedBikes.length) {
      triggerError('Selecione pelo menos uma bicicleta para prosseguir.');
      return;
    }

    // Ensure digital signature is generated with client's name
    let activeSignatureUrl = digitalSignatureUrl;
    if (!activeSignatureUrl) {
      activeSignatureUrl = generateDigitalSignatureDataUrl(fullName, cpf, new Date());
      setDigitalSignatureUrl(activeSignatureUrl);
    }

    setIsSubmitting(true);
    try {
      // 1. Re-validate conflict immediately before committing for all selected bikes
      for (const bike of selectedBikes) {
        const { conflict, conflictingReservation } = await checkReservationConflict(
          bike.id,
          selectedDate,
          selectedStartTime,
          calculatedEndTime
        );

        if (conflict && conflictingReservation) {
          triggerError(
            `Ops! A bike "${bike.name}" acabou de ser reservada para este horário (${conflictingReservation.startTime} às ${conflictingReservation.endTime}). Por favor, escolha outro horário.`
          );
          setCurrentStep(2);
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Save/Update Customer record
      const customerPayload: CustomerData = {
        fullName: fullName.trim(),
        cpf: cpf.trim(),
        birthDate: birthDate.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        fullAddress: fullAddress.trim(),
        photoBase64: photoBase64,
      };

      const customerId = await saveOrUpdateClient(customerPayload);

      // 3. Multi-bike booking group configuration
      const isMultiBike = selectedBikes.length > 1;
      const groupBookingId = isMultiBike ? `GRP-${Date.now()}` : undefined;
      const groupBikesSummary = selectedBikes.map((b) => `${b.name} (${b.code})`).join(', ');
      const groupTotalPrice = totalRentalPrice;

      const createdList: Reservation[] = [];

      for (let i = 0; i < selectedBikes.length; i++) {
        const bike = selectedBikes[i];
        const reservationCode = await generateNextReservationCode();

        const newReservation: Omit<Reservation, 'id'> = {
          code: reservationCode,
          bikeId: bike.id,
          bikeSnapshot: {
            code: bike.code,
            name: bike.name,
            model: bike.model,
            color: bike.color,
            photoUrl: bike.photoUrl,
          },
          customerId,
          customerSnapshot: customerPayload,
          date: selectedDate,
          startTime: selectedStartTime,
          endTime: calculatedEndTime,
          durationHours: selectedPlan.durationHours,
          totalPrice: selectedPlan.price,
          pixKey: settings.pixKey,
          status: 'aguardando_pagamento',
          termAgreedOnline: true,
          termAgreedAt: Date.now(),
          digitalSignatureUrl: activeSignatureUrl || '',
          digitalSignedAt: Date.now(),
          digitalSignerName: fullName.trim(),
          digitalSignerCpf: cpf.trim(),
          ...(isMultiBike ? {
            groupBookingId,
            groupTotalBikes: selectedBikes.length,
            groupBikesSummary,
            groupTotalPrice,
          } : {}),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const docId = await createReservation(newReservation);
        createdList.push({
          ...newReservation,
          id: docId,
        });
      }

      const primaryReservation = createdList[0];

      // Generate QR Code data url for primary reservation
      try {
        const qr = await QRCode.toDataURL(primaryReservation.code, {
          margin: 1,
          width: 180,
          color: { dark: '#000000', light: '#ffffff' },
        });
        setQrCodeUrl(qr);
      } catch (err) {
        console.warn(err);
      }

      setCreatedReservation(primaryReservation);
      setCurrentStep(5);
      onFinished(primaryReservation);
    } catch (err: any) {
      console.error(err);
      triggerError(err.message || 'Erro ao processar reserva. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPixKey = () => {
    navigator.clipboard.writeText(settings.pixKey);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  const copyReservationCode = () => {
    if (createdReservation) {
      navigator.clipboard.writeText(createdReservation.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const openWhatsAppWithProof = () => {
    if (!createdReservation) return;
    const url = getWhatsAppReservationUrl(createdReservation, settings.whatsappDisplay);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  const handleDownloadOrSharePDF = async () => {
    if (!createdReservation || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfToastNotice(null);
    try {
      const result = await downloadOrShareReservationPDF(createdReservation, settings);
      setPdfReadyInfo({ blobUrl: result.blobUrl, filename: result.filename });
      if (result.method === 'share') {
        setPdfToastNotice('📱 Compartilhador do celular aberto! Você pode salvar em Arquivos, imprimir ou enviar.');
      } else {
        setPdfToastNotice('📄 PDF pronto! Se o download não iniciou automaticamente, use as opções abaixo.');
      }
      setTimeout(() => setPdfToastNotice(null), 10000);
    } catch (err: any) {
      console.error('Erro ao gerar PDF:', err);
      triggerError('Não foi possível gerar o PDF agora. Você pode tentar novamente ou visualizar seu comprovante no WhatsApp.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleProofFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      triggerError('O arquivo do comprovante deve ter no máximo 5MB.');
      return;
    }

    setIsUploadingProof(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setPaymentProofBase64(base64);

      if (createdReservation) {
        try {
          await updateReservationStatus(createdReservation.id, 'aguardando_pagamento', {
            paymentProofBase64: base64,
            paymentProofUploadedAt: Date.now(),
          });
          setCreatedReservation((prev) =>
            prev ? { ...prev, paymentProofBase64: base64, paymentProofUploadedAt: Date.now() } : null
          );
          setProofSavedSuccess(true);
          setTimeout(() => setProofSavedSuccess(false), 4000);
        } catch (err) {
          console.error('Erro ao salvar comprovante:', err);
        }
      }
      setIsUploadingProof(false);
    };
    reader.readAsDataURL(file);
  };

  const stepsList = [
    { num: 1, label: 'Bike' },
    { num: 2, label: 'Horário' },
    { num: 3, label: 'Cadastro' },
    { num: 4, label: 'Resumo' },
    { num: 5, label: 'Pagamento' },
    { num: 6, label: 'Confirmação' },
  ];

  return (
    <div className="min-h-screen bg-black text-white py-6 px-4 sm:px-6 pb-24 sm:pb-28">
      <div className="max-w-2xl mx-auto">
        {/* Navigation / Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <button
              id="btn-booking-back"
              onClick={() => {
                if (currentStep > 1 && currentStep <= 4) {
                  setCurrentStep((prev) => (prev - 1) as Step);
                } else {
                  if (currentStep === 1 || currentStep >= 5) {
                    clearBookingDraft();
                  }
                  onCancel();
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{currentStep === 1 || currentStep >= 5 ? 'Voltar ao Início' : 'Voltar Etapa'}</span>
            </button>

            <span className="text-xs font-bold text-amber-400">
              Etapa {currentStep} de 6
            </span>
          </div>

          {/* Progress Indicators - Clickable Tabs */}
          <div className="grid grid-cols-6 gap-1.5">
            {stepsList.map((s) => {
              const isActive = currentStep === s.num;
              const isPast = currentStep > s.num;
              const isClickable = s.num <= 4;
              return (
                <button
                  type="button"
                  key={s.num}
                  disabled={!isClickable}
                  onClick={() => {
                    if (isClickable) {
                      setCurrentStep(s.num as Step);
                      setFormError(null);
                    }
                  }}
                  className={`flex flex-col items-center group cursor-pointer transition-all ${!isClickable ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <div
                    className={`h-2 w-full rounded-full transition-all duration-300 ${
                      isActive
                        ? 'bg-amber-400 ring-2 ring-amber-400/50 shadow-md shadow-amber-500/20'
                        : isPast
                        ? 'bg-amber-600 group-hover:bg-amber-500'
                        : 'bg-zinc-800 group-hover:bg-zinc-700'
                    }`}
                  />
                  <span
                    className={`text-[10px] mt-1 font-semibold truncate ${
                      isActive
                        ? 'text-amber-400 font-bold'
                        : isPast
                        ? 'text-zinc-300 group-hover:text-white'
                        : 'text-zinc-500'
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Restored Progress Alert */}
          {currentStep > 1 && currentStep <= 4 && (
            <div className="mt-3 flex items-center justify-between px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                Continuando de onde você parou (Etapa {currentStep})
              </span>
              <button
                type="button"
                onClick={() => {
                  clearBookingDraft();
                  setCurrentStep(1);
                  setFormError(null);
                }}
                className="text-[10px] text-zinc-400 hover:text-white underline font-semibold ml-2 cursor-pointer"
              >
                Recomeçar
              </button>
            </div>
          )}

          {/* Form Error Notification Banner */}
          {formError && (
            <div className="mt-3 p-3.5 rounded-2xl bg-rose-950/90 border border-rose-500/70 text-rose-200 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-xl animate-bounce-short">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                <span>{formError}</span>
              </div>
              <button
                onClick={() => setFormError(null)}
                className="p-1 hover:text-white text-zinc-400 flex-shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ================= STEP 1: BIKE & PLAN ================= */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                Etapa 1 de 5 • Escolha da Bicicleta
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Escolha sua Bike e o Tempo
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-lg mx-auto">
                Selecione o modelo ideal para seu passeio e por quantas horas deseja curtir Parintins.
              </p>
            </div>

            {/* Mode Switcher: Single Rider vs Group / Family */}
            <div className="bg-zinc-900/90 border border-zinc-800 p-1.5 rounded-2xl flex items-center gap-1 max-w-md mx-auto">
              <button
                type="button"
                id="btn-mode-single"
                onClick={() => {
                  setBikeRentalMode('single');
                  if (selectedBikes.length > 1) {
                    setSelectedBikes([selectedBikes[0]]);
                  }
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  bikeRentalMode === 'single'
                    ? 'bg-amber-500 text-black shadow-md font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Alugar 1 Bike (Padrão)</span>
              </button>

              <button
                type="button"
                id="btn-mode-group"
                onClick={() => setBikeRentalMode('group')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  bikeRentalMode === 'group'
                    ? 'bg-amber-500 text-black shadow-md font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Alugar 2+ Bikes (Grupo)</span>
              </button>
            </div>

            {/* HERO CARD: Selected Bike Confirmation Banner (Solves client getting lost) */}
            {selectedBike && (
              <div className="bg-gradient-to-r from-amber-500/20 via-zinc-900 to-amber-500/10 border-2 border-amber-400/80 rounded-2xl p-4 sm:p-5 shadow-xl shadow-amber-500/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 w-full sm:w-auto">
                  <div className="relative w-16 h-20 sm:w-20 sm:h-24 rounded-xl overflow-hidden border-2 border-amber-400 bg-black flex-shrink-0 shadow-md">
                    <img
                      src={selectedBike.photoUrl}
                      alt={selectedBike.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-center"
                    />
                    <span className="absolute bottom-1 left-1 bg-black/85 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-amber-400">
                      {selectedBike.code}
                    </span>
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="inline-flex items-center gap-1.5 bg-amber-400 text-black text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>{selectedBikes.length > 1 ? `${selectedBikes.length} BIKES SELECIONADAS` : 'BIKE SELECIONADA'}</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-white truncate">
                      {selectedBike.name}
                    </h3>
                    <p className="text-xs text-zinc-300">
                      {selectedBike.model} • Cor: <strong>{selectedBike.color}</strong>
                    </p>
                    <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Pronta para o seu passeio
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById('section-tempo-aluguel')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>Definir Tempo de Aluguel</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Bike Grid Selector Header & Filters */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div>
                  <h4 className="text-xs font-black text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🚲 Catálogo de Bicicletas</span>
                    <span className="text-zinc-500 font-normal">
                      (Clique na bike desejada para escolher)
                    </span>
                  </h4>
                </div>

                {/* Filter chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBikeFilter('all')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      bikeFilter === 'all'
                        ? 'bg-amber-500 text-black'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Todas ({bikes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBikeFilter('available')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      bikeFilter === 'available'
                        ? 'bg-emerald-500 text-black'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400'
                    }`}
                  >
                    🟢 Livres Agora ({bikes.filter((b) => getBikeCurrentStatus(b, reservations).isAvailable).length})
                  </button>
                </div>
              </div>

              {/* Quick Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar bike por cor, código ou modelo..."
                  value={searchBikeQuery}
                  onChange={(e) => setSearchBikeQuery(e.target.value)}
                  className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
                {searchBikeQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchBikeQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Bike Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {filteredBikes.map((bike) => {
                  const bikeStatus = getBikeCurrentStatus(bike, reservations);
                  const isSelectable = bike.status !== 'maintenance' && bike.status !== 'inactive';
                  const isSelected = selectedBikes.some((b) => b.id === bike.id);
                  const selectedIndex = selectedBikes.findIndex((b) => b.id === bike.id);

                  return (
                    <div
                      key={bike.id}
                      id={`booking-select-bike-${bike.code.toLowerCase()}`}
                      onClick={() => {
                        if (isSelectable) {
                          handleSelectBike(bike);
                        }
                      }}
                      className={`relative rounded-2xl p-3.5 border-2 transition-all flex flex-col justify-between gap-3 select-none cursor-pointer ${
                        !isSelectable
                          ? 'opacity-40 bg-zinc-950 border-zinc-800 cursor-not-allowed'
                          : isSelected
                          ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/50 shadow-xl shadow-amber-500/15'
                          : 'bg-zinc-900/80 border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex gap-3.5">
                        <div className="relative w-24 h-32 rounded-xl overflow-hidden bg-black flex-shrink-0 border border-zinc-800">
                          <img
                            src={bike.photoUrl}
                            alt={bike.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover object-center"
                          />
                          <span className="absolute bottom-1 left-1 bg-black/85 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-amber-400">
                            {bike.code}
                          </span>
                          {bikeStatus.isInUse && (
                            <div className="absolute top-1 right-1 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                              EM USO
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col justify-between flex-grow min-w-0">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                                Cor: {bike.color}
                              </span>
                              {isSelected && (
                                <span className="inline-flex items-center gap-1 bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  {selectedBikes.length > 1 ? `BIKE ${selectedIndex + 1}` : 'ESCOLHIDA'}
                                </span>
                              )}
                            </div>

                            <h4 className="font-black text-white text-sm sm:text-base leading-snug mt-1 truncate">
                              {bike.name}
                            </h4>
                            <span className="text-xs text-zinc-300 font-medium block truncate">
                              {bike.model}
                            </span>

                            <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px] text-zinc-400">
                              <span className="bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                                Freio a disco
                              </span>
                              <span className="bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                                Aro 29
                              </span>
                            </div>
                          </div>

                          {bikeStatus.isInUse ? (
                            <div className="mt-1">
                              <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                Em uso (Livre às {bikeStatus.endTime})
                              </span>
                            </div>
                          ) : (
                            <span className={`text-[11px] font-bold mt-1 ${isSelectable ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isSelectable ? '🟢 Pronta para pedalar' : '🔴 Em Manutenção'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Action Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelectable) {
                            handleSelectBike(bike);
                          }
                        }}
                        className={`w-full py-2.5 px-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>✓ Bike Selecionada</span>
                          </>
                        ) : (
                          <>
                            <span>🚲 Escolher esta Bike</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {filteredBikes.length === 0 && (
                <div className="p-8 text-center bg-zinc-900/60 rounded-2xl border border-zinc-800 text-zinc-400 text-xs">
                  Nenhuma bicicleta encontrada para o filtro selecionado.
                  <button
                    type="button"
                    onClick={() => {
                      setBikeFilter('all');
                      setSearchBikeQuery('');
                    }}
                    className="block mx-auto mt-2 text-amber-400 underline font-bold"
                  >
                    Mostrar todas as bicicletas
                  </button>
                </div>
              )}

              {/* Selected bikes summary ribbon */}
              {selectedBikes.length > 0 && (
                <div className="p-3 bg-zinc-950 rounded-xl border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-bold">Bikes no seu pedido:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedBikes.map((b) => (
                        <span key={b.id} className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                          {b.name} ({b.code})
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-zinc-400">Total do plano: </span>
                    <strong className="text-amber-400 font-bold font-mono">
                      {totalRentalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                    {selectedBikes.length > 1 && (
                      <span className="text-[10px] text-zinc-500 block">
                        ({selectedBikes.length} bikes x {selectedPlan.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Plan Selector with Anchor */}
            <div id="section-tempo-aluguel" className="space-y-3 pt-4 border-t border-zinc-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                    Passo 2 de 2 nesta etapa
                  </span>
                  <label className="text-sm font-black text-white">
                    ⏱️ Quanto tempo você quer pedalar?
                  </label>
                </div>
                <span className="text-xs text-zinc-400 font-medium">
                  {selectedPlan.durationHours}h selecionadas
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {settings.plans.map((plan) => {
                  const isPlanSelected = selectedPlan.id === plan.id;
                  const planTotal = plan.price * selectedBikes.length;
                  return (
                    <button
                      type="button"
                      key={plan.id}
                      id={`booking-select-plan-${plan.id}`}
                      onClick={() => {
                        setSelectedPlan(plan);
                        setFormError(null);
                      }}
                      className={`relative p-3.5 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col justify-between items-center w-full active:scale-95 ${
                        isPlanSelected
                          ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20 font-bold scale-[1.02]'
                          : 'bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:border-amber-500/40 hover:bg-zinc-800'
                      }`}
                    >
                      {plan.popular && (
                        <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.2 rounded-full text-[9px] font-black uppercase shadow ${
                          isPlanSelected ? 'bg-black text-amber-400' : 'bg-amber-500 text-black'
                        }`}>
                          Mais Popular
                        </span>
                      )}
                      <div className="text-xs font-black uppercase mt-1">{plan.label}</div>
                      <div
                        className={`text-xl font-black mt-1 ${
                          isPlanSelected ? 'text-black' : 'text-amber-400'
                        }`}
                      >
                        {planTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${isPlanSelected ? 'text-zinc-900 font-semibold' : 'text-zinc-400'}`}>
                        {selectedBikes.length > 1
                          ? `${plan.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / bike`
                          : `${plan.durationHours} hora${plan.durationHours > 1 ? 's' : ''} de pedal`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Next Button */}
            <div className="pt-4">
              <button
                id="btn-step1-next"
                disabled={!selectedBikes.length}
                onClick={() => {
                  setCurrentStep(2);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:brightness-110 text-black font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50 shadow-xl shadow-amber-500/25 cursor-pointer"
              >
                <span>Avançar para Escolha de Horário</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: DATE & HORÁRIO ================= */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-black text-white">
                2. Escolha o Horário de Buscar a Bike
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Selecione a data e o horário exato em que você virá retirar {selectedBikes.length > 1 ? 'suas bicicletas' : 'sua bicicleta'}.
              </p>
            </div>

            {/* Selected Bikes Brief */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🚲 {selectedBikes.length > 1 ? `Bicicletas Selecionadas (${selectedBikes.length})` : 'Bicicleta Selecionada'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-xl border border-zinc-700 transition-colors cursor-pointer"
                >
                  {selectedBikes.length > 1 ? 'Alterar / Escolher Bikes' : '+ Escolher Mais Bikes'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedBikes.map((b) => (
                  <div key={b.id} className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80 flex items-center gap-3">
                    <img
                      src={b.photoUrl}
                      alt={b.name}
                      className="w-12 h-14 rounded-lg object-cover bg-black border border-zinc-800 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono font-bold text-amber-400">{b.code}</span>
                      <h4 className="font-bold text-white text-xs truncate">{b.name}</h4>
                      <span className="text-[11px] text-zinc-400 block">{b.model} • {b.color}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs pt-1.5 text-zinc-400 border-t border-zinc-800/50 gap-1.5">
                <div className="flex items-center gap-2">
                  <span>Plano: <strong className="text-white">{selectedPlan.label} ({selectedPlan.durationHours}h - {selectedPlan.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep(1);
                      setTimeout(() => {
                        document.getElementById('section-tempo-aluguel')?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }}
                    className="text-amber-400 hover:text-amber-300 underline font-bold cursor-pointer"
                  >
                    Trocar Plano
                  </button>
                </div>
                <span>Valor Total: <strong className="text-amber-400 font-bold font-mono text-sm">{totalRentalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
              </div>
            </div>

            {/* Day of the Week Selector (Segunda a Domingo) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-amber-400" />
                  Escolha o Dia da Retirada:
                </label>
                <span className="text-[11px] text-amber-400 font-semibold">
                  {WEEKDAYS_MAP.find((w) => w.targetDayIndex === selectedWeekdayIndex)?.full || 'Personalizado'}
                </span>
              </div>

              {/* 7 Days of Week Interactive Pills */}
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 sm:gap-2">
                {WEEKDAYS_MAP.map((w) => {
                  const targetDate = getNextDateForWeekday(w.targetDayIndex);
                  const isSelected = selectedDate === targetDate || (selectedWeekdayIndex === w.targetDayIndex);
                  const [ty, tm, td] = targetDate.split('-');
                  const formattedDayMonth = `${td}/${tm}`;
                  const isToday = targetDate === todayStr;

                  return (
                    <button
                      key={w.key}
                      type="button"
                      id={`btn-weekday-${w.key}`}
                      onClick={() => {
                        setSelectedDate(targetDate);
                        setConflictError(null);
                      }}
                      className={`relative flex flex-col items-center justify-center p-2.5 sm:py-3 rounded-2xl border transition-all cursor-pointer text-center ${
                        isSelected
                          ? 'bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-500/30 scale-102 font-black z-10'
                          : 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:border-amber-500/40 hover:bg-zinc-800/90'
                      }`}
                    >
                      {isToday && (
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full mb-1 ${
                            isSelected ? 'bg-black text-amber-400' : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          Hoje
                        </span>
                      )}
                      <span className={`text-xs sm:text-sm font-bold block ${isSelected ? 'text-black font-black' : 'text-white'}`}>
                        {w.label}
                      </span>
                      <span className={`text-[10px] mt-0.5 font-mono ${isSelected ? 'text-black/80 font-bold' : 'text-zinc-400'}`}>
                        {formattedDayMonth}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Picker Alternative / Calendar View */}
            <div className="space-y-1.5 bg-zinc-950/60 p-3.5 rounded-2xl border border-zinc-800/80">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Data selecionada para o passeio:</span>
                <span className="text-amber-400 font-bold font-mono">
                  {selectedDate.split('-').reverse().join('/')} ({WEEKDAYS_MAP.find((w) => w.targetDayIndex === selectedWeekdayIndex)?.full || ''})
                </span>
              </div>
              <input
                id="input-booking-date"
                type="date"
                min={todayStr}
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setConflictError(null);
                }}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-400 text-xs mt-1"
              />
            </div>

            {/* Conflict Error Notice */}
            {conflictError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{conflictError}</span>
              </div>
            )}

            {/* Time Slot Picker */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Horário de Retirada (A que horas você vai buscar a bike?):
                </label>
                <span className="text-[11px] text-zinc-400">
                  {settings.openingTime} às {settings.closingTime}
                </span>
              </div>

              {loadingSlots ? (
                <div className="py-6 text-center text-xs text-zinc-400 animate-pulse">
                  Verificando disponibilidade das bikes...
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {getSlots().map((slot) => {
                    const isSelected = selectedStartTime === slot.time;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        id={`btn-slot-${slot.time.replace(':', '-')}`}
                        disabled={!slot.available}
                        onClick={() => setSelectedStartTime(slot.time)}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          !slot.available
                            ? 'bg-zinc-950/70 border-zinc-900 text-zinc-600 cursor-not-allowed'
                            : isSelected
                            ? 'bg-amber-500 text-black border-amber-400 font-bold shadow-md ring-2 ring-amber-500/40'
                            : 'bg-zinc-900 border-zinc-800 hover:border-amber-500/50 text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">{slot.time}</span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              slot.available ? 'bg-emerald-400' : 'bg-rose-500'
                            }`}
                          />
                        </div>
                        <span
                          className={`text-[10px] mt-1 ${
                            isSelected
                              ? 'text-zinc-900 font-semibold'
                              : slot.available
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {slot.available ? '🟢 DISPONÍVEL' : '🔴 INDISPONÍVEL'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Direct Time Input if client wants a specific minute */}
              <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block">
                    ⏰ Ou digite outro horário exato de retirada:
                  </label>
                  <span className="text-[11px] text-zinc-500">
                    Ex: 15:30, 16:15 ou o minuto que preferir
                  </span>
                </div>
                <input
                  type="time"
                  value={selectedStartTime}
                  onChange={(e) => setSelectedStartTime(e.target.value)}
                  className="bg-black border border-zinc-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-amber-400 w-32 text-center"
                />
              </div>
            </div>

            {/* Calculated Interval Preview */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-center justify-between text-xs">
              <div>
                <span className="text-zinc-400">Horário para Buscar a Bike:</span>
                <div className="text-amber-300 font-black text-base mt-0.5">
                  {selectedStartTime} (Retirada no Ponto Pedalaê)
                </div>
              </div>
              <div className="text-right">
                <span className="text-zinc-400">Horário de Devolução:</span>
                <div className="text-white font-black text-base mt-0.5">{calculatedEndTime} ({selectedPlan.durationHours}h)</div>
              </div>
            </div>

            {/* Next Button */}
            <div className="pt-2">
              <button
                id="btn-step2-next"
                onClick={validateStep2}
                className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <span>Avançar para Cadastro do Cliente</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: CUSTOMER REGISTRATION ================= */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-black text-white">
                3. Identificação do Cliente
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Alugue rapidamente com seus dados salvos ou faça seu cadastro em 1 minuto.
              </p>
            </div>

            {/* INITIAL QUESTION: Ask if customer already has an account */}
            {customerLookupMode === 'prompt' && !fullName && (
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl animate-fadeIn">
                <div className="w-16 h-16 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl flex items-center justify-center mx-auto text-3xl">
                  🚴‍♂️
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    Você já alugou com a gente no PEDALAÊ?
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
                    Se você já pedalou conosco antes, seus dados já estão salvos e você conclui sua reserva em segundos!
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerLookupMode('returning');
                      setFormError(null);
                    }}
                    className="p-5 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-left font-bold shadow-lg shadow-amber-500/20 active:scale-98 transition-all flex flex-col justify-between gap-3 border border-amber-400 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">⚡</span>
                      <span className="bg-black/20 text-black text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                        Aluguel Rápido
                      </span>
                    </div>
                    <div>
                      <div className="text-base font-black uppercase tracking-wide">
                        SIM, JÁ SOU CADASTRADO
                      </div>
                      <p className="text-xs text-zinc-900 font-semibold mt-0.5 opacity-90">
                        Buscar por CPF ou WhatsApp
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCustomerLookupMode('new');
                      setFormError(null);
                    }}
                    className="p-5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 border-2 border-zinc-700 hover:border-amber-400 text-left font-bold active:scale-98 transition-all flex flex-col justify-between gap-3 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">📝</span>
                      <span className="bg-zinc-800 text-zinc-400 group-hover:text-amber-400 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                        Primeira Locação
                      </span>
                    </div>
                    <div>
                      <div className="text-base font-black text-white uppercase tracking-wide">
                        NÃO, PRIMEIRA VEZ
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Fazer cadastro rápido de 1 minuto
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* MODE TOGGLE TABS (when not in initial prompt) */}
            {customerLookupMode !== 'prompt' && (
              <div className="flex bg-zinc-950 p-1 rounded-2xl border border-zinc-800 max-w-sm mx-auto shadow-inner">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerLookupMode('returning');
                    setFormError(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    customerLookupMode === 'returning'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Já sou cadastrado</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerLookupMode('new');
                    setIsEditingReturningData(false);
                    setFormError(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    customerLookupMode === 'new'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Primeira vez (Novo)</span>
                </button>
              </div>
            )}

            {/* RETURNING CUSTOMER SEARCH BOX (when in 'returning' mode and no client is confirmed yet, or searching) */}
            {customerLookupMode === 'returning' && (!fullName || lookupNotFound) && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl animate-fadeIn">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Search className="w-4 h-4 text-amber-400" />
                  <span>Recuperar Dados do Cliente</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Digite seu <strong>CPF</strong> ou seu número de <strong>WhatsApp com DDD</strong> para carregar seus dados:
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-grow">
                    <input
                      type="text"
                      value={lookupQuery}
                      onChange={(e) => {
                        setLookupQuery(e.target.value);
                        setLookupNotFound(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handlePerformLookup();
                        }
                      }}
                      placeholder="Ex: 554.336.182-34 ou (92) 99812-5020"
                      className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePerformLookup()}
                    disabled={searchingClient}
                    className="py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-amber-500/10 flex-shrink-0"
                  >
                    {searchingClient ? (
                      <>
                        <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        <span>Buscando...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 stroke-[2.5]" />
                        <span>Buscar Cadastro</span>
                      </>
                    )}
                  </button>
                </div>

                {lookupNotFound && (
                  <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-rose-300">
                      <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      <span>Nenhum cadastro encontrado com esses dados</span>
                    </div>
                    <p className="text-zinc-300">
                      Não localizamos cadastro anterior com este número ou documento. Você pode fazer seu cadastro rápido agora mesmo!
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const clean = lookupQuery.replace(/\D/g, '');
                        if (clean.length === 11) {
                          setCpf(lookupQuery);
                        } else if (clean.length >= 10) {
                          setWhatsapp(lookupQuery);
                        }
                        setCustomerLookupMode('new');
                        setLookupNotFound(false);
                      }}
                      className="mt-1 py-2 px-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] uppercase tracking-wider cursor-pointer"
                    >
                      Fazer Cadastro Rápido Agora (1 minuto) →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* VERIFIED RETURNING CLIENT CARD (when client data is loaded) */}
            {customerLookupMode === 'returning' && fullName && (
              <div className="bg-zinc-900 border-2 border-emerald-500/50 rounded-2xl p-5 space-y-4 shadow-xl animate-fadeIn">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    Cliente Cadastrado no PEDALAÊ
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFullName('');
                      setCpf('');
                      setWhatsapp('');
                      setEmail('');
                      setFullAddress('');
                      setPhotoBase64('');
                      setClientFoundMessage(null);
                      setLookupQuery('');
                      setCustomerLookupMode('returning');
                    }}
                    className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Buscar outro cliente</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  {photoBase64 ? (
                    <img
                      src={photoBase64}
                      alt={fullName}
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-500 shadow-md flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500 flex-shrink-0">
                      <User className="w-8 h-8 opacity-40" />
                    </div>
                  )}

                  <div className="space-y-1.5 text-center sm:text-left flex-grow">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <h4 className="text-lg font-black text-white">{fullName}</h4>
                      <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/40">
                        Ativo
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-zinc-300">
                      <span className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 font-mono">
                        CPF: {cpf}
                      </span>
                      <span className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-emerald-400 font-semibold">
                        WhatsApp: {whatsapp}
                      </span>
                    </div>

                    {fullAddress && (
                      <p className="text-[11px] text-zinc-400 truncate max-w-md">
                        📍 {fullAddress}
                      </p>
                    )}
                  </div>
                </div>

                {/* Returning client action buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2.5 border-t border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => setIsEditingReturningData(!isEditingReturningData)}
                    className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5 border border-zinc-700 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isEditingReturningData ? 'Ocultar Edição' : '✏️ Atualizar Meus Dados'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={validateStep3}
                    className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    <span>Confirmar e Avançar para o Resumo</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* REGISTRATION FORM: Shown when mode is 'new' OR when returning client clicks 'Atualizar Meus Dados' */}
            {(customerLookupMode === 'new' || (customerLookupMode === 'returning' && isEditingReturningData)) && (
              <div className="space-y-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    {customerLookupMode === 'new' ? '📝 Formulário de Cadastro Rápido' : '✏️ Edição dos Seus Dados'}
                  </span>
                  <span className="text-[10px] text-zinc-400">Preenchimento rápido e seguro</span>
                </div>

                {/* CPF */}
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    CPF <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="input-customer-cpf"
                      type="text"
                      required
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => handleCpfChange(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400"
                    />
                    {searchingClient && (
                      <span className="absolute right-3 top-3.5 text-xs text-amber-400 animate-spin">
                        ⏳
                      </span>
                    )}
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Nome Completo <span className="text-amber-400">*</span>
                  </label>
                  <input
                    id="input-customer-name"
                    type="text"
                    required
                    placeholder="Seu nome completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* WhatsApp & Birthdate */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                      WhatsApp <span className="text-amber-400">*</span>
                    </label>
                    <input
                      id="input-customer-whatsapp"
                      type="tel"
                      required
                      placeholder="(92) 99999-9999"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                      Data de Nascimento
                    </label>
                    <input
                      id="input-customer-birthdate"
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    E-mail (opcional)
                  </label>
                  <input
                    id="input-customer-email"
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Full Address */}
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Endereço Completo <span className="text-amber-400">*</span>
                  </label>
                  <input
                    id="input-customer-address"
                    type="text"
                    required
                    placeholder="Rua, número, bairro, cidade (ou pousada/hotel)"
                    value={fullAddress}
                    onChange={(e) => setFullAddress(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Photo Upload / Camera */}
                <div className="pt-2 border-t border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      Foto do Cliente <span className="text-amber-400">*</span> (Para identificação no check-in)
                    </label>
                    <span className="text-[10px] text-amber-400 font-semibold">Otimização Automática</span>
                  </div>

                  {/* Camera View for Desktop Webcam */}
                  {isCameraActive && (
                    <div className="space-y-3 mb-3">
                      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-w-sm mx-auto border border-amber-500/40">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      </div>
                      <canvas ref={canvasRef} className="hidden" />
                      <button
                        type="button"
                        id="btn-capture-photo-now"
                        onClick={capturePhoto}
                        className="w-full py-2.5 rounded-xl bg-amber-500 text-black font-bold text-xs uppercase"
                      >
                        📸 Capturar Foto Agora
                      </button>
                    </div>
                  )}

                  {/* Loading state during compression */}
                  {isCompressingPhoto && (
                    <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center gap-2 text-xs text-amber-300 animate-pulse">
                      <span className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span>Carregando e otimizando sua foto com segurança...</span>
                    </div>
                  )}

                  {/* Preview or Controls */}
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    {photoBase64 ? (
                      <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-amber-500 flex-shrink-0 shadow-lg">
                        <img src={photoBase64} alt="Foto do Cliente" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPhotoBase64('')}
                          className="absolute bottom-0 inset-x-0 bg-rose-600/90 text-white text-[9px] font-bold py-1 text-center"
                        >
                          Trocar Foto
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-xl border border-dashed border-zinc-700 bg-zinc-950 flex flex-col items-center justify-center text-zinc-500 flex-shrink-0">
                        <User className="w-8 h-8 opacity-40" />
                        <span className="text-[10px] mt-1">Sem foto</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 w-full">
                      {/* Native mobile camera capture button */}
                      <label
                        id="label-take-camera-photo"
                        className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-black text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all shadow-md shadow-amber-500/10"
                      >
                        <Camera className="w-4 h-4 text-black" />
                        <span>Tirar com Câmera</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>

                      {/* Gallery picker */}
                      <label
                        id="label-upload-gallery"
                        className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 cursor-pointer active:scale-95 transition-all"
                      >
                        <Upload className="w-4 h-4 text-amber-400" />
                        <span>Escolher da Galeria</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Submit button for form */}
                <div className="pt-3">
                  <button
                    id="btn-step3-next"
                    type="button"
                    onClick={validateStep3}
                    className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                  >
                    <span>Conferir Resumo da Reserva</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 4: RESUMO & TERMOS ================= */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-black text-white">
                4. Confira sua Reserva
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Revise com atenção todos os dados antes de finalizar.
              </p>
            </div>

            {/* Summary Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              {/* Header with Photo & Bike */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  {photoBase64 && (
                    <img
                      src={photoBase64}
                      alt={fullName}
                      className="w-12 h-12 rounded-full object-cover border border-amber-500"
                    />
                  )}
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Cliente</span>
                    <h4 className="font-bold text-white text-base leading-tight">{fullName}</h4>
                    <span className="text-xs text-zinc-400">CPF: {cpf}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Contato</span>
                  <div className="text-xs font-semibold text-emerald-400">{whatsapp}</div>
                </div>
              </div>

              {/* Bike & Plan Details */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 uppercase text-[10px] font-bold block">
                    {selectedBikes.length > 1 ? `Bicicletas Escolhidas (${selectedBikes.length})` : 'Bicicleta Escolhida'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                  >
                    ✏️ Alterar Bikes
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedBikes.map((bike, idx) => (
                    <div key={bike.id} className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80 flex items-center gap-3">
                      <img
                        src={bike.photoUrl}
                        alt={bike.name}
                        className="w-12 h-12 rounded-lg object-cover border border-amber-500/40 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-xs truncate">{bike.name}</span>
                          <span className="text-[10px] font-mono text-amber-400 font-bold bg-black px-1 rounded border border-zinc-800">
                            {bike.code}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400 block truncate">
                          {bike.model} • {bike.color}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-zinc-500 uppercase text-[10px] font-bold block">
                    Data e Horário de Retirada
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                  >
                    ✏️ Alterar Horário
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80">
                    <span className="text-zinc-500 uppercase text-[10px] block">Data do Passeio</span>
                    <span className="font-bold text-white text-sm block mt-0.5">
                      {selectedDate.split('-').reverse().join('/')}
                    </span>
                    <span className="text-[11px] text-amber-400 font-semibold">
                      {WEEKDAYS_MAP.find((w) => w.targetDayIndex === selectedWeekdayIndex)?.full || 'Parintins / AM'}
                    </span>
                  </div>

                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80">
                    <span className="text-zinc-500 uppercase text-[10px] block">Horário para Buscar a Bike</span>
                    <span className="font-bold text-amber-400 text-sm block mt-0.5">
                      {selectedStartTime} → {calculatedEndTime}
                    </span>
                    <span className="text-[11px] text-zinc-400">{selectedPlan.durationHours} horas ({selectedPlan.label})</span>
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="bg-gradient-to-r from-amber-500/10 via-zinc-900 to-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-400 uppercase tracking-wider block">Valor Total do Aluguel</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">
                      {totalRentalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    {selectedBikes.length > 1 && (
                      <span className="text-xs text-amber-400 font-bold">
                        ({selectedBikes.length} bikes)
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-emerald-400 font-semibold block">Pagamento via PIX</span>
                  <span className="text-[10px] text-zinc-400">Chave exibida na próxima etapa</span>
                </div>
              </div>

              {/* Legal Terms Box */}
              <div className="pt-2 space-y-4">
                <div className="border border-zinc-800 rounded-xl p-3 bg-black/60 max-h-36 overflow-y-auto text-[11px] text-zinc-400 space-y-2 leading-relaxed">
                  <div className="font-bold text-zinc-200">
                    Termo de Compromisso e Responsabilidade Civil - PEDALAÊ
                  </div>
                  <p>{settings.termText}</p>
                </div>

                {/* Terms Agreement Checkboxes */}
                <div className="mt-3 space-y-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/40 transition-colors">
                    <input
                      id="checkbox-terms"
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setTermsAccepted(checked);
                        if (checked) {
                          const sig = generateDigitalSignatureDataUrl(fullName, cpf, new Date());
                          setDigitalSignatureUrl(sig);
                        } else {
                          setDigitalSignatureUrl(null);
                        }
                      }}
                      className="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-zinc-900 border-zinc-700 cursor-pointer flex-shrink-0"
                    />
                    <span className="text-xs text-zinc-200 leading-snug">
                      <strong className="text-amber-400">Li, compreendi e concordo integralmente</strong> com todos os termos do contrato de locação e responsabilidade civil acima descritos.
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer px-3 py-1.5">
                    <input
                      id="checkbox-lgpd"
                      type="checkbox"
                      checked={lgpdAccepted}
                      onChange={(e) => setLgpdAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-zinc-900 border-zinc-700 cursor-pointer flex-shrink-0"
                    />
                    <span className="text-[11px] text-zinc-400">
                      Concordo com o armazenamento dos meus dados para fins exclusivos desta locação e futuros atendimentos no PEDALAÊ (LGPD).
                    </span>
                  </label>
                </div>

                {/* Automatic Certified Online Digital Signature Stamp */}
                {termsAccepted ? (
                  <div className="bg-zinc-950 p-4 rounded-2xl border-2 border-emerald-500/50 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <span className="text-emerald-400 font-extrabold text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ASSINATURA DIGITAL CERTIFICADA ONLINE
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">Validade Jurídica MP 2.200-2</span>
                    </div>

                    <div className="p-3 bg-black/60 rounded-xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
                          Assinatura Eletrônica do Locatário
                        </span>
                        <span className="text-lg sm:text-xl font-serif italic text-amber-300 font-bold tracking-wide block mt-0.5">
                          {fullName || 'Cliente Titular'}
                        </span>
                      </div>
                      <div className="text-left sm:text-right text-[11px] text-zinc-400 font-mono space-y-0.5">
                        <div>CPF: <span className="text-white font-bold">{cpf || 'Pendente'}</span></div>
                        <div className="text-[10px] text-emerald-400 font-semibold">
                          ✔ Aceite Eletrônico Confirmado
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-zinc-400 bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/80">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>
                        Sua assinatura online com seu nome foi validada e constará automaticamente no seu contrato e Termo de Locação em PDF.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>
                      Marque a caixa <strong>&quot;Li, compreendi e concordo com os termos&quot;</strong> acima para autenticar sua assinatura online automaticamente com seu nome.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Confirm Button */}
            <div>
              <button
                id="btn-confirm-booking-final"
                disabled={!termsAccepted || isSubmitting}
                onClick={handleFinalSubmit}
                className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all shadow-xl shadow-amber-500/25 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Processando Reserva...</span>
                ) : (
                  <>
                    <span>Confirmar com Assinatura e Gerar PIX</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 5: PAGAMENTO PIX ================= */}
        {currentStep === 5 && createdReservation && (
          <div className="space-y-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                🟡 Passo Final • Pagamento via PIX
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Como Pagar sua Reserva
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-md mx-auto">
                Copie o código PIX abaixo para pagar no app do seu banco ou aponte a câmera para o QR Code.
              </p>
            </div>

            {/* Floating Live Feedback Toast for PIX copy */}
            {pixToastMessage && (
              <div className="p-4 rounded-2xl bg-emerald-950/95 border-2 border-emerald-400 text-emerald-100 text-xs sm:text-sm font-semibold flex items-start gap-3 shadow-2xl shadow-emerald-500/20 animate-bounce-short">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-black text-emerald-300 block mb-0.5">CÓDIGO COPIADO COM SUCESSO!</span>
                  <span>{pixToastMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPixToastMessage(null)}
                  className="p-1 text-emerald-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Quick 3-Step Flow Diagram */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-zinc-900/90 border border-amber-500/40 rounded-xl p-2.5">
                <span className="text-base block">📋</span>
                <span className="font-bold text-amber-400 text-[11px] block mt-0.5">1. Copie o PIX</span>
                <span className="text-[10px] text-zinc-400">Toque no botão amarelo</span>
              </div>
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5">
                <span className="text-base block">🏦</span>
                <span className="font-bold text-white text-[11px] block mt-0.5">2. Pague no Banco</span>
                <span className="text-[10px] text-zinc-400">Pix Copia e Cola</span>
              </div>
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5">
                <span className="text-base block">📲</span>
                <span className="font-bold text-emerald-400 text-[11px] block mt-0.5">3. Envie Comprovante</span>
                <span className="text-[10px] text-zinc-400">No WhatsApp Pedalaê</span>
              </div>
            </div>

            {/* Main Payment Card */}
            <div className="bg-zinc-900 border-2 border-amber-500/50 rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xl shadow-amber-500/10">
              {/* Total Price Ribbon */}
              <div className="bg-black/80 border border-zinc-800 rounded-2xl p-4 text-center">
                <span className="text-xs text-zinc-400 uppercase tracking-widest block font-bold">
                  Valor Total a Pagar {createdReservation.groupTotalBikes && createdReservation.groupTotalBikes > 1 ? `(${createdReservation.groupTotalBikes} bikes)` : ''}
                </span>
                <div className="text-3xl sm:text-5xl font-black text-amber-400 font-mono mt-1">
                  {(createdReservation.groupTotalPrice || createdReservation.totalPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div className="text-xs text-zinc-300 mt-1">
                  Reserva: <strong className="text-white font-mono">{createdReservation.code}</strong> • {createdReservation.groupBikesSummary || createdReservation.bikeSnapshot.name}
                </div>
              </div>

              {/* Payment Mode Selector Tabs */}
              <div className="flex rounded-2xl bg-black p-1 border border-zinc-800">
                <button
                  type="button"
                  id="tab-pix-copia-cola"
                  onClick={() => setPixPaymentTab('copia-cola')}
                  className={`flex-1 py-3 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    pixPaymentTab === 'copia-cola'
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Copy className="w-4 h-4" />
                  <span>📱 Pix Copia e Cola (No Celular)</span>
                </button>
                <button
                  type="button"
                  id="tab-pix-qrcode"
                  onClick={() => setPixPaymentTab('qrcode')}
                  className={`flex-1 py-3 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    pixPaymentTab === 'qrcode'
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>📷 QR Code (Escanear)</span>
                </button>
              </div>

              {/* TAB 1: PIX COPIA E COLA (High contrast & obvious) */}
              {pixPaymentTab === 'copia-cola' && (
                <div className="space-y-4">
                  <div className="text-left space-y-1">
                    <span className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Passo 1: Copie o Código PIX
                    </span>
                    <p className="text-xs text-zinc-300">
                      Clique no botão dourado abaixo. O código Pix do valor exato de <strong>{(createdReservation.groupTotalPrice || createdReservation.totalPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> será copiado na hora!
                    </p>
                  </div>

                  {/* GIANT HIGH-CONTRAST PRIMARY COPY BUTTON */}
                  <button
                    type="button"
                    id="btn-main-copy-pix-copia-cola"
                    onClick={handleCopyPixCopiaCola}
                    className={`w-full py-5 px-5 rounded-2xl font-black text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xl active:scale-98 ${
                      copiedPixType === 'payload'
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/30 ring-4 ring-emerald-400/50'
                        : 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-110 text-black shadow-amber-500/30 ring-4 ring-amber-400/30 animate-pulse-gentle'
                    }`}
                  >
                    {copiedPixType === 'payload' ? (
                      <>
                        <CheckCheck className="w-6 h-6 stroke-[3]" />
                        <span>✅ CÓDIGO PIX COPIADO! ABRA SEU BANCO</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-6 h-6 stroke-[2.5]" />
                        <span>📋 COPIAR CÓDIGO PIX (COPIA E COLA)</span>
                      </>
                    )}
                  </button>

                  {/* Code Snippet Box */}
                  <div className="bg-black border border-zinc-800 rounded-2xl p-3.5 text-left space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="font-semibold">Código Pix Copia e Cola gerado:</span>
                      <button
                        type="button"
                        onClick={handleCopyPixCopiaCola}
                        className="text-amber-400 hover:underline font-bold"
                      >
                        {copiedPixType === 'payload' ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    <div
                      onClick={handleCopyPixCopiaCola}
                      className="font-mono text-[11px] text-zinc-300 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80 break-all cursor-pointer hover:border-amber-400 transition-colors select-all max-h-20 overflow-y-auto"
                    >
                      {pixCopiaEColaString || settings.pixKey}
                    </div>
                  </div>

                  {/* Secondary alternative: Copy key only */}
                  <div className="pt-1">
                    <button
                      type="button"
                      id="btn-copy-pix-key-fallback"
                      onClick={handleCopyPixKeyOnly}
                      className="w-full py-3 px-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-2 border border-zinc-700 transition-colors cursor-pointer"
                    >
                      <Key className="w-4 h-4 text-amber-400" />
                      <span>{copiedPixType === 'key' ? 'Chave Copiada!' : `Ou copiar apenas a Chave ${settings.pixType}: ${settings.pixKey}`}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: QR CODE VIEW */}
              {pixPaymentTab === 'qrcode' && (
                <div className="space-y-4">
                  <div className="text-left space-y-1">
                    <span className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-amber-400" />
                      Escanear QR Code com o Celular
                    </span>
                    <p className="text-xs text-zinc-300">
                      Abra o aplicativo do seu banco em outro aparelho ou tire print para escanear pelo app bancário.
                    </p>
                  </div>

                  {pixQrCodeUrl ? (
                    <div className="p-5 bg-white rounded-3xl max-w-xs mx-auto shadow-2xl flex flex-col items-center">
                      <img
                        src={pixQrCodeUrl}
                        alt="QR Code Pix"
                        className="w-56 h-56 object-contain"
                      />
                      <span className="text-black font-black text-xs mt-2 uppercase tracking-wider">
                        PEDALAÊ • {(createdReservation.groupTotalPrice || createdReservation.totalPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-zinc-400 text-xs">
                      Gerando QR Code...
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCopyPixCopiaCola}
                    className="w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Copy className="w-4 h-4 text-amber-400" />
                    <span>Preferir Copiar o Código Pix Copia e Cola</span>
                  </button>
                </div>
              )}

              {/* Beneficiary Info */}
              <div className="text-left text-xs text-zinc-400 border-t border-zinc-800 pt-3 space-y-1">
                <div className="flex justify-between">
                  <span>Beneficiário:</span>
                  <strong className="text-white">{settings.pixBeneficiary || 'PEDALAÊ LOCAÇÃO DE BIKES'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Instituição / Chave:</span>
                  <span className="text-zinc-300">{settings.pixKey} ({settings.pixType})</span>
                </div>
              </div>

              {/* STEP 2: WHATSAPP PROOF (Clear visual separation) */}
              <div className="space-y-3 pt-3 border-t-2 border-zinc-800">
                <div className="text-left space-y-1">
                  <span className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    Passo 2: Já realizou o pagamento?
                  </span>
                  <p className="text-xs text-zinc-300">
                    Clique no botão verde abaixo para abrir o WhatsApp oficial do PEDALAÊ com os dados da sua reserva prontos e envie o comprovante!
                  </p>
                </div>

                <button
                  id="btn-open-whatsapp-pix"
                  type="button"
                  onClick={openWhatsAppWithProof}
                  className="w-full py-4 sm:py-5 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-2.5 active:scale-98 transition-all shadow-xl shadow-emerald-500/25 cursor-pointer"
                >
                  <Send className="w-5 h-5 fill-white" />
                  <span>ENVIAR COMPROVANTE NO WHATSAPP</span>
                </button>

                {/* Option to view reservation voucher code */}
                <button
                  id="btn-proceed-to-confirmation"
                  type="button"
                  onClick={() => {
                    setCurrentStep(6);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full py-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Ver Comprovante e Voucher da Reserva</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 6: CONFIRMAÇÃO & QR CODE ================= */}
        {currentStep === 6 && createdReservation && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-amber-500 text-black rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                🎉 RESERVA REALIZADA!
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Guarde o código da sua reserva ou apresente o QR Code na retirada.
              </p>
            </div>

            {/* Reservation Voucher Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5">
              {/* Code Banner */}
              <div className="bg-black border border-amber-500/40 rounded-xl p-4 text-center">
                <span className="text-xs text-zinc-400 uppercase tracking-widest block">
                  Código da Reserva
                </span>
                <span className="text-2xl sm:text-3xl font-mono font-black text-amber-400 tracking-wider">
                  {createdReservation.code}
                </span>
              </div>

              {/* QR Code Presentation */}
              {qrCodeUrl && (
                <div className="flex flex-col items-center justify-center p-4 bg-zinc-950 rounded-xl border border-zinc-800/80">
                  <img
                    src={qrCodeUrl}
                    alt={`QR Code da reserva ${createdReservation.code}`}
                    className="w-40 h-40 bg-white p-2 rounded-xl shadow-md"
                  />
                  <span className="text-[11px] text-zinc-400 mt-2">
                    Apresente este QR Code no momento da retirada
                  </span>
                </div>
              )}

              {/* Key Details */}
              <div className="space-y-2 text-xs border-y border-zinc-800 py-3">
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Cliente:</span>
                  <span className="font-bold text-white">{createdReservation.customerSnapshot.fullName}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Bike(s):</span>
                  <span className="font-bold text-white text-right max-w-[65%]">
                    {createdReservation.groupBikesSummary || `${createdReservation.bikeSnapshot.name} (${createdReservation.bikeSnapshot.code})`}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Data:</span>
                  <span className="font-bold text-white">
                    {createdReservation.date.split('-').reverse().join('/')} ({WEEKDAYS_MAP.find((w) => w.targetDayIndex === getWeekdayIndexFromDateStr(createdReservation.date))?.full || ''})
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Horário:</span>
                  <span className="font-bold text-amber-400">
                    {createdReservation.startTime} às {createdReservation.endTime} ({createdReservation.durationHours}h)
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Valor Total:</span>
                  <span className="font-bold text-white font-mono">
                    {(createdReservation.groupTotalPrice || createdReservation.totalPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Status:</span>
                  {(() => {
                    const currentLive = reservations.find((r) => r.id === createdReservation.id) || createdReservation;
                    if (currentLive.status === 'pagamento_confirmado') {
                      return <span className="font-bold text-emerald-400">🟢 PAGAMENTO CONFIRMADO</span>;
                    }
                    if (currentLive.status === 'bike_em_uso' || currentLive.status === 'bike_retirada') {
                      return <span className="font-bold text-blue-400">🚲 EM ANDAMENTO</span>;
                    }
                    if (currentLive.status === 'devolvida_finalizada') {
                      return <span className="font-bold text-purple-400">🏁 DEVOLVIDA</span>;
                    }
                    if (currentLive.status === 'cancelada') {
                      return <span className="font-bold text-rose-400">🔴 CANCELADA</span>;
                    }
                    return <span className="font-bold text-amber-400">🟡 AGUARDANDO PAGAMENTO</span>;
                  })()}
                </div>
              </div>

              {/* Photo tag reminder banner for confirmed reservation */}
              <div className="bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-zinc-950 border border-pink-500/30 rounded-2xl p-4 text-left flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center flex-shrink-0 text-xl">
                  📸
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase text-pink-300 tracking-wider">
                    Tire fotos lindas pelo caminho e marque o @pedalae.parintins!
                  </h4>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Registre os melhores momentos do seu passeio na orla e praças de Parintins. Marque o nosso Instagram para publicarmos nos nossos stories e feed!
                  </p>
                  <a
                    href={settings.instagramUrl || "https://www.instagram.com/pedalae.parintins?stkn=MTl4YmZrMnM4MDhpYg=="}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-400 hover:text-pink-300 pt-1"
                  >
                    <span>Seguir @pedalae.parintins no Instagram ↗</span>
                  </a>
                </div>
              </div>

              {/* Actions Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  id="btn-copy-booking-details"
                  onClick={copyReservationCode}
                  className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>{copiedCode ? 'Código Copiado!' : 'COPIAR RESERVA'}</span>
                </button>

                <button
                  id="btn-download-pdf-client"
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={handleDownloadOrSharePDF}
                  className={`py-3 px-4 rounded-xl text-black text-xs font-black flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                    isGeneratingPdf
                      ? 'bg-amber-400/70 cursor-not-allowed opacity-80'
                      : 'bg-amber-500 hover:bg-amber-400 active:scale-95 shadow-amber-500/20'
                  }`}
                >
                  {isGeneratingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 text-black animate-spin" />
                      <span>GERANDO PDF (AGUARDE)...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 text-black" />
                      <span>BAIXAR / COMPARTILHAR PDF</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status / Notice for Mobile PDF Generation */}
              {pdfToastNotice && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2.5 animate-fade-in shadow-lg">
                  <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>{pdfToastNotice}</span>
                </div>
              )}

              {/* Instant Browser Viewer & Re-Download Fallback (100% reliable on mobile Safari, Chrome, and WebViews) */}
              {pdfReadyInfo && (
                <div className="p-4 rounded-2xl bg-zinc-900 border border-amber-500/30 space-y-3 animate-fade-in shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Termo Oficial Pronto ({createdReservation.code})
                    </span>
                    <span className="text-[10px] text-zinc-400">PDF Assinado</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <a
                      href={pdfReadyInfo.blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      <span>Abrir / Ver PDF no Navegador</span>
                    </a>

                    <button
                      type="button"
                      onClick={handleDownloadOrSharePDF}
                      disabled={isGeneratingPdf}
                      className="py-2.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Salvar / Compartilhar Novamente</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-zinc-400 text-center leading-relaxed">
                    💡 <strong>Dica para celular:</strong> Se o arquivo não baixou direto, clique em <strong>"Abrir / Ver PDF no Navegador"</strong> para visualizá-lo ou salvá-lo no seu celular.
                  </p>
                </div>
              )}

              <div className="space-y-2.5">
                {/* Pedal em Andamento Access - Available when confirmed or initiated */}
                {onStartTracking && (
                  <button
                    id="btn-open-ride-tracker"
                    onClick={() => {
                      clearBookingDraft();
                      onStartTracking(createdReservation);
                    }}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-black font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/25 active:scale-98 transition-all"
                  >
                    <span>🚲 ACOMPANHAR PEDAL EM ANDAMENTO</span>
                  </button>
                )}

                <button
                  id="btn-open-whatsapp-client-end"
                  onClick={openWhatsAppWithProof}
                  className="w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  <Send className="w-4 h-4 fill-white" />
                  <span>ABRIR WHATSAPP OFICIAL (PEDALAÊ)</span>
                </button>
              </div>

              <button
                id="btn-finish-and-back-home"
                onClick={() => {
                  clearBookingDraft();
                  onCancel();
                }}
                className="w-full text-center text-xs text-zinc-400 hover:text-white py-2"
              >
                ← Voltar para a Página Inicial
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Mobile Bottom Navigation Bar (Guarantees customers never get lost) */}
      {currentStep <= 5 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t-2 border-amber-500/40 p-3 sm:hidden shadow-2xl">
          <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
            {currentStep === 1 && (
              <>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[11px] text-zinc-300 font-bold truncate">
                    🚲 {selectedBikes.length === 1 ? selectedBikes[0].name : `${selectedBikes.length} bikes`}
                  </span>
                  <span className="text-xs font-black text-amber-400 font-mono">
                    {totalRentalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({selectedPlan.label})
                  </span>
                </div>
                <button
                  id="btn-mobile-sticky-step1-next"
                  disabled={!selectedBikes.length}
                  onClick={() => {
                    setCurrentStep(2);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-black font-black text-xs uppercase flex items-center gap-1.5 shadow-lg shadow-amber-500/30 active:scale-95 flex-shrink-0 cursor-pointer"
                >
                  <span>HORÁRIO ➔</span>
                </button>
              </>
            )}

            {currentStep === 2 && (
              <>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[11px] text-zinc-300 font-bold truncate">
                    📅 {selectedDate.split('-').reverse().join('/')}
                  </span>
                  <span className="text-xs font-black text-amber-400 font-mono">
                    Retirada às {selectedStartTime} ({selectedPlan.durationHours}h)
                  </span>
                </div>
                <button
                  id="btn-mobile-sticky-step2-next"
                  onClick={validateStep2}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-black font-black text-xs uppercase flex items-center gap-1.5 shadow-lg shadow-amber-500/30 active:scale-95 flex-shrink-0 cursor-pointer"
                >
                  <span>DADOS ➔</span>
                </button>
              </>
            )}

            {currentStep === 3 && (
              <>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[11px] text-zinc-300 font-bold truncate">
                    👤 {fullName || 'Identificação do Cliente'}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Etapa 3 de 5
                  </span>
                </div>
                <button
                  id="btn-mobile-sticky-step3-next"
                  onClick={validateStep3}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-black font-black text-xs uppercase flex items-center gap-1.5 shadow-lg shadow-amber-500/30 active:scale-95 flex-shrink-0 cursor-pointer"
                >
                  <span>RESUMO ➔</span>
                </button>
              </>
            )}

            {currentStep === 4 && (
              <>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[11px] text-zinc-300 font-bold truncate">
                    Total: {totalRentalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    {termsAccepted ? '✓ Termos aceitos' : 'Marque o termo acima'}
                  </span>
                </div>
                <button
                  id="btn-mobile-sticky-step4-next"
                  disabled={!termsAccepted || isSubmitting}
                  onClick={handleFinalSubmit}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 disabled:opacity-50 text-black font-black text-xs uppercase flex items-center gap-1.5 shadow-lg shadow-amber-500/30 active:scale-95 flex-shrink-0 cursor-pointer"
                >
                  <span>{isSubmitting ? 'Gerando...' : 'PAGAR PIX ➔'}</span>
                </button>
              </>
            )}

            {currentStep === 5 && createdReservation && (
              <>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase">
                    PIX PEDALAÊ:
                  </span>
                  <span className="text-sm font-black text-amber-400 font-mono truncate">
                    {(createdReservation.groupTotalPrice || createdReservation.totalPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="btn-mobile-sticky-copy-pix"
                    onClick={handleCopyPixCopiaCola}
                    className="py-2.5 px-3 rounded-xl bg-amber-400 text-black font-black text-xs uppercase flex items-center gap-1 shadow-lg shadow-amber-500/30 active:scale-95 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{copiedPixType === 'payload' ? '✓ COPIADO!' : 'COPIAR PIX'}</span>
                  </button>
                  <button
                    id="btn-mobile-sticky-open-wpp"
                    onClick={openWhatsAppWithProof}
                    className="py-2.5 px-3 rounded-xl bg-[#25D366] text-white font-black text-xs uppercase flex items-center gap-1 active:scale-95 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 fill-white" />
                    <span>WPP</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
