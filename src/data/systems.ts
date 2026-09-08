import type { SystemId, SystemInfo } from '../types';

export const SYSTEMS: SystemInfo[] = [
  {
    id: 'scheletrico',
    nome: 'Scheletrico',
    colore: 0xe8e0d0,
    descrizione: 'Ossa e cartilagini di supporto strutturale',
  },
  {
    id: 'muscolare',
    nome: 'Muscolare',
    colore: 0xa83a3a,
    descrizione: 'Muscoli scheletrici, tendini e fascie',
  },
  {
    id: 'circolatorio',
    nome: 'Circolatorio',
    colore: 0xc62828,
    descrizione: 'Cuore, arterie e vene',
  },
  {
    id: 'nervoso',
    nome: 'Nervoso',
    colore: 0xe8d48b,
    descrizione: 'Cervello, midollo, nervi e strutture sensoriali',
  },
  {
    id: 'respiratorio',
    nome: 'Respiratorio',
    colore: 0x7eb8da,
    descrizione: 'Vie aeree e albero bronchiale',
  },
  {
    id: 'digestivo',
    nome: 'Digestivo',
    colore: 0xc49a6c,
    descrizione: 'Tratto digerente, denti e annessi',
  },
  {
    id: 'urinario',
    nome: 'Urinario / riproduttivo',
    colore: 0x8ecae6,
    descrizione: 'Reni, vie urinarie e apparato riproduttivo',
  },
  {
    id: 'linfatico',
    nome: 'Linfatico',
    colore: 0x9b5de5,
    descrizione: 'Vasi e linfonodi',
  },
  {
    id: 'tegumentario',
    nome: 'Tegumentario',
    colore: 0xd4a574,
    descrizione: 'Cute e annessi cutanei',
  },
  {
    id: 'organi',
    nome: 'Organi / ghiandole',
    colore: 0x2a9d8f,
    descrizione: 'Organi solidi e ghiandole endocrine',
  },
];

export const SYSTEM_MAP: Record<SystemId, SystemInfo> = Object.fromEntries(
  SYSTEMS.map((s) => [s.id, s]),
) as Record<SystemId, SystemInfo>;
