import { SYSTEMS } from '../data/systems';
import type { AnatomyPart, SexId, SpeciesId, SystemId } from '../types';
import type { BodyScene, ExamineMode, UiTheme } from '../scene/BodyScene';

const THEME_KEY = 'corpo-umano-theme';
const SPECIES_KEY = 'corpo-umano-species';
const SEX_KEY = 'corpo-umano-sex';

export type ModeChange = { species: SpeciesId; sex: SexId };

function readStoredTheme(): UiTheme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

function readStoredSpecies(): SpeciesId {
  try {
    const v = localStorage.getItem(SPECIES_KEY);
    if (v === 'uomo' || v === 'cane') return v;
  } catch {
    /* ignore */
  }
  return 'uomo';
}

function readStoredSex(): SexId {
  try {
    const v = localStorage.getItem(SEX_KEY);
    if (v === 'maschio' || v === 'femmina') return v;
  } catch {
    /* ignore */
  }
  return 'maschio';
}

function applyDomTheme(theme: UiTheme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function titlesFor(species: SpeciesId, sex: SexId): { h1: string; subtitle: string; hud: string } {
  if (species === 'cane') {
    return {
      h1: 'Corpo Canino',
      subtitle: 'Explorer Anatomico 3D — VT Virtual Animal Project',
      hud: 'Corpo Canino — VT Anatomy',
    };
  }
  if (sex === 'femmina') {
    return {
      h1: 'Corpo Umano',
      subtitle: 'Femmina — HRA / BodyParts3D (mesh reali)',
      hud: 'Corpo Umano — Femmina (HRA)',
    };
  }
  return {
    h1: 'Corpo Umano',
    subtitle: 'Maschio — BodyParts3D (mesh reali)',
    hud: 'Corpo Umano — Maschio (BodyParts3D)',
  };
}

export function mountUI(
  root: HTMLElement,
  getScene: () => BodyScene | null,
  onModeChange: (mode: ModeChange) => void,
): {
  showLoading: (pct: number, msg: string) => void;
  hideLoading: () => void;
  showDetail: (
    part: AnatomyPart | null,
    x: number,
    y: number,
    opts?: { selected?: boolean },
  ) => void;
  clearExamineUi: () => void;
  setPartCount: (n: number, counts: Record<string, number>) => void;
  setAttribution: (text: string) => void;
  applyThemeToScene: () => void;
  getMode: () => ModeChange;
  setTitles: (species: SpeciesId, sex: SexId) => void;
  setSexControlsEnabled: (enabled: boolean) => void;
  syncLayoutFab: () => void;
} {
  let theme = readStoredTheme();
  let species = readStoredSpecies();
  let sex = readStoredSex();
  if (species === 'cane') sex = 'maschio';
  applyDomTheme(theme);
  const initialTitles = titlesFor(species, sex);

  root.innerHTML = `
    <div class="app">
      <aside class="panel panel-left" id="filter-panel">
        <div class="panel-scroll">
        <div class="panel-header">
          <h1 id="title-h1">${initialTitles.h1}</h1>
          <p class="subtitle" id="title-sub">${initialTitles.subtitle}</p>
          <div class="part-badge" id="part-count-badge">… parti</div>
        </div>

        <div class="mode-row" role="group" aria-label="Specie">
          <span class="theme-label">Specie</span>
          <div class="theme-toggle" id="species-toggle">
            <button type="button" id="species-uomo" aria-pressed="${species === 'uomo'}">Uomo</button>
            <button type="button" id="species-cane" aria-pressed="${species === 'cane'}">Cane</button>
          </div>
        </div>

        <div class="mode-row" role="group" aria-label="Sesso" id="sex-row">
          <span class="theme-label">Sesso</span>
          <div class="theme-toggle" id="sex-toggle">
            <button type="button" id="sex-maschio" aria-pressed="${sex === 'maschio'}">Maschio</button>
            <button type="button" id="sex-femmina" aria-pressed="${sex === 'femmina'}">Femmina</button>
          </div>
        </div>

        <div class="theme-row" role="group" aria-label="Tema">
          <span class="theme-label">Tema</span>
          <div class="theme-toggle">
            <button type="button" id="theme-light" aria-pressed="${theme === 'light'}">Chiaro</button>
            <button type="button" id="theme-dark" aria-pressed="${theme === 'dark'}">Scuro</button>
          </div>
        </div>

        <div class="search-wrap">
          <input type="search" id="search" placeholder="Cerca parte, latino, inglese…" autocomplete="off" />
        </div>

        <div class="sys-actions">
          <button type="button" class="btn ghost" id="btn-all">Tutti</button>
          <button type="button" class="btn ghost" id="btn-none">Nessuno</button>
        </div>

        <div class="systems" id="systems">
          ${SYSTEMS.map(
            (s) => `
            <label class="sys-row" data-id="${s.id}">
              <input type="checkbox" checked data-system="${s.id}" />
              <span class="swatch" style="background:#${s.colore.toString(16).padStart(6, '0')}"></span>
              <span class="sys-name">${s.nome}</span>
              <span class="sys-count" data-count-for="${s.id}">0</span>
            </label>`,
          ).join('')}
        </div>
        </div><!-- /.panel-scroll -->

        <details class="credits-acc">
          <summary>Crediti / Fonti</summary>
          <div class="credits-body">
            <p id="attrib" class="credits-active">Mesh: BodyParts3D (DBCLS) — CC BY-SA 2.1 JP.</p>
            <ul class="credits-list">
              <li><strong>Maschio</strong> — BodyParts3D / DBCLS, CC BY-SA 2.1 JP</li>
              <li><strong>Femmina</strong> — Human Reference Atlas (HuBMAP) CC BY 4.0 + BodyParts3D; cute full-body non inclusa per ora</li>
              <li><strong>Cane</strong> — Virginia Tech Virtual Animal Project (ARIES), CC BY-NC-SA 4.0</li>
            </ul>
            <p class="credits-note">Qualità scientifica anatomica; non shader fotorealistici da videogioco.</p>
          </div>
        </details>
      </aside>

      <button type="button" class="drawer-toggle" id="drawer-toggle" aria-label="Filtri">
        <span></span><span></span><span></span>
      </button>
      <div class="drawer-backdrop" id="drawer-backdrop"></div>

      <main class="viewport">
        <canvas id="c"></canvas>
        <div class="hud-title" id="hud-title">${initialTitles.hud}</div>
        <div class="hint">Trascina per orbitare · Scroll/pinch per zoom · Tocca una parte · Esamina</div>
      </main>

      <div class="fab-stack" id="fab-stack" aria-label="Azioni organi">
        <button type="button" class="btn primary" id="btn-layout-toggle"
          data-mode="rest"
          aria-pressed="false"
          title="Allinea le parti visibili in una griglia invisibile">Allinea in griglia</button>
      </div>

      <div class="detail-card" id="detail" hidden>
        <div class="detail-top">
          <div class="detail-sys" id="detail-sys"></div>
          <button type="button" class="btn ghost detail-exit" id="btn-detail-exit" hidden title="Chiudi selezione">Esci</button>
        </div>
        <h2 id="detail-nome"></h2>
        <p class="detail-latino" id="detail-latino"></p>
        <p class="detail-desc" id="detail-desc"></p>
        <button type="button" class="btn primary detail-esamina" id="btn-esamina" hidden>
          Esamina
        </button>
      </div>

      <div class="examine-panel examine-compact" id="examine-panel" hidden>
        <button type="button" class="examine-handle" id="examine-handle" aria-label="Tocca per espandere i dettagli" aria-expanded="false">
          <span class="examine-handle-bar" aria-hidden="true"></span>
          <span class="examine-handle-label" id="examine-handle-label">
            <span class="examine-handle-chevron" aria-hidden="true">▾</span>
            Dettagli
          </span>
        </button>
        <div class="examine-top">
          <div class="examine-sys" id="examine-sys"></div>
          <button type="button" class="btn ghost examine-exit" id="btn-examine-exit" title="Esci da Esamina">Esci</button>
        </div>
        <h2 id="examine-nome"></h2>
        <p class="detail-latino" id="examine-latino"></p>
        <div class="examine-toggle" role="group" aria-label="Modalità Esamina">
          <button type="button" id="examine-nel-corpo" aria-pressed="true">Nel corpo</button>
          <button type="button" id="examine-solo" aria-pressed="false">Solo questo</button>
        </div>
        <div class="examine-body" id="examine-body">
          <p class="detail-desc" id="examine-desc"></p>
          <div class="examine-related" id="examine-related" hidden>
            <div class="examine-related-label">Organi collegati</div>
            <div class="examine-related-list" id="examine-related-list"></div>
          </div>
        </div>
      </div>

      <div class="loader" id="loader">
        <div class="loader-inner">
          <div class="loader-ring"></div>
          <p id="loader-msg">Preparazione del corpo…</p>
          <div class="loader-bar"><div class="loader-fill" id="loader-fill"></div></div>
        </div>
      </div>
    </div>
  `;

  const panel = root.querySelector('#filter-panel') as HTMLElement;
  const toggle = root.querySelector('#drawer-toggle') as HTMLButtonElement;
  const backdrop = root.querySelector('#drawer-backdrop') as HTMLElement;
  const detail = root.querySelector('#detail') as HTMLElement;
  const loader = root.querySelector('#loader') as HTMLElement;
  const loaderMsg = root.querySelector('#loader-msg') as HTMLElement;
  const loaderFill = root.querySelector('#loader-fill') as HTMLElement;
  const btnLight = root.querySelector('#theme-light') as HTMLButtonElement;
  const btnDark = root.querySelector('#theme-dark') as HTMLButtonElement;
  const sexRow = root.querySelector('#sex-row') as HTMLElement;

  const syncThemeButtons = () => {
    btnLight.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    btnDark.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  };

  const setTheme = (next: UiTheme) => {
    theme = next;
    applyDomTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
    syncThemeButtons();
    getScene()?.setTheme(theme);
  };

  btnLight.addEventListener('click', () => setTheme('light'));
  btnDark.addEventListener('click', () => setTheme('dark'));

  const setTitles = (sp: SpeciesId, sx: SexId) => {
    const t = titlesFor(sp, sx);
    (root.querySelector('#title-h1') as HTMLElement).textContent = t.h1;
    (root.querySelector('#title-sub') as HTMLElement).textContent = t.subtitle;
    (root.querySelector('#hud-title') as HTMLElement).textContent = t.hud;
  };

  const setSexControlsEnabled = (enabled: boolean) => {
    sexRow.style.display = enabled ? '' : 'none';
  };
  setSexControlsEnabled(species === 'uomo');

  const syncSpeciesButtons = () => {
    (root.querySelector('#species-uomo') as HTMLButtonElement).setAttribute(
      'aria-pressed',
      species === 'uomo' ? 'true' : 'false',
    );
    (root.querySelector('#species-cane') as HTMLButtonElement).setAttribute(
      'aria-pressed',
      species === 'cane' ? 'true' : 'false',
    );
  };
  const syncSexButtons = () => {
    (root.querySelector('#sex-maschio') as HTMLButtonElement).setAttribute(
      'aria-pressed',
      sex === 'maschio' ? 'true' : 'false',
    );
    (root.querySelector('#sex-femmina') as HTMLButtonElement).setAttribute(
      'aria-pressed',
      sex === 'femmina' ? 'true' : 'false',
    );
  };

  const emitMode = () => {
    try {
      localStorage.setItem(SPECIES_KEY, species);
      localStorage.setItem(SEX_KEY, sex);
    } catch {
      /* ignore */
    }
    setTitles(species, sex);
    setSexControlsEnabled(species === 'uomo');
    syncSpeciesButtons();
    syncSexButtons();
    onModeChange({ species, sex });
  };

  root.querySelector('#species-uomo')?.addEventListener('click', () => {
    if (species === 'uomo') return;
    species = 'uomo';
    emitMode();
  });
  root.querySelector('#species-cane')?.addEventListener('click', () => {
    if (species === 'cane') return;
    species = 'cane';
    sex = 'maschio';
    emitMode();
  });
  root.querySelector('#sex-maschio')?.addEventListener('click', () => {
    if (species !== 'uomo' || sex === 'maschio') return;
    sex = 'maschio';
    emitMode();
  });
  root.querySelector('#sex-femmina')?.addEventListener('click', () => {
    if (species !== 'uomo' || sex === 'femmina') return;
    sex = 'femmina';
    emitMode();
  });

  const openDrawer = () => {
    panel.classList.add('open');
    backdrop.classList.add('open');
  };
  const closeDrawer = () => {
    panel.classList.remove('open');
    backdrop.classList.remove('open');
  };

  toggle.addEventListener('click', () => {
    if (panel.classList.contains('open')) closeDrawer();
    else openDrawer();
  });
  backdrop.addEventListener('click', closeDrawer);

  const bindScene = () => getScene();

  const layoutBtn = root.querySelector('#btn-layout-toggle') as HTMLButtonElement;
  const syncLayoutBtn = () => {
    const mode = bindScene()?.getLayoutMode?.() ?? 'rest';
    const aligned = mode === 'grid';
    layoutBtn.dataset.mode = mode;
    layoutBtn.setAttribute('aria-pressed', aligned ? 'true' : 'false');
    if (aligned) {
      layoutBtn.textContent = 'Ricomponi';
      layoutBtn.title = 'Riporta le parti alle posizioni anatomiche';
      layoutBtn.classList.remove('primary');
    } else {
      layoutBtn.textContent = 'Allinea in griglia';
      layoutBtn.title = 'Allinea le parti visibili in una griglia invisibile';
      layoutBtn.classList.add('primary');
    }
  };
  layoutBtn.addEventListener('click', () => {
    const scene = bindScene();
    if (!scene) return;
    ensureExamineBound();
    if (scene.getLayoutMode() === 'grid') scene.recomponi();
    else scene.allinea();
    syncLayoutAndExamine();
    // keep label in sync after animation settles
    window.setTimeout(syncLayoutAndExamine, 2600);
  });

  root.querySelectorAll<HTMLInputElement>('input[data-system]').forEach((input) => {
    input.addEventListener('change', () => {
      const scene = bindScene();
      if (!scene) return;
      scene.setSystemVisibility(input.dataset.system as SystemId, input.checked);
      // Stay on "Ricomponi" if still in grid mode after filter change
      syncLayoutBtn();
    });
  });

  root.querySelector('#btn-all')?.addEventListener('click', () => {
    root.querySelectorAll<HTMLInputElement>('input[data-system]').forEach((i) => {
      i.checked = true;
    });
    bindScene()?.setAllSystems(
      true,
      SYSTEMS.map((s) => s.id),
    );
    syncLayoutBtn();
  });

  root.querySelector('#btn-none')?.addEventListener('click', () => {
    root.querySelectorAll<HTMLInputElement>('input[data-system]').forEach((i) => {
      i.checked = false;
    });
    bindScene()?.setAllSystems(false, SYSTEMS.map((s) => s.id));
    syncLayoutBtn();
  });

  const search = root.querySelector('#search') as HTMLInputElement;
  let searchTimer = 0;
  search.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      bindScene()?.setSearch(search.value);
      syncLayoutBtn();
    }, 120);
  });

  const sysMap = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));

  const btnEsamina = root.querySelector('#btn-esamina') as HTMLButtonElement;
  const btnDetailExit = root.querySelector('#btn-detail-exit') as HTMLButtonElement;
  const examinePanel = root.querySelector('#examine-panel') as HTMLElement;
  const btnExamineExit = root.querySelector('#btn-examine-exit') as HTMLButtonElement;
  const btnNelCorpo = root.querySelector('#examine-nel-corpo') as HTMLButtonElement;
  const btnSolo = root.querySelector('#examine-solo') as HTMLButtonElement;
  const examineRelated = root.querySelector('#examine-related') as HTMLElement;
  const examineRelatedList = root.querySelector('#examine-related-list') as HTMLElement;
  const examineHandle = root.querySelector('#examine-handle') as HTMLButtonElement;
  let examineBound = false;
  let detailSelected = false;
  let examineExpanded = false;

  const isNarrowViewport = () => window.matchMedia('(max-width: 860px)').matches;

  /** Push FAB above selection/examine sheet on narrow screens so it never overlaps. */
  const syncFabClearance = () => {
    const rootStyle = document.documentElement.style;
    if (!isNarrowViewport()) {
      rootStyle.setProperty('--fab-clearance', '0px');
      document.body.classList.remove('detail-open');
      return;
    }
    const gap = 12;
    let h = 0;
    if (!examinePanel.hidden) {
      h = examinePanel.getBoundingClientRect().height;
    } else if (!detail.hidden && detailSelected) {
      h = detail.getBoundingClientRect().height;
    }
    const clearance = h > 0 ? Math.ceil(h + gap) : 0;
    rootStyle.setProperty('--fab-clearance', `${clearance}px`);
    document.body.classList.toggle('detail-open', !examinePanel.hidden || (!detail.hidden && detailSelected));
  };

  const examineHandleLabel = root.querySelector('#examine-handle-label') as HTMLElement;

  const applyExamineSheetState = (expanded: boolean, reframe = false) => {
    examineExpanded = expanded;
    // Desktop stays expanded; mobile defaults compact so organ stays visible
    const compact = isNarrowViewport() && !expanded;
    examinePanel.classList.toggle('examine-compact', compact);
    document.body.classList.toggle('examine-compact', compact);
    const ariaExpanded = expanded || !isNarrowViewport() ? 'true' : 'false';
    examineHandle.setAttribute('aria-expanded', ariaExpanded);
    if (compact) {
      examineHandle.title = 'Tocca per espandere';
      examineHandle.setAttribute('aria-label', 'Tocca per espandere i dettagli');
      examineHandleLabel.innerHTML =
        '<span class="examine-handle-chevron" aria-hidden="true">▾</span> Dettagli · Tocca per espandere';
    } else {
      examineHandle.title = 'Tocca per ridurre';
      examineHandle.setAttribute('aria-label', 'Tocca per ridurre i dettagli');
      examineHandleLabel.innerHTML =
        '<span class="examine-handle-chevron" aria-hidden="true">▴</span> Dettagli';
    }
    if (reframe) {
      requestAnimationFrame(() => bindScene()?.reframeExamineCamera?.(0.7));
    }
    requestAnimationFrame(syncFabClearance);
  };

  // Drag handle down to compact / up to expand; tap toggles (mobile sheet)
  let dragStartY = 0;
  let dragging = false;
  let suppressHandleClick = false;
  examineHandle.addEventListener('click', (ev) => {
    if (!isNarrowViewport()) return;
    if (suppressHandleClick) {
      suppressHandleClick = false;
      ev.preventDefault();
      return;
    }
    applyExamineSheetState(!examineExpanded, true);
  });
  examineHandle.addEventListener('pointerdown', (ev: PointerEvent) => {
    if (!isNarrowViewport()) return;
    dragging = true;
    dragStartY = ev.clientY;
    examineHandle.setPointerCapture(ev.pointerId);
  });
  examineHandle.addEventListener('pointerup', (ev: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    const dy = ev.clientY - dragStartY;
    if (Math.abs(dy) < 28) return; // let click toggle
    suppressHandleClick = true;
    if (dy > 28) applyExamineSheetState(false, true);
    else applyExamineSheetState(true, true);
  });
  examineHandle.addEventListener('pointercancel', () => {
    dragging = false;
  });

  const syncExamineToggle = (mode: ExamineMode) => {
    btnNelCorpo.setAttribute('aria-pressed', mode === 'nel-corpo' ? 'true' : 'false');
    btnSolo.setAttribute('aria-pressed', mode === 'solo' ? 'true' : 'false');
  };

  const fillExaminePanel = (
    part: AnatomyPart,
    mode: ExamineMode,
    related: AnatomyPart[],
  ) => {
    const sys = sysMap[part.sistema];
    const sysEl = root.querySelector('#examine-sys') as HTMLElement;
    sysEl.textContent = sys.nome;
    sysEl.style.color = `#${sys.colore.toString(16).padStart(6, '0')}`;
    (root.querySelector('#examine-nome') as HTMLElement).textContent = part.nome;
    const lat = root.querySelector('#examine-latino') as HTMLElement;
    if (part.latino) {
      lat.hidden = false;
      lat.textContent = part.latino;
    } else {
      lat.hidden = true;
    }
    (root.querySelector('#examine-desc') as HTMLElement).textContent = part.descrizione;
    syncExamineToggle(mode);

    examineRelatedList.innerHTML = '';
    if (related.length) {
      examineRelated.hidden = false;
      for (const r of related) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'examine-related-item';
        b.textContent = r.nome;
        b.title = r.latino || r.nome;
        b.addEventListener('click', () => {
          bindScene()?.enterExamineByPartId(r.id);
        });
        examineRelatedList.appendChild(b);
      }
    } else {
      examineRelated.hidden = true;
    }
  };

  const showExaminePanel = (on: boolean) => {
    examinePanel.hidden = !on;
    document.body.classList.toggle('examining', on);
    if (on) {
      detail.hidden = true;
      btnEsamina.hidden = true;
      btnDetailExit.hidden = true;
      detailSelected = false;
      document.body.classList.remove('detail-open');
      // Mobile: start compact so framed organ sits above the sheet
      applyExamineSheetState(!isNarrowViewport(), false);
    } else {
      document.body.classList.remove('examine-compact');
      examinePanel.classList.add('examine-compact');
      examineExpanded = false;
      requestAnimationFrame(syncFabClearance);
    }
  };

  const ensureExamineBound = () => {
    const scene = bindScene();
    if (!scene || examineBound) return;
    examineBound = true;
    scene.setExamineChangeCallback((state) => {
      if (!state.active || !state.part) {
        showExaminePanel(false);
        return;
      }
      fillExaminePanel(state.part, state.mode, state.related);
      showExaminePanel(true);
    });
  };

  btnEsamina.addEventListener('click', (e) => {
    e.stopPropagation();
    ensureExamineBound();
    const scene = bindScene();
    if (!scene) return;
    scene.enterExamineFromSelection('nel-corpo');
  });

  btnDetailExit.addEventListener('click', (e) => {
    e.stopPropagation();
    bindScene()?.clearSelection();
  });

  btnExamineExit.addEventListener('click', () => {
    bindScene()?.exitExamine(true);
  });

  btnNelCorpo.addEventListener('click', () => {
    bindScene()?.setExamineMode('nel-corpo');
  });
  btnSolo.addEventListener('click', () => {
    bindScene()?.setExamineMode('solo');
  });

  // Escape exits examine, or clears basic selection
  window.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    const scene = bindScene();
    if (!scene) return;
    if (scene.isExamining()) scene.exitExamine(true);
    else if (scene.getSelectedPart()) scene.clearSelection();
  });

  // Keep FAB clear of bottom sheets when viewport / sheet size changes
  window.addEventListener('resize', () => requestAnimationFrame(syncFabClearance));
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => syncFabClearance());
    ro.observe(examinePanel);
    ro.observe(detail);
  }

  // Bind examine callback once scene exists (also on mode switches via load)
  const origSyncLayout = syncLayoutBtn;
  // Re-ensure binding when FAB syncs after load
  const syncLayoutAndExamine = () => {
    origSyncLayout();
    ensureExamineBound();
  };

  return {
    showLoading(pct: number, msg: string) {
      loader.hidden = false;
      loaderMsg.textContent = msg;
      loaderFill.style.width = `${Math.round(pct * 100)}%`;
    },
    hideLoading() {
      loader.classList.add('fade');
      setTimeout(() => {
        loader.hidden = true;
        loader.classList.remove('fade');
      }, 400);
    },
    setPartCount(n: number, counts: Record<string, number>) {
      const badge = root.querySelector('#part-count-badge') as HTMLElement;
      badge.textContent = `${n.toLocaleString('it-IT')} parti reali`;
      for (const s of SYSTEMS) {
        const el = root.querySelector(`[data-count-for="${s.id}"]`);
        if (el) el.textContent = (counts[s.id] ?? 0).toLocaleString('it-IT');
      }
    },
    setAttribution(text: string) {
      const el = root.querySelector('#attrib') as HTMLElement;
      if (el) el.textContent = text;
    },
    applyThemeToScene() {
      getScene()?.setTheme(theme);
    },
    getMode: () => ({ species, sex }),
    setTitles,
    setSexControlsEnabled,
    syncLayoutFab: syncLayoutAndExamine,
    clearExamineUi() {
      showExaminePanel(false);
    },
    showDetail(part: AnatomyPart | null, x: number, y: number, opts?: { selected?: boolean }) {
      ensureExamineBound();
      if (bindScene()?.isExamining()) {
        detail.hidden = true;
        return;
      }
      if (!part) {
        detail.hidden = true;
        detailSelected = false;
        btnEsamina.hidden = true;
        btnDetailExit.hidden = true;
        detail.classList.remove('interactive', 'anchored');
        document.body.classList.remove('detail-open');
        requestAnimationFrame(syncFabClearance);
        return;
      }
      detailSelected = !!opts?.selected;
      const sys = sysMap[part.sistema];
      (root.querySelector('#detail-sys') as HTMLElement).textContent = sys.nome;
      (root.querySelector('#detail-sys') as HTMLElement).style.color = `#${sys.colore.toString(16).padStart(6, '0')}`;
      (root.querySelector('#detail-nome') as HTMLElement).textContent = part.nome;
      const lat = root.querySelector('#detail-latino') as HTMLElement;
      if (part.latino) {
        lat.hidden = false;
        lat.textContent = part.latino;
      } else {
        lat.hidden = true;
      }
      (root.querySelector('#detail-desc') as HTMLElement).textContent = part.descrizione;
      btnEsamina.hidden = !detailSelected;
      btnDetailExit.hidden = !detailSelected;
      detail.classList.toggle('interactive', detailSelected);
      detail.hidden = false;

      if (detailSelected) {
        // Anchor near bottom-center / pointer; on mobile FAB lifts above the card
        const pad = 16;
        detail.style.left = '';
        detail.style.top = '';
        detail.classList.add('anchored');
        // Still position from click for desktop; mobile uses CSS override
        const rect = detail.getBoundingClientRect();
        let left = x + 18;
        let top = y + 18;
        if (left + rect.width > window.innerWidth - pad) left = x - rect.width - 12;
        if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
        detail.style.left = `${Math.max(pad, left)}px`;
        detail.style.top = `${Math.max(pad, top)}px`;
      } else {
        detail.classList.remove('anchored');
        const pad = 16;
        const rect = detail.getBoundingClientRect();
        let left = x + 18;
        let top = y + 18;
        if (left + rect.width > window.innerWidth - pad) left = x - rect.width - 12;
        if (top + rect.height > window.innerHeight - pad) top = y - rect.height - 12;
        detail.style.left = `${Math.max(pad, left)}px`;
        detail.style.top = `${Math.max(pad, top)}px`;
      }
      requestAnimationFrame(syncFabClearance);
    },
  };
}

