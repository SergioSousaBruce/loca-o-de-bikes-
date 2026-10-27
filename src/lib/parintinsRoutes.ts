// Official Sightseeing and Leisure Bike Routes in Parintins - AM
import { LatLng } from './geoUtils';

export interface PedalaeRoute {
  id: string;
  name: string;
  tagline: string;
  description: string;
  distanceKm: number;
  estimatedMinutes: number;
  difficulty: 'Fácil' | 'Moderado' | 'Completo';
  elevation: string;
  color: string;
  pointsOfInterest: string[];
  imageUrl: string;
  waypoints: LatLng[];
}

export const PARINTINS_ROUTES: PedalaeRoute[] = [
  {
    id: 'rota-orla',
    name: '🌅 ROTA ORLA DO RIO AMAZONAS',
    tagline: 'O pôr do sol mais bonito da Amazônia à beira-rio',
    description:
      'Percurso plano e arejado acompanhando a margem do Rio Amazonas. Passa pelo Porto de Parintins, Mercado Municipal e Praça do Cristo Redentor.',
    distanceKm: 6.0,
    estimatedMinutes: 30,
    difficulty: 'Fácil',
    elevation: 'Plano (100% asfalto/calçadão)',
    color: '#F59E0B', // Amber
    pointsOfInterest: [
      'Ponto Pedalaê (Praça da Catedral)',
      'Orla da Francesa',
      'Mercado Municipal de Parintins',
      'Porto Hidroviário',
      'Mirante do Rio Amazonas',
    ],
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
    waypoints: [
      { lat: -2.628854, lng: -56.732890 },
      { lat: -2.627200, lng: -56.734500 },
      { lat: -2.625500, lng: -56.737000 },
      { lat: -2.623100, lng: -56.741000 },
      { lat: -2.624800, lng: -56.743200 },
    ],
  },
  {
    id: 'rota-centro-historico',
    name: '🏛️ ROTA DO CENTRO HISTÓRICO & CATEDRAL',
    tagline: 'Principais marcos históricos e arquitetônicos de Parintins',
    description:
      'Passeio tranquilo pelo centro histórico, passando pela Catedral de Nossa Senhora do Carmo, praças e atrativos urbanos.',
    distanceKm: 8.0,
    estimatedMinutes: 40,
    difficulty: 'Fácil',
    elevation: 'Plano com leve aclive',
    color: '#3B82F6', // Blue
    pointsOfInterest: [
      'Catedral de Nossa Senhora do Carmo',
      'Praça da Catedral',
      'Centro Histórico',
      'Orla da Cidade',
    ],
    imageUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=800&q=80',
    waypoints: [
      { lat: -2.628854, lng: -56.732890 },
      { lat: -2.632100, lng: -56.735000 },
      { lat: -2.635800, lng: -56.739200 },
      { lat: -2.638500, lng: -56.736400 },
      { lat: -2.633000, lng: -56.731500 },
    ],
  },
  {
    id: 'rota-macurany',
    name: '🌿 ROTA LAGO MACURANY & NATUREZA',
    tagline: 'Imersão natural com brisa fresca e águas tranquilas',
    description:
      'Rota completa de longa distância para quem busca aventura e contato direto com as belezas naturais e lagos preservados da Ilha Tupinambarana.',
    distanceKm: 15.0,
    estimatedMinutes: 80,
    difficulty: 'Completo',
    elevation: 'Trechos planos e pequenas subidas arborizadas',
    color: '#10B981', // Emerald
    pointsOfInterest: [
      'Orla da Cidade',
      'Comunidade Macurany',
      'Balneário do Cantagalo',
      'Praia do Macurany',
      'Ponto Pedalaê',
    ],
    imageUrl: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=800&q=80',
    waypoints: [
      { lat: -2.628854, lng: -56.732890 },
      { lat: -2.634000, lng: -56.728000 },
      { lat: -2.641000, lng: -56.721000 },
      { lat: -2.648000, lng: -56.715000 },
      { lat: -2.642000, lng: -56.724000 },
      { lat: -2.628854, lng: -56.732890 },
    ],
  },
];
