import { Bike, CustomerData, Reservation, SystemSettings } from '../types';

export const INITIAL_SETTINGS: SystemSettings = {
  companyName: 'PEDALAÊ - ALUGUEL DE BIKES',
  slogan: 'ALUGUE. PEDALE. VIVA O MOMENTO.',
  logoUrl: '/logo.png',
  cityState: 'Parintins - AM',
  address: 'Orla de Parintins, Centro - Parintins/AM (Próximo à Praça da Catedral)',
  whatsappOfficialUrl: 'https://wa.me/5593981250207',
  whatsappDisplay: '(93) 98125-0207',
  pixKey: 'pedalae.parintins@gmail.com',
  pixType: 'E-mail',
  pixBeneficiary: 'PEDALAÊ LOCAÇÕES DE BIKES LTDA',
  openingTime: '08:00',
  closingTime: '22:00',
  slotIntervalMinutes: 60,
  blockedWeekdays: [],
  blockedDates: [],
  plans: [
    { id: 'p1', durationHours: 1, label: '1 HORA', price: 10.00 },
    { id: 'p2', durationHours: 2, label: '2 HORAS', price: 15.00, popular: true },
    { id: 'p3', durationHours: 3, label: '3 HORAS', price: 30.00 },
    { id: 'p4', durationHours: 4, label: '4 HORAS', price: 35.00 },
  ],
  termText: `TERMO DE COMPROMISSO, LOCAÇÃO E RESPONSABILIDADE CIVIL - PEDALAÊ

1. DO OBJETO
O presente termo formaliza a locação temporária de bicicleta de uso urbano/lazer disponibilizada pelo PEDALAÊ em Parintins/AM.

2. DAS CONDIÇÕES E CONSERVAÇÃO DO EQUIPAMENTO
O LOCATÁRIO declara receber a bicicleta em perfeito estado de conservação, segurança e funcionamento mecânico (freios, corrente, pneus calibrados, selim regulado), comprometendo-se a devolvê-la nas exatas condições em que a recebeu, salvo o desgaste natural decorrente do uso regular.

3. DA RESPONSABILIDADE CIVIL E CRIMINAL
O LOCATÁRIO assume total e irrestrita responsabilidade por quaisquer danos materiais causados à bicicleta durante o período de locação, incluindo quebra, perda de componentes, avarias graves e furto ou roubo do equipamento, obrigando-se a ressarcir integralmente o PEDALAÊ pelos prejuízos avaliados.
O LOCATÁRIO é o único e exclusivo responsável por infrações de trânsito, acidentes, colisões ou danos a terceiros ocorridos durante o período em que a bicicleta estiver sob sua posse.

4. DA UTILIZAÇÃO E NORMAS DE SEGURANÇA
É expressamente proibido:
a) Conduzir sob efeito de substâncias alcoólicas ou entorpecentes;
b) Transportar passageiros em número superior à capacidade da bicicleta;
c) Realizar manobras radicais ou trafegar em locais de risco evidente;
d) Sublocar ou ceder a bicicleta a terceiros não cadastrados.

5. DA RETIRADA, IDENTIFICAÇÃO E ASSINATURA FÍSICA
A entrega da bicicleta está condicionada à conferência documental com foto e CPF e à assinatura física deste Termo no ato da retirada na unidade do PEDALAÊ em Parintins/AM.`,
  cancellationPolicy: 'Cancelamentos podem ser solicitados pelo cliente com antecedência mínima de 1 hora do início da reserva. A devolução ou crédito é avaliada e autorizada pela administração do PEDALAÊ.',
  adminPasswordHash: 'admin123', // Initial seed password, customizable by administrator in settings
  adminEmail: 'sergiobruce19@gmail.com',
  instagramUrl: 'https://www.instagram.com/pedalae.parintins?stkn=MTl4YmZrMnM4MDhpYg==',
  facebookUrl: 'https://www.facebook.com/profile.php?id=61595687457272',
  tiktokUrl: 'https://www.tiktok.com/@pedalae.parintins',
};

export const INITIAL_BIKES: Bike[] = [
  {
    id: 'bike-ped-001',
    code: 'PED-001',
    name: 'BIKE 01 — LOTUS VERMELHA',
    model: 'Lotus Aro 29',
    color: 'Vermelha',
    description: 'Mais que um passeio, é uma experiência! Quadro resistente, marchas precisas, freios a disco e pneus de alta tração.',
    photoUrl: '/bike_01_lotus_vermelha_1790011655445.jpg',
    status: 'available',
    notes: 'Quadro resistente, marchas precisas, freios a disco, pneus de alta tração.',
    createdAt: Date.now(),
  },
  {
    id: 'bike-ped-002',
    code: 'PED-002',
    name: 'BIKE 02 — COLLI VERMELHA',
    model: 'Colli Aro 29',
    color: 'Vermelha',
    description: 'Mais que um passeio, é uma experiência! Quadro resistente, marchas precisas, freios a disco e pneus de alta tração.',
    photoUrl: '/bike_02_colli_vermelha_1790011674947.jpg',
    status: 'available',
    notes: 'Quadro resistente, marchas precisas, freios a disco, pneus de alta tração.',
    createdAt: Date.now(),
  },
  {
    id: 'bike-ped-003',
    code: 'PED-003',
    name: 'BIKE 03 — COLLI PRETA',
    model: 'Colli Aro 29',
    color: 'Preta',
    description: 'Mais que um passeio, é uma experiência! Quadro resistente, marchas precisas, freios a disco e pneus de alta tração.',
    photoUrl: '/bike_03_colli_preta_1790011689826.jpg',
    status: 'available',
    notes: 'Quadro resistente, marchas precisas, freios a disco, pneus de alta tração.',
    createdAt: Date.now(),
  },
  {
    id: 'bike-ped-004',
    code: 'PED-004',
    name: 'BIKE 04 — COLLI VERDE',
    model: 'Colli Aro 29',
    color: 'Verde',
    description: 'Mais que um passeio, é uma experiência! Quadro resistente, marchas precisas, freios a disco e pneus de alta tração.',
    photoUrl: '/bike_04_colli_verde_1790011712793.jpg',
    status: 'available',
    notes: 'Quadro resistente, marchas precisas, freios a disco, pneus de alta tração.',
    createdAt: Date.now(),
  },
];

export const INITIAL_SAMPLE_CLIENTS: CustomerData[] = [
  {
    id: 'cli-001',
    fullName: 'Sergio Bruce',
    cpf: '554.336.182-34',
    cpfClean: '55433618234',
    whatsapp: '(93) 98125-0207',
    email: 'sergiobruce19@gmail.com',
    fullAddress: 'Av. Amazonas, Centro, Parintins - AM (Próximo à Praça da Catedral)',
    birthDate: '1995-06-15',
    totalReservations: 2,
    lastReservationAt: Date.now() - 3600000,
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 3600000,
  },
  {
    id: 'cli-002',
    fullName: 'Maria Eduarda Santos',
    cpf: '782.441.902-15',
    cpfClean: '78244190215',
    whatsapp: '(92) 99182-3344',
    email: 'maria.eduarda@gmail.com',
    fullAddress: 'Rua Vieira de Melo, 140, Centro, Parintins - AM',
    birthDate: '1998-11-20',
    totalReservations: 1,
    lastReservationAt: Date.now() - 7200000,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 7200000,
  },
  {
    id: 'cli-003',
    fullName: 'João Paulo Faria',
    cpf: '612.983.472-88',
    cpfClean: '61298347288',
    whatsapp: '(92) 99451-2299',
    email: 'joao.faria@hotmail.com',
    fullAddress: 'Bairro Palmares, Parintins - AM',
    birthDate: '1992-03-08',
    totalReservations: 1,
    lastReservationAt: Date.now() - 14400000,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 14400000,
  },
];

export const INITIAL_SAMPLE_RESERVATIONS: Reservation[] = [
  {
    id: 'res-seed-001',
    code: 'PED-000001',
    bikeId: 'bike-ped-001',
    bikeSnapshot: {
      code: 'PED-001',
      name: 'BIKE 01 — LOTUS VERMELHA',
      model: 'Lotus Aro 29',
      color: 'Vermelha',
      photoUrl: '/bike_01_lotus_vermelha_1790011655445.jpg',
    },
    customerId: 'cli-001',
    customerSnapshot: INITIAL_SAMPLE_CLIENTS[0],
    date: new Date().toISOString().split('T')[0],
    startTime: '16:00',
    endTime: '18:00',
    durationHours: 2,
    totalPrice: 15.00,
    pixKey: 'pedalae.parintins@gmail.com',
    status: 'pagamento_confirmado',
    termAgreedOnline: true,
    termAgreedAt: Date.now() - 3600000,
    paymentConfirmedAt: Date.now() - 3000000,
    paymentConfirmedBy: 'Admin Pedalaê',
    digitalSignerName: 'Sergio Bruce',
    digitalSignerCpf: '554.336.182-34',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3000000,
  },
  {
    id: 'res-seed-002',
    code: 'PED-000002',
    bikeId: 'bike-ped-002',
    bikeSnapshot: {
      code: 'PED-002',
      name: 'BIKE 02 — COLLI VERMELHA',
      model: 'Colli Aro 29',
      color: 'Vermelha',
      photoUrl: '/bike_02_colli_vermelha_1790011674947.jpg',
    },
    customerId: 'cli-002',
    customerSnapshot: INITIAL_SAMPLE_CLIENTS[1],
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '11:00',
    durationHours: 2,
    totalPrice: 15.00,
    pixKey: 'pedalae.parintins@gmail.com',
    status: 'devolvida_finalizada',
    termAgreedOnline: true,
    termAgreedAt: Date.now() - 28800000,
    paymentConfirmedAt: Date.now() - 28000000,
    paymentConfirmedBy: 'Admin Pedalaê',
    digitalSignerName: 'Maria Eduarda Santos',
    digitalSignerCpf: '782.441.902-15',
    createdAt: Date.now() - 28800000,
    updatedAt: Date.now() - 21600000,
  },
  {
    id: 'res-seed-003',
    code: 'PED-000003',
    bikeId: 'bike-ped-003',
    bikeSnapshot: {
      code: 'PED-003',
      name: 'BIKE 03 — COLLI PRETA',
      model: 'Colli Aro 29',
      color: 'Preta',
      photoUrl: '/bike_03_colli_preta_1790011689826.jpg',
    },
    customerId: 'cli-003',
    customerSnapshot: INITIAL_SAMPLE_CLIENTS[2],
    date: new Date().toISOString().split('T')[0],
    startTime: '18:00',
    endTime: '19:00',
    durationHours: 1,
    totalPrice: 10.00,
    pixKey: 'pedalae.parintins@gmail.com',
    status: 'aguardando_pagamento',
    termAgreedOnline: true,
    termAgreedAt: Date.now() - 1800000,
    digitalSignerName: 'João Paulo Faria',
    digitalSignerCpf: '612.983.472-88',
    createdAt: Date.now() - 1800000,
    updatedAt: Date.now() - 1800000,
  },
];

