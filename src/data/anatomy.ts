import type { AnatomyCatalog, AnatomyPart, SexId, SpeciesId, SystemId } from '../types';

const catalogCache = new Map<string, AnatomyCatalog>();
const partsCache = new Map<string, AnatomyPart[]>();

let activeKey = 'uomo-maschio';
let catalog: AnatomyCatalog | null = null;
let partsList: AnatomyPart[] | null = null;

export function catalogKey(species: SpeciesId, sex: SexId): string {
  if (species === 'cane') return 'cane';
  return sex === 'femmina' ? 'uomo-femmina' : 'uomo-maschio';
}

export function catalogUrlFor(species: SpeciesId, sex: SexId): string {
  const base = import.meta.env.BASE_URL;
  if (species === 'cane') return `${base}models/canine/catalog.json`;
  if (sex === 'femmina') return `${base}models/female/catalog.json`;
  return `${base}models/bp3d/catalog.json`;
}

function mapParts(cat: AnatomyCatalog): AnatomyPart[] {
  return cat.parts.map((p) => ({
    id: p.id,
    nome: p.nome,
    sistema: p.sistema,
    descrizione: p.descrizione,
    latino: p.latino || p.en,
    en: p.en,
    bp: p.bp,
    fma: p.fma,
  }));
}

export async function loadCatalog(
  species: SpeciesId = 'uomo',
  sex: SexId = 'maschio',
): Promise<AnatomyCatalog> {
  const key = catalogKey(species, sex);
  const cached = catalogCache.get(key);
  if (cached) {
    activeKey = key;
    catalog = cached;
    partsList = partsCache.get(key) ?? mapParts(cached);
    return cached;
  }

  const url = catalogUrlFor(species, sex);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Impossibile caricare catalogo (${url})`);
  const data = (await res.json()) as AnatomyCatalog;
  // Always derive baseUrl from the catalog fetch URL so GitHub Pages subdirectory works
  // (catalog JSON may contain absolute "/models/..." paths).
  data.baseUrl = url.replace(/\/catalog\.json$/, '');
  catalogCache.set(key, data);
  const parts = mapParts(data);
  partsCache.set(key, parts);
  activeKey = key;
  catalog = data;
  partsList = parts;
  return data;
}

export function getParts(): AnatomyPart[] {
  if (!partsList) throw new Error('Catalogo non ancora caricato');
  return partsList;
}

export function getPartCount(): number {
  return catalog?.count ?? 0;
}

export function countBySystem(): Record<SystemId, number> {
  const counts = (catalog?.countsBySystem ?? {}) as Partial<Record<SystemId, number>>;
  return {
    scheletrico: counts.scheletrico ?? 0,
    muscolare: counts.muscolare ?? 0,
    circolatorio: counts.circolatorio ?? 0,
    nervoso: counts.nervoso ?? 0,
    respiratorio: counts.respiratorio ?? 0,
    digestivo: counts.digestivo ?? 0,
    urinario: counts.urinario ?? 0,
    linfatico: counts.linfatico ?? 0,
    tegumentario: counts.tegumentario ?? 0,
    organi: counts.organi ?? 0,
  };
}

export function getAttribution(): string {
  return (
    catalog?.attribution ??
    'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan'
  );
}

export function getActiveCatalog(): AnatomyCatalog | null {
  return catalog;
}

export function getActiveKey(): string {
  return activeKey;
}
