import './style.css';
import { SYSTEMS } from './data/systems';
import {
  loadCatalog,
  countBySystem,
  getAttribution,
  getPartCount,
  getActiveCatalog,
} from './data/anatomy';
import { BodyScene } from './scene/BodyScene';
import { mountUI } from './ui/AppUI';
import type { SexId, SpeciesId, SystemId } from './types';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) {
  throw new Error('#app non trovato');
}

let scene: BodyScene | null = null;
let loading = false;

const ui = mountUI(appRoot, () => scene, (mode) => {
  void switchMode(mode.species, mode.sex);
});

async function loadIntoScene(species: SpeciesId, sex: SexId): Promise<void> {
  const label =
    species === 'cane'
      ? 'Catalogo canino VT…'
      : sex === 'femmina'
        ? 'Catalogo femmina (HRA)…'
        : 'Catalogo maschio (BodyParts3D)…';
  ui.showLoading(0.02, `Caricamento ${label}`);
  await yieldFrame();

  const catalog = await loadCatalog(species, sex);
  ui.setPartCount(catalog.count, countBySystem());
  const note = catalog.notes ? ` ${catalog.notes}` : '';
  ui.setAttribution(
    `${getAttribution()}. ${catalog.count.toLocaleString('it-IT')} mesh. Licenza: ${catalog.license}.${note}`,
  );
  ui.showLoading(0.08, `Catalogo: ${getPartCount().toLocaleString('it-IT')} parti anatomiche`);
  await yieldFrame();

  ui.clearExamineUi();
  if (!scene) {
    const canvas = document.querySelector<HTMLCanvasElement>('#c');
    if (!canvas) throw new Error('Canvas non trovato');
    const systemIds = SYSTEMS.map((s) => s.id) as SystemId[];
    scene = new BodyScene(
      canvas,
      (part, x, y, opts) => ui.showDetail(part, x, y, opts),
      systemIds,
    );
    ui.applyThemeToScene();
  }

  // Reset filters UI to all checked on catalog swap
  document.querySelectorAll<HTMLInputElement>('input[data-system]').forEach((i) => {
    i.checked = true;
  });
  scene.setAllSystems(true, SYSTEMS.map((s) => s.id));
  const search = document.querySelector<HTMLInputElement>('#search');
  if (search) {
    search.value = '';
    scene.setSearch('');
  }

  await scene.loadBody(catalog, (frac, label2) => {
    ui.showLoading(Math.min(0.98, frac), label2);
  });

  scene.resize();
  ui.syncLayoutFab();
  ui.showLoading(1, 'Pronto');
  await delay(250);
  ui.hideLoading();
}

async function switchMode(species: SpeciesId, sex: SexId): Promise<void> {
  if (loading) return;
  loading = true;
  try {
    await loadIntoScene(species, sex);
  } catch (err) {
    console.error(err);
    ui.showLoading(1, `Errore: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    loading = false;
  }
}

async function boot(): Promise<void> {
  const mode = ui.getMode();
  await switchMode(mode.species, mode.sex);
  // warm unused catalogs in background (optional, quiet)
  const active = getActiveCatalog();
  void active;
}

function yieldFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

boot().catch((err) => {
  console.error(err);
  ui.showLoading(1, `Errore: ${err instanceof Error ? err.message : String(err)}`);
});
