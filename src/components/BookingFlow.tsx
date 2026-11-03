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
  downloadOrShareReservationPDF 
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

// Order requested by user:
// 1 = Cadastro / Identificação (novo cliente se cadastra primeiro; cliente existente busca por CPF/WhatsApp)
// 2 = Valor das Horas (escolher plano de horas: 1h, 2h, etc.)
// 3 = Dias da Semana (segunda, terça, quarta, quinta, sexta, sábado, domingo)
// 4 = Horário para Retirada da Bike
// 5 = Escolher as Opções das Bikes Disponíveis (passo final da escolha)
// 6 = PIX para pagar e enviar no WhatsApp para confirmação do proprietário
// 7 = Voucher & Confirmação Final
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
      const raw = localStorage.getItem('pedalae_booking_draft_v2');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  })();

  // Customer Information (Step 1)
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
      return `🎉 Olá, ${initialCustomer.fullName}! Seus dados foram carregados com sucesso.`;
    }
    return null;
  });

  // Mode: 'new' (cadastro novo) ou 'returning' (buscar por CPF/WhatsApp)
  const [customerLookupMode, setCustomerLookupMode] = useState<'new' | 'returning'>(() => {
    if (initialCustomer?.cpf || (savedBookingDraft?.cpf && savedBookingDraft?.fullName)) {
      return 'returning';
    }
    return 'new';
  });
  const [lookupQuery, setLookupQuery] = useState<string>('');
  const [lookupNotFound, setLookupNotFound] = useState<boolean>(false);
  const [isEditingData, setIsEditingData] = useState<boolean>(false);

  // Determine starting step:
  // If customer is already identified (has fullName, cpf, whatsapp), can start at Step 2 (Horas), but keep step 1 accessible
  const [currentStep, setCurrentStep] = useState<Step>(() => {
    if (savedBookingDraft?.currentStep && savedBookingDraft.currentStep >= 1 && savedBookingDraft.currentStep <= 7) {
      return savedBookingDraft.currentStep as Step;
    }
    if (initialCustomer?.fullName && initialCustomer?.cpf) {
      return 2; // already identified, go directly to Hours
    }
    return 1; // new customer starts with registration
  });

  // Rental Plan / Hours (Step 2)
  const [selectedPlan, setSelectedPlan] = useState<RentalPlan>(() => {
    if (initialPlan) return initialPlan;
    if (savedBookingDraft?.selectedPlanId) {
      const foundPlan = settings.plans.find((p) => p.id === savedBookingDraft.selectedPlanId);
      if (foundPlan) return foundPlan;
    }
    // Default to the first plan in settings
    return settings.plans[0] || { id: 'p1', durationHours: 1, label: '1 HORA', price: 10.00 };
  });

  useEffect(() => {
    if (initialPlan) {
      setSelectedPlan(initialPlan);
    }
  }, [initialPlan]);

  // Date selection helper & Weekdays (Step 3)
  const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString(new Date());

  const WEEKDAYS_MAP = [
    { targetDayIndex: 1, key: 'segunda', label: 'Segunda', short: 'SEG', full: 'Segunda-feira' },
    { targetDayIndex: 2, key: 'terca', label: 'Terça', short: 'TER', full: 'Terça-feira' },
    { targetDayIndex: 3, key: 'quarta', label: 'Quarta', short: 'QUA', full: 'Quarta-feira' },
    { targetDayIndex: 4, key: 'quinta', label: 'Quinta', short: 'QUI', full: 'Quinta-feira' },
    { targetDayIndex: 5, key: 'sexta', label: 'Sexta', short: 'SEX', full: 'Sexta-feira' },
    { targetDayIndex: 6, key: 'sabado', label: 'Sábado', short: 'SÁB', full: 'Sábado' },
    { targetDayIndex: 0, key: 'domingo', label: 'Domingo', short: 'DOM', full: 'Domingo' },
  ];

  const getNextDateForWeekday = (targetDayIndex: number): string => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDay = base.getDay();
    let diff = targetDayIndex - currentDay;
    if (diff < 0) {
      diff += 7;
    }
    const resultDate = new Date(base.getTime() + diff * 24 * 60 * 60 * 1000);
    return getLocalDateString(resultDate);
  };

  const getWeekdayIndexFromDateStr = (dateStr: string): number => {
    if (!dateStr) return -1;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return -1;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.getDay();
  };

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return savedBookingDraft?.selectedDate || todayStr;
  });
  const selectedWeekdayIndex = getWeekdayIndexFromDateStr(selectedDate);

  // Time Slot for Pickup (Step 4)
  const [selectedStartTime, setSelectedStartTime] = useState<string>(() => {
    return savedBookingDraft?.selectedStartTime || settings.openingTime || '17:00';
  });

  // Calculate return time based on start time and plan duration
  const calculateEndTime = (start: string, hours: number): string => {
    const startMins = timeToMinutes(start);
    const endMins = startMins + hours * 60;
    return minutesToTime(endMins);
  };

  const calculatedEndTime = calculateEndTime(selectedStartTime, selectedPlan.durationHours);

  // Bikes Selection (Step 5 - Final choice step)
  const [bikeRentalMode, setBikeRentalMode] = useState<'single' | 'group'>('single');
  const [selectedBikes, setSelectedBikes] = useState<Bike[]>(() => {
    if (initialBike) return [initialBike];
    if (savedBookingDraft?.selectedBikeIds && Array.isArray(savedBookingDraft.selectedBikeIds)) {
      const found = bikes.filter((b) => savedBookingDraft.selectedBikeIds.includes(b.id));
      if (found.length > 0) return found;
    }
    // Default: choose first available bike
    const firstAvailable = bikes.find((b) => b.status === 'available') || bikes[0];
    return firstAvailable ? [firstAvailable] : [];
  });

  const selectedBike = selectedBikes[0] || null;
  const totalRentalPrice = (selectedPlan?.price || 0) * (selectedBikes.length || 1);

  // Terms & Signature (in Step 5)
  const [termsAccepted, setTermsAccepted] = useState<boolean>(() => !!savedBookingDraft?.termsAccepted);
  const [lgpdAccepted, setLgpdAccepted] = useState<boolean>(true);
  const [digitalSignatureUrl, setDigitalSignatureUrl] = useState<string | null>(null);

  // Payment & Reservation State (Step 6)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdReservation, setCreatedReservation] = useState<Reservation | null>(() => {
    return savedBookingDraft?.createdReservation || null;
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [pixPaymentTab, setPixPaymentTab] = useState<'copia-cola' | 'qrcode'>('copia-cola');
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState<string>('');
  const [copiedPixType, setCopiedPixType] = useState<'payload' | 'key' | null>(null);
  const [pixToastMessage, setPixToastMessage] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  // PDF & Voucher Generation
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfToastNotice, setPdfToastNotice] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate PIX Copia e Cola EMV payload (BR Code)
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

  // Generate PIX QR Code image
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

  // Save progress draft to localStorage
  useEffect(() => {
    try {
      const draft = {
        currentStep,
        fullName,
        cpf,
        birthDate,
        whatsapp,
        email,
        fullAddress,
        photoBase64,
        selectedPlanId: selectedPlan?.id,
        selectedDate,
        selectedStartTime,
        selectedBikeIds: selectedBikes.map((b) => b.id),
        termsAccepted,
        createdReservation,
      };
      localStorage.setItem('pedalae_booking_draft_v2', JSON.stringify(draft));
    } catch {}
  }, [
    currentStep,
    fullName,
    cpf,
    birthDate,
    whatsapp,
    email,
    fullAddress,
    photoBase64,
    selectedPlan,
    selectedDate,
    selectedStartTime,
    selectedBikes,
    termsAccepted,
    createdReservation,
  ]);

  const clearBookingDraft = () => {
    try {
      localStorage.removeItem('pedalae_booking_draft_v2');
      localStorage.removeItem('pedalae_booking_draft');
    } catch {}
  };

  const triggerError = (msg: string) => {
    setFormError(msg);
    window.scrollTo({ top: 80, behavior: 'smooth' });
  };

  // Mask CPF input
  const handleCpfChange = async (val: string) => {
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

    // Auto-check if returning client
    if (digits.length === 11) {
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
          setClientFoundMessage(`🎉 Cadastro localizado! Olá, ${found.fullName}!`);
        }
      } catch (err) {
        console.warn('Auto search cpf error:', err);
      }
    }
  };

  // Perform lookup for existing client by CPF or Phone
  const handlePerformLookup = async () => {
    const query = lookupQuery.trim();
    if (!query) {
      triggerError('Digite seu CPF ou número de WhatsApp para buscar.');
      return;
    }
    setSearchingClient(true);
    setLookupNotFound(false);
    setFormError(null);

    try {
      const found = await findClientByCpfOrPhone(query);
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
        setClientFoundMessage(`🎉 Cadastro localizado! Bem-vindo(a) de volta, ${found.fullName}!`);
        setLookupNotFound(false);
        setIsEditingData(false);
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

  // Photo handlers (Camera / Gallery Upload)
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
      console.warn('Camera access error:', err);
      triggerError('Não foi possível abrir a câmera. Você pode anexar uma foto da galeria.');
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
        triggerError('Erro ao capturar foto. Selecione uma foto da galeria.');
      } finally {
        setIsCompressingPhoto(false);
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
    } catch (err) {
      console.error('File photo error:', err);
      triggerError('Não foi possível carregar a imagem. Verifique o formato ou tente outra foto.');
    } finally {
      setIsCompressingPhoto(false);
      e.target.value = '';
    }
  };

  // Step 1 validation (Registration)
  const validateStep1 = () => {
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
    const cleanPhone = whatsapp.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      triggerError('Por favor, informe um número de WhatsApp válido com DDD (ex: 92 99195-2127).');
      return;
    }
    if (!fullAddress.trim()) {
      triggerError('Por favor, informe seu endereço ou bairro em Parintins.');
      return;
    }
    if (!photoBase64) {
      triggerError('A foto do cliente é obrigatória para segurança e contrato de locação. Tire uma selfie ou anexe da galeria.');
      return;
    }

    // Save client info to DB right away
    saveOrUpdateClient({
      fullName: fullName.trim(),
      cpf: cpf.trim(),
      birthDate: birthDate.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim(),
      fullAddress: fullAddress.trim(),
      photoBase64,
    }).catch((e) => console.warn('Silent save client error:', e));

    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 2 validation (Hours / Plan)
  const validateStep2 = () => {
    setFormError(null);
    if (!selectedPlan) {
      triggerError('Selecione uma opção de horas para continuar.');
      return;
    }
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 3 validation (Day of the Week)
  const validateStep3 = () => {
    setFormError(null);
    if (!selectedDate) {
      triggerError('Selecione o dia do passeio para continuar.');
      return;
    }
    setCurrentStep(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Generate time slots for Step 4
  const getSlots = () => {
    const openMins = timeToMinutes(settings.openingTime || '17:00');
    const closeMins = timeToMinutes(settings.closingTime || '23:00');
    const interval = settings.slotIntervalMinutes || 30;
    const slots: string[] = [];

    for (let m = openMins; m + selectedPlan.durationHours * 60 <= closeMins; m += interval) {
      slots.push(minutesToTime(m));
    }
    return slots;
  };

  // Step 4 validation (Pickup Time)
  const validateStep4 = () => {
    setFormError(null);
    if (!selectedStartTime) {
      triggerError('Selecione o horário em que você virá retirar a bicicleta.');
      return;
    }
    setCurrentStep(5);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Check if a specific bike is available for the chosen date & slot
  const isBikeAvailableForSlot = (bike: Bike): boolean => {
    if (bike.status === 'maintenance' || bike.status === 'inactive') return false;

    // Check conflict in reservations
    const startM = timeToMinutes(selectedStartTime);
    const endM = timeToMinutes(calculatedEndTime);

    for (const res of reservations) {
      if (res.bikeId === bike.id && res.date === selectedDate && res.status !== 'cancelada' && res.status !== 'devolvida_finalizada') {
        const rStart = timeToMinutes(res.startTime);
        const rEnd = timeToMinutes(res.endTime);
        if (startM < rEnd && endM > rStart) {
          return false;
        }
      }
    }
    return true;
  };

  // Bike selection toggle
  const handleToggleBike = (bike: Bike) => {
    setFormError(null);
    if (bikeRentalMode === 'single') {
      setSelectedBikes([bike]);
    } else {
      const already = selectedBikes.some((b) => b.id === bike.id);
      if (already) {
        if (selectedBikes.length <= 1) {
          triggerError('Ao menos uma bicicleta deve permanecer selecionada.');
          return;
        }
        setSelectedBikes(selectedBikes.filter((b) => b.id !== bike.id));
      } else {
        setSelectedBikes([...selectedBikes, bike]);
      }
    }
  };

  // Step 5: Final submit -> Creates reservation & advances to Step 6 (PIX)
  const handleFinalSubmit = async () => {
    setFormError(null);
    if (!selectedBikes.length) {
      triggerError('Selecione uma das bicicletas disponíveis para continuar.');
      return;
    }
    if (!termsAccepted) {
      triggerError('Por favor, marque a caixa aceitando os termos de responsabilidade do PEDALAÊ.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Re-validate conflict immediately before creating reservation
      for (const bike of selectedBikes) {
        const { conflict, conflictingReservation } = await checkReservationConflict(
          bike.id,
          selectedDate,
          selectedStartTime,
          calculatedEndTime
        );

        if (conflict && conflictingReservation) {
          triggerError(
            `Ops! A bike "${bike.name}" acabou de ser reservada para este horário (${conflictingReservation.startTime} às ${conflictingReservation.endTime}). Escolha outra bike disponível.`
          );
          setIsSubmitting(false);
          return;
        }
      }

      // Save customer record
      const customerPayload: CustomerData = {
        fullName: fullName.trim(),
        cpf: cpf.trim(),
        birthDate: birthDate.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        fullAddress: fullAddress.trim(),
        photoBase64,
      };
      const customerId = await saveOrUpdateClient(customerPayload);

      // Generate digital signature
      const sigUrl = generateDigitalSignatureDataUrl(fullName, cpf, new Date());
      setDigitalSignatureUrl(sigUrl);

      // Create reservation(s)
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
          digitalSignatureUrl: sigUrl,
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
        createdList.push({ ...newReservation, id: docId });
      }

      const primaryReservation = createdList[0];

      // Generate QR Code data url for reservation
      try {
        const qr = await QRCode.toDataURL(primaryReservation.code, {
          margin: 1,
          width: 180,
          color: { dark: '#000000', light: '#ffffff' },
        });
        setQrCodeUrl(qr);
      } catch (err) {
        console.warn('QR code gen error:', err);
      }

      setCreatedReservation(primaryReservation);
      setCurrentStep(6);
      onFinished(primaryReservation);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error(err);
      triggerError(err.message || 'Erro ao processar reserva. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // PIX copy helpers
  const handleCopyPixCopiaCola = async () => {
    const code = pixCopiaEColaString || settings.pixKey;
    const ok = await copyToClipboardSafe(code);
    if (ok) {
      setCopiedPixType('payload');
      setPixToastMessage('🎉 Código Pix Copia e Cola copiado! Abra o aplicativo do seu banco (Nubank, Caixa, Inter, etc.) e cole na opção "Pix Copia e Cola".');
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

  // WhatsApp official confirmation trigger
  const openWhatsAppWithProof = () => {
    if (!createdReservation) return;
    const url = getWhatsAppReservationUrl(createdReservation, settings.whatsappDisplay);
    window.open(url, '_blank');
  };

  // PDF Generator for confirmation
  const handleDownloadPDF = async () => {
    if (!createdReservation || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfToastNotice(null);
    try {
      const result = await downloadOrShareReservationPDF(createdReservation, settings);
      if (result.method === 'share') {
        setPdfToastNotice('📱 Compartilhamento aberto no celular!');
      } else {
        setPdfToastNotice('📄 Download do comprovante PDF concluído!');
      }
      setTimeout(() => setPdfToastNotice(null), 8000);
    } catch (err) {
      console.error('PDF error:', err);
      triggerError('Não foi possível gerar o PDF agora. Envie seu comprovante pelo WhatsApp.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const stepsList = [
    { num: 1, label: '1. Cadastro' },
    { num: 2, label: '2. Horas' },
    { num: 3, label: '3. Dia' },
    { num: 4, label: '4. Horário' },
    { num: 5, label: '5. Bike' },
    { num: 6, label: '6. PIX & WhatsApp' },
  ];

  return (
    <div className="min-h-screen bg-black text-white py-6 px-4 sm:px-6 pb-28">
      <div className="max-w-2xl mx-auto">
        {/* Navigation & Stepper Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <button
              id="btn-booking-back"
              onClick={() => {
                if (currentStep > 1 && currentStep <= 5) {
                  setCurrentStep((prev) => (prev - 1) as Step);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  if (currentStep === 1 || currentStep >= 6) {
                    clearBookingDraft();
                  }
                  onCancel();
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 px-3.5 py-2 rounded-xl border border-zinc-800 transition-colors cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-amber-400" />
              <span>{currentStep === 1 || currentStep >= 6 ? 'Voltar ao Início' : 'Voltar Etapa'}</span>
            </button>

            <span className="text-xs font-black text-amber-400 uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
              Passo {Math.min(currentStep, 6)} de 6
            </span>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
            {stepsList.map((s) => {
              const isActive = currentStep === s.num;
              const isPast = currentStep > s.num;
              const isClickable = s.num < currentStep && s.num <= 5;
              return (
                <button
                  type="button"
                  key={s.num}
                  disabled={!isClickable}
                  onClick={() => {
                    if (isClickable) {
                      setCurrentStep(s.num as Step);
                      setFormError(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  className={`flex flex-col items-center group transition-all ${
                    isClickable ? 'cursor-pointer' : 'cursor-default opacity-85'
                  }`}
                >
                  <div
                    className={`h-2.5 w-full rounded-full transition-all duration-300 ${
                      isActive
                        ? 'bg-amber-400 ring-2 ring-amber-400/50 shadow-md shadow-amber-500/30'
                        : isPast
                        ? 'bg-amber-500'
                        : 'bg-zinc-800'
                    }`}
                  />
                  <span
                    className={`text-[10px] mt-1 font-bold truncate text-center ${
                      isActive
                        ? 'text-amber-400 font-black'
                        : isPast
                        ? 'text-zinc-200'
                        : 'text-zinc-600'
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Form Error Banner */}
          {formError && (
            <div className="mt-4 p-3.5 rounded-2xl bg-rose-950/90 border border-rose-500/70 text-rose-200 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-xl">
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

        {/* ============================================================== */}
        {/* PASSO 1: CADASTRO / IDENTIFICAÇÃO DO CLIENTE                  */}
        {/* ============================================================== */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                Passo 1 de 6 • Identificação do Cliente
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Seus Dados para o Aluguel
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-md mx-auto">
                Se você é um cliente novo, preencha seus dados abaixo. Se já pedalou antes, localize seu cadastro em 1 segundo!
              </p>
            </div>

            {/* Quick Switch: New Client vs Returning Client */}
            <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800 max-w-sm mx-auto shadow-inner">
              <button
                type="button"
                id="btn-tab-new-client"
                onClick={() => {
                  setCustomerLookupMode('new');
                  setFormError(null);
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  customerLookupMode === 'new'
                    ? 'bg-amber-500 text-black shadow-md font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Sou Novo Cliente</span>
              </button>

              <button
                type="button"
                id="btn-tab-returning-client"
                onClick={() => {
                  setCustomerLookupMode('returning');
                  setFormError(null);
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  customerLookupMode === 'returning'
                    ? 'bg-amber-500 text-black shadow-md font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Já Tenho Cadastro</span>
              </button>
            </div>

            {/* RETURNING CLIENT LOOKUP BOX */}
            {customerLookupMode === 'returning' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Search className="w-4 h-4 text-amber-400" />
                  <span>Localizar Cadastro Salvo</span>
                </div>
                <p className="text-xs text-zinc-300">
                  Digite seu <strong>CPF</strong> ou seu número de <strong>WhatsApp com DDD</strong> para carregar seus dados salvos:
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    id="input-lookup-client"
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
                    placeholder="Digite seu CPF ou WhatsApp..."
                    className="flex-grow bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handlePerformLookup}
                    disabled={searchingClient}
                    className="py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    {searchingClient ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Buscar</span>
                      </>
                    )}
                  </button>
                </div>

                {lookupNotFound && (
                  <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span>Não encontramos cadastro com esses dados.</span>
                      <button
                        type="button"
                        onClick={() => setCustomerLookupMode('new')}
                        className="block mt-1 text-amber-400 underline font-bold"
                      >
                        Clique aqui para fazer seu cadastro rápido em 1 minuto.
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RETURNING CLIENT FOUND CARD */}
            {clientFoundMessage && fullName && (
              <div className="bg-emerald-950/40 border-2 border-emerald-500/60 rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {photoBase64 ? (
                      <img
                        src={photoBase64}
                        alt={fullName}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-400 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xl flex-shrink-0">
                        {fullName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider bg-emerald-500/20 px-2 py-0.5 rounded-full">
                        Cadastro Localizado
                      </span>
                      <h4 className="text-base sm:text-lg font-black text-white mt-1">
                        {fullName}
                      </h4>
                      <p className="text-xs text-zinc-300 font-mono">
                        CPF: {cpf} • Zap: {whatsapp}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingData(!isEditingData)}
                    className="text-xs text-amber-400 hover:text-amber-300 underline font-bold"
                  >
                    {isEditingData ? 'Fechar edição' : 'Editar dados'}
                  </button>
                </div>

                {!isEditingData && (
                  <button
                    type="button"
                    id="btn-step1-continue-identified"
                    onClick={validateStep1}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-green-500 text-black font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 hover:brightness-110 active:scale-98 transition-all cursor-pointer"
                  >
                    <span>Continuar para Escolher as Horas</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </button>
                )}
              </div>
            )}

            {/* NEW REGISTRATION FORM (or editing) */}
            {(customerLookupMode === 'new' || isEditingData || (!clientFoundMessage && customerLookupMode === 'returning')) && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl">
                <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                  <User className="w-5 h-5 text-amber-400" />
                  <h3 className="font-black text-white text-base">
                    Dados Pessoais do Cliente
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* Nome Completo */}
                  <div>
                    <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      id="input-customer-fullname"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ex: João da Silva Souza"
                      className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* CPF e WhatsApp */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                        CPF (11 dígitos) *
                      </label>
                      <input
                        type="text"
                        id="input-customer-cpf"
                        value={cpf}
                        onChange={(e) => handleCpfChange(e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                        WhatsApp com DDD *
                      </label>
                      <input
                        type="text"
                        id="input-customer-whatsapp"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="(92) 99195-2127"
                        className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>
                  </div>

                  {/* Data de Nascimento e Bairro / Endereço */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                        Data de Nascimento (Opcional)
                      </label>
                      <input
                        type="date"
                        id="input-customer-birthdate"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                        Endereço / Bairro em Parintins *
                      </label>
                      <input
                        type="text"
                        id="input-customer-address"
                        value={fullAddress}
                        onChange={(e) => setFullAddress(e.target.value)}
                        placeholder="Ex: Centro, Itaúna, Palmares..."
                        className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Foto / Selfie do Cliente (Essencial para contrato e conferência) */}
                  <div className="pt-2">
                    <label className="text-xs font-bold text-zinc-300 block mb-1.5 flex items-center justify-between">
                      <span>Foto do Cliente (Selfie ou Documento) *</span>
                      <span className="text-[11px] text-amber-400">Segurança da Locação</span>
                    </label>

                    {photoBase64 ? (
                      <div className="flex items-center gap-4 bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800">
                        <img
                          src={photoBase64}
                          alt="Foto do cliente"
                          className="w-20 h-20 rounded-xl object-cover border-2 border-emerald-400"
                        />
                        <div className="space-y-1.5 flex-1">
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                            <Check className="w-4 h-4 stroke-[3]" />
                            Foto anexada com sucesso
                          </span>
                          <button
                            type="button"
                            onClick={() => setPhotoBase64('')}
                            className="text-xs text-rose-400 hover:text-rose-300 underline block"
                          >
                            Trocar ou tirar outra foto
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {isCameraActive ? (
                          <div className="bg-black border border-amber-500/40 rounded-2xl p-4 text-center space-y-3">
                            <video
                              ref={videoRef}
                              playsInline
                              autoPlay
                              className="w-full max-w-xs mx-auto rounded-xl border border-zinc-700 aspect-video object-cover"
                            />
                            <canvas ref={canvasRef} className="hidden" />
                            <div className="flex gap-2 justify-center">
                              <button
                                type="button"
                                onClick={capturePhoto}
                                className="py-2.5 px-4 rounded-xl bg-amber-500 text-black font-black text-xs uppercase"
                              >
                                📸 Capturar Foto Agora
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsCameraActive(false)}
                                className="py-2.5 px-4 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={startCamera}
                              className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-700 hover:border-amber-400 text-zinc-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                            >
                              <Camera className="w-4 h-4 text-amber-400" />
                              <span>Tirar Foto com a Câmera</span>
                            </button>

                            <label className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-700 hover:border-amber-400 text-zinc-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors text-center">
                              <Upload className="w-4 h-4 text-amber-400" />
                              <span>Escolher Foto da Galeria</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="hidden"
                              />
                            </label>
                          </div>
                        )}
                        {isCompressingPhoto && (
                          <p className="text-xs text-amber-400 animate-pulse text-center">
                            Otimizando foto para carregamento rápido...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Avançar para Passo 2 */}
                <div className="pt-4 border-t border-zinc-800">
                  <button
                    id="btn-step1-next"
                    type="button"
                    onClick={validateStep1}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:brightness-110 text-black font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 active:scale-98 transition-all cursor-pointer"
                  >
                    <span>Continuar para Escolher as Horas</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* PASSO 2: ESCOLHER O VALOR DAS HORAS (PLANO / DURAÇÃO)          */}
        {/* ============================================================== */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                Passo 2 de 6 • Duração do Aluguel
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Escolha o Valor das Horas
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-md mx-auto">
                Selecione por quantas horas você deseja pedalar. O valor do passeio é calculado na hora!
              </p>
            </div>

            {/* Identified Customer Ribbon */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                  ✓
                </div>
                <div className="text-left">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Cliente:</span>
                  <span className="text-xs font-black text-white">{fullName}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
              >
                Alterar
              </button>
            </div>

            {/* Mode: Single Bike vs Multiple Bikes */}
            <div className="bg-zinc-900 border border-zinc-800 p-1.5 rounded-2xl flex items-center gap-1 max-w-md mx-auto">
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
                <span>Alugar 1 Bike (Individual)</span>
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

            {/* Large Plans Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {settings.plans.map((plan) => {
                const isSelected = selectedPlan.id === plan.id;
                const calculatedPrice = plan.price * (selectedBikes.length || 1);

                return (
                  <div
                    key={plan.id}
                    id={`plan-card-${plan.id}`}
                    onClick={() => {
                      setSelectedPlan(plan);
                      setFormError(null);
                    }}
                    className={`relative rounded-3xl p-5 sm:p-6 border-2 transition-all flex flex-col justify-between cursor-pointer select-none ${
                      isSelected
                        ? 'bg-gradient-to-br from-amber-500/20 via-zinc-900 to-zinc-950 border-amber-400 ring-2 ring-amber-400/50 shadow-xl shadow-amber-500/20 scale-[1.02]'
                        : 'bg-zinc-900/90 border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-800/90'
                    }`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-3 left-6 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-black shadow-md">
                        Mais Escolhido
                      </span>
                    )}

                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-black uppercase text-amber-400 tracking-wider">
                          Duração
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                          {plan.label}
                        </h3>
                        <p className="text-xs text-zinc-300 mt-1">
                          {plan.description || `${plan.durationHours} hora${plan.durationHours > 1 ? 's' : ''} de pedal livre pela orla`}
                        </p>
                      </div>

                      <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isSelected
                          ? 'bg-amber-400 border-amber-400 text-black'
                          : 'border-zinc-700 text-transparent'
                      }`}>
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-zinc-800/80 flex items-baseline justify-between">
                      <span className="text-xs text-zinc-400 font-medium">Valor:</span>
                      <div className="text-right">
                        <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                          {calculatedPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        {selectedBikes.length > 1 && (
                          <span className="text-[10px] text-zinc-400 block font-mono">
                            ({selectedBikes.length} bikes x {plan.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Next Button */}
            <div className="pt-3">
              <button
                id="btn-step2-next"
                type="button"
                onClick={validateStep2}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:brightness-110 text-black font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 active:scale-98 transition-all cursor-pointer"
              >
                <span>Avançar para Escolher o Dia</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASSO 3: ESCOLHER O DIA DA SEMANA                              */}
        {/* ============================================================== */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                Passo 3 de 6 • Dia da Semana
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Escolha o Dia para Pedalar
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-md mx-auto">
                Selecione o dia da semana desejado (Segunda a Domingo) para o seu passeio.
              </p>
            </div>

            {/* Summary Ribbon of Step 1 & 2 */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 flex items-center justify-between text-xs">
              <div>
                <span className="text-zinc-400">Plano Selecionado:</span>
                <span className="font-black text-white ml-1.5">{selectedPlan.label} ({selectedPlan.durationHours}h)</span>
              </div>
              <div className="text-right">
                <span className="text-zinc-400">Total:</span>
                <span className="font-black text-amber-400 font-mono ml-1.5">
                  {totalRentalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>

            {/* 7 Days of Week Interactive Buttons (Segunda a Domingo) */}
            <div className="space-y-3">
              <label className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-amber-400" />
                Dias da Semana Disponíveis:
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
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
                        setFormError(null);
                      }}
                      className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all cursor-pointer text-center select-none active:scale-95 ${
                        isSelected
                          ? 'bg-amber-500 border-amber-400 text-black shadow-xl shadow-amber-500/30 scale-[1.03] font-black z-10'
                          : 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:border-amber-500/50 hover:bg-zinc-800'
                      }`}
                    >
                      {isToday && (
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full mb-1.5 ${
                            isSelected ? 'bg-black text-amber-400' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          HOJE
                        </span>
                      )}
                      <span className={`text-sm sm:text-base font-black block ${isSelected ? 'text-black' : 'text-white'}`}>
                        {w.label}
                      </span>
                      <span className={`text-xs mt-1 font-mono font-bold ${isSelected ? 'text-black/90' : 'text-zinc-400'}`}>
                        {formattedDayMonth}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Direct Calendar Picker Alternative */}
            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Data exata selecionada:</span>
                <strong className="text-amber-400 font-mono text-sm">
                  {selectedDate.split('-').reverse().join('/')} ({WEEKDAYS_MAP.find((w) => w.targetDayIndex === selectedWeekdayIndex)?.full || ''})
                </strong>
              </div>
              <input
                id="input-booking-date"
                type="date"
                min={todayStr}
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setFormError(null);
                }}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-amber-400 text-xs"
              />
            </div>

            {/* Next Button */}
            <div className="pt-2">
              <button
                id="btn-step3-next"
                type="button"
                onClick={validateStep3}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:brightness-110 text-black font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 active:scale-98 transition-all cursor-pointer"
              >
                <span>Avançar para o Horário de Retirada</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASSO 4: ESCOLHER O HORÁRIO PARA A RETIRADA DA BIKE            */}
        {/* ============================================================== */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                Passo 4 de 6 • Horário de Retirada
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Que Horas você vai Buscar a Bike?
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-md mx-auto">
                Selecione o horário em que você virá retirar sua bicicleta no ponto do PEDALAÊ.
              </p>
            </div>

            {/* Selected Day & Plan Preview */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 flex items-center justify-between text-xs">
              <div>
                <span className="text-zinc-400">Dia escolhido:</span>
                <span className="font-black text-white ml-1.5">
                  {selectedDate.split('-').reverse().join('/')} ({WEEKDAYS_MAP.find((w) => w.targetDayIndex === selectedWeekdayIndex)?.label || ''})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
              >
                Mudar Dia
              </button>
            </div>

            {/* Time Slot Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Horários de Retirada:
                </label>
                <span className="text-[11px] text-zinc-400">
                  Funcionamento: {settings.openingTime} às {settings.closingTime}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {getSlots().map((slotTime) => {
                  const isSelected = selectedStartTime === slotTime;
                  return (
                    <button
                      key={slotTime}
                      type="button"
                      id={`btn-slot-${slotTime.replace(':', '-')}`}
                      onClick={() => setSelectedStartTime(slotTime)}
                      className={`p-3.5 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center select-none active:scale-95 ${
                        isSelected
                          ? 'bg-amber-500 text-black border-amber-400 font-black shadow-lg shadow-amber-500/20 scale-[1.03]'
                          : 'bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:border-amber-500/50 hover:bg-zinc-800'
                      }`}
                    >
                      <span className="text-base sm:text-lg font-black">{slotTime}</span>
                      <span className={`text-[10px] mt-0.5 font-bold ${isSelected ? 'text-black/80' : 'text-emerald-400'}`}>
                        🟢 Retirar
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Direct minute input if customer wants custom minute */}
              <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-zinc-300 block">Outro minuto exato de retirada:</span>
                  <span className="text-[11px] text-zinc-500">Ex: 17:15, 18:45, 19:20...</span>
                </div>
                <input
                  type="time"
                  value={selectedStartTime}
                  onChange={(e) => setSelectedStartTime(e.target.value)}
                  className="bg-black border border-zinc-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-amber-400 w-28 text-center"
                />
              </div>
            </div>

            {/* Calculated Interval Banner */}
            <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-4 flex items-center justify-between text-xs">
              <div>
                <span className="text-zinc-400 font-medium">Horário de Retirada:</span>
                <div className="text-amber-300 font-black text-lg mt-0.5">
                  {selectedStartTime}
                </div>
              </div>
              <div className="text-right">
                <span className="text-zinc-400 font-medium">Devolução Prevista:</span>
                <div className="text-white font-black text-lg mt-0.5">
                  {calculatedEndTime} ({selectedPlan.durationHours}h de pedal)
                </div>
              </div>
            </div>

            {/* Next Button */}
            <div className="pt-2">
              <button
                id="btn-step4-next"
                type="button"
                onClick={validateStep4}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:brightness-110 text-black font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 active:scale-98 transition-all cursor-pointer"
              >
                <span>Avançar para Escolher a Bike Disponível</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASSO 5: ESCOLHER AS OPÇÕES DAS BIKES DISPONÍVEIS (PASSO FINAL) */}
        {/* ============================================================== */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                Passo 5 de 6 • Passo Final da Escolha
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Escolha a sua Bicicleta
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-md mx-auto">
                Estas são as bicicletas disponíveis no dia e horário escolhidos ({selectedStartTime} às {calculatedEndTime}). Toque para escolher a sua!
              </p>
            </div>

            {/* Schedule & Price Recap */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-zinc-400">📅 Dia e Horário:</span>
                <span className="font-black text-white ml-1.5">
                  {selectedDate.split('-').reverse().join('/')} das {selectedStartTime} às {calculatedEndTime}
                </span>
              </div>
              <div>
                <span className="text-zinc-400">💰 Valor:</span>
                <strong className="text-amber-400 font-mono font-black ml-1.5 text-sm">
                  {totalRentalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </div>
            </div>

            {/* Available Bikes Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-amber-400 tracking-wider">
                  Bicicletas no Ponto Pedalaê:
                </span>
                <span className="text-xs text-zinc-400">
                  {bikes.filter(isBikeAvailableForSlot).length} disponíveis agora
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {bikes.map((bike) => {
                  const isAvailable = isBikeAvailableForSlot(bike);
                  const isSelected = selectedBikes.some((b) => b.id === bike.id);

                  return (
                    <div
                      key={bike.id}
                      id={`bike-card-${bike.id}`}
                      onClick={() => {
                        if (isAvailable) {
                          handleToggleBike(bike);
                        }
                      }}
                      className={`relative rounded-3xl p-4 border-2 transition-all flex flex-col justify-between gap-3 select-none cursor-pointer ${
                        !isAvailable
                          ? 'opacity-40 bg-zinc-950 border-zinc-800 cursor-not-allowed'
                          : isSelected
                          ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/50 shadow-xl shadow-amber-500/20'
                          : 'bg-zinc-900/90 border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex gap-3.5">
                        <div className="relative w-24 h-28 rounded-2xl overflow-hidden bg-black flex-shrink-0 border border-zinc-800">
                          <img
                            src={bike.photoUrl}
                            alt={bike.name}
                            className="w-full h-full object-cover object-center"
                          />
                          <span className="absolute bottom-1 left-1 bg-black/90 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-amber-400">
                            {bike.code}
                          </span>
                        </div>

                        <div className="flex flex-col justify-between flex-grow min-w-0">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase text-amber-400">
                                Cor: {bike.color}
                              </span>
                              {isSelected && (
                                <span className="inline-flex items-center gap-1 bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  ESCOLHIDA
                                </span>
                              )}
                            </div>

                            <h4 className="font-black text-white text-sm sm:text-base leading-snug mt-1 truncate">
                              {bike.name}
                            </h4>
                            <span className="text-xs text-zinc-300 font-medium block truncate">
                              {bike.model}
                            </span>

                            <div className="flex flex-wrap gap-1 mt-2 text-[10px] text-zinc-400">
                              <span className="bg-black/60 px-1.5 py-0.5 rounded border border-zinc-800">
                                Aro 29
                              </span>
                              <span className="bg-black/60 px-1.5 py-0.5 rounded border border-zinc-800">
                                Freio a disco
                              </span>
                            </div>
                          </div>

                          <div className="mt-2">
                            {isAvailable ? (
                              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                🟢 Livre para este horário
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-rose-400">
                                🔴 Ocupada neste horário
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isAvailable) {
                            handleToggleBike(bike);
                          }
                        }}
                        disabled={!isAvailable}
                        className={`w-full py-2.5 px-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                            : isAvailable
                            ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                            : 'bg-zinc-950 text-zinc-600 border border-zinc-900 cursor-not-allowed'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>✓ Bicicleta Selecionada</span>
                          </>
                        ) : isAvailable ? (
                          <>
                            <span>🚲 Escolher esta Bike</span>
                          </>
                        ) : (
                          <span>Indisponível no Horário</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Terms of Service Checkbox */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="checkbox-accept-terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-zinc-700 text-amber-500 focus:ring-amber-400 cursor-pointer accent-amber-500"
                />
                <div className="text-xs text-zinc-300 leading-relaxed">
                  <span className="font-bold text-white block">
                    Termo de Compromisso e Responsabilidade do PEDALAÊ *
                  </span>
                  Declaro que receberei a bicicleta em perfeito estado de uso e conservação, comprometendo-me a utilizá-la com zelo, respeitar as normas de trânsito em Parintins e devolvê-la no horário acordado.
                </div>
              </label>
            </div>

            {/* Submit Button -> Moves to PIX Step */}
            <div className="pt-2">
              <button
                id="btn-confirm-and-pay-pix"
                type="button"
                disabled={isSubmitting || !selectedBikes.length || !termsAccepted}
                onClick={handleFinalSubmit}
                className="w-full py-4 sm:py-5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:brightness-110 disabled:opacity-50 text-black font-black text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-2xl shadow-amber-500/30 active:scale-98 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processando Reserva...</span>
                  </>
                ) : (
                  <>
                    <span>Confirmar Reserva e Gerar PIX</span>
                    <ArrowRight className="w-5 h-5 stroke-[3]" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASSO 6: PAGAMENTO PIX & WHATSAPP PARA CONFIRMAR DO PROPRIETÁRIO */}
        {/* ============================================================== */}
        {currentStep === 6 && createdReservation && (
          <div className="space-y-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                Passo 6 de 6 • Pagamento & WhatsApp
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Pagamento via PIX
              </h2>
              <p className="text-xs sm:text-sm text-zinc-300 mt-1 max-w-md mx-auto">
                Copie o PIX abaixo para pagar no app do seu banco e clique no botão verde para enviar o comprovante no WhatsApp do Pedalaê para eu confirmar sua reserva!
              </p>
            </div>

            {/* PIX Copy Toast Feedback */}
            {pixToastMessage && (
              <div className="p-4 rounded-2xl bg-emerald-950/95 border-2 border-emerald-400 text-emerald-100 text-xs sm:text-sm font-semibold flex items-start gap-3 shadow-2xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-black text-emerald-300 block mb-0.5">PIX COPIADO!</span>
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

            {/* Main PIX Card */}
            <div className="bg-zinc-900 border-2 border-amber-500/60 rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xl shadow-amber-500/15">
              {/* Total Price Banner */}
              <div className="bg-black/90 border border-zinc-800 rounded-2xl p-4 text-center">
                <span className="text-xs text-zinc-400 uppercase tracking-widest block font-bold">
                  Valor Total do Aluguel
                </span>
                <div className="text-3xl sm:text-5xl font-black text-amber-400 font-mono mt-1">
                  {(createdReservation.groupTotalPrice || createdReservation.totalPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div className="text-xs text-zinc-300 mt-1">
                  Código da Reserva: <strong className="text-white font-mono">{createdReservation.code}</strong> • {createdReservation.groupBikesSummary || createdReservation.bikeSnapshot.name}
                </div>
              </div>

              {/* PIX Mode Tabs: Copia e Cola vs QR Code */}
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

              {/* PIX Copia e Cola Tab */}
              {pixPaymentTab === 'copia-cola' && (
                <div className="space-y-4">
                  {/* GIANT COPY BUTTON */}
                  <button
                    type="button"
                    id="btn-copy-pix-copia-cola"
                    onClick={handleCopyPixCopiaCola}
                    className={`w-full py-5 px-5 rounded-2xl font-black text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xl active:scale-98 ${
                      copiedPixType === 'payload'
                        ? 'bg-emerald-500 text-black shadow-emerald-500/30 ring-4 ring-emerald-400/50'
                        : 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-110 text-black shadow-amber-500/30'
                    }`}
                  >
                    {copiedPixType === 'payload' ? (
                      <>
                        <CheckCheck className="w-6 h-6 stroke-[3]" />
                        <span>✅ CÓDIGO PIX COPIADO COM SUCESSO!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-6 h-6 stroke-[2.5]" />
                        <span>📋 COPIAR CÓDIGO PIX (COPIA E COLA)</span>
                      </>
                    )}
                  </button>

                  {/* Snippet box */}
                  <div className="bg-black border border-zinc-800 rounded-2xl p-3.5 text-left space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="font-semibold">Código Pix Copia e Cola:</span>
                      <button
                        type="button"
                        onClick={handleCopyPixCopiaCola}
                        className="text-amber-400 hover:underline font-bold"
                      >
                        Copiar
                      </button>
                    </div>
                    <div
                      onClick={handleCopyPixCopiaCola}
                      className="font-mono text-[11px] text-zinc-300 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80 break-all cursor-pointer hover:border-amber-400 transition-colors select-all max-h-20 overflow-y-auto"
                    >
                      {pixCopiaEColaString || settings.pixKey}
                    </div>
                  </div>

                  {/* Copy Pix Key Only fallback */}
                  <button
                    type="button"
                    onClick={handleCopyPixKeyOnly}
                    className="w-full py-3 px-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-2 border border-zinc-700 transition-colors cursor-pointer"
                  >
                    <Key className="w-4 h-4 text-amber-400" />
                    <span>{copiedPixType === 'key' ? 'Chave Copiada!' : `Ou copiar apenas a Chave ${settings.pixType}: ${settings.pixKey}`}</span>
                  </button>
                </div>
              )}

              {/* QR Code Tab */}
              {pixPaymentTab === 'qrcode' && (
                <div className="space-y-4">
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
                  <span>Chave Pix Oficial:</span>
                  <span className="text-zinc-300 font-mono">{settings.pixKey} ({settings.pixType})</span>
                </div>
              </div>

              {/* ========================================================= */}
              {/* WHATSAPP CONFIRMATION BUTTON (REQUESTED BY USER)           */}
              {/* ========================================================= */}
              <div className="space-y-3 pt-4 border-t-2 border-zinc-800">
                <div className="text-left space-y-1">
                  <span className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    Enviar Comprovante para o WhatsApp do Pedalaê:
                  </span>
                  <p className="text-xs text-zinc-300">
                    Depois de fazer o Pix no seu banco, clique no botão verde abaixo. A mensagem com os dados da sua bike e reserva já vai pronta para você só apertar enviar!
                  </p>
                </div>

                {/* GIANT GREEN WHATSAPP BUTTON */}
                <button
                  id="btn-send-whatsapp-proof"
                  type="button"
                  onClick={openWhatsAppWithProof}
                  className="w-full py-5 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-2.5 active:scale-98 transition-all shadow-2xl shadow-emerald-500/30 cursor-pointer"
                >
                  <Send className="w-5 h-5 fill-white" />
                  <span>ENVIAR COMPROVANTE NO WHATSAPP PARA CONFIRMAR</span>
                </button>

                {/* Secondary Action: View Voucher & QR Code */}
                <button
                  type="button"
                  id="btn-view-voucher"
                  onClick={() => {
                    setCurrentStep(7);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>Ver Comprovante e Voucher da Reserva</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASSO 7: VOUCHER DA RESERVA & CONFIRMAÇÃO FINAL               */}
        {/* ============================================================== */}
        {currentStep === 7 && createdReservation && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-500 text-black rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/30">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                🎉 RESERVA CONCLUÍDA!
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Apresente o código ou QR Code no Ponto Pedalaê na hora de retirar sua bike.
              </p>
            </div>

            {/* Voucher Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-5">
              <div className="bg-black border border-amber-500/40 rounded-2xl p-4 text-center">
                <span className="text-xs text-zinc-400 uppercase tracking-widest block">
                  Código da Reserva
                </span>
                <span className="text-2xl sm:text-3xl font-mono font-black text-amber-400 tracking-wider">
                  {createdReservation.code}
                </span>
              </div>

              {qrCodeUrl && (
                <div className="flex flex-col items-center justify-center p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <img
                    src={qrCodeUrl}
                    alt={`QR Code ${createdReservation.code}`}
                    className="w-40 h-40 bg-white p-2 rounded-xl shadow-md"
                  />
                  <span className="text-[11px] text-zinc-400 mt-2">
                    Apresente este QR Code no momento da retirada
                  </span>
                </div>
              )}

              {/* Details table */}
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
                    {createdReservation.date.split('-').reverse().join('/')}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Horário:</span>
                  <span className="font-bold text-amber-400">
                    {createdReservation.startTime} às {createdReservation.endTime} ({createdReservation.durationHours}h)
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Total:</span>
                  <span className="font-bold text-white font-mono">
                    {(createdReservation.groupTotalPrice || createdReservation.totalPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>

              {/* WhatsApp Action */}
              <button
                type="button"
                onClick={openWhatsAppWithProof}
                className="w-full py-4 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <Send className="w-4 h-4 fill-white" />
                <span>Conversar no WhatsApp com o Pedalaê</span>
              </button>

              {/* Download PDF button */}
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase flex items-center justify-center gap-2 cursor-pointer"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>Baixar Comprovante em PDF</span>
                  </>
                )}
              </button>
              {pdfToastNotice && (
                <p className="text-xs text-center text-emerald-400 font-semibold">{pdfToastNotice}</p>
              )}

              {/* Back to Home button */}
              <button
                type="button"
                onClick={() => {
                  clearBookingDraft();
                  onCancel();
                }}
                className="w-full py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold"
              >
                Voltar à Página Inicial
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
