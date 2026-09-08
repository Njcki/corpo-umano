# Maschio vs Femmina — corrispondenza cataloghi

| | Maschio (BP3D IS-A) | Femmina (HRA + BP3D) |
|--|--|--|
| Totale mesh | 2234 | ~2401 (dopo filtri; senza cute full-body) |
| Id condivisi | FJ#### | Stessi FJ#### per pezzi sex-neutral (~2158) |
| Cute / tegumentario | BP3D FJ2810 (maschile) | **Cute full-body non inclusa per ora** (ADAPTIVE_SKIN / VH_F_skin / FJ2810 omessi). Restano eyebrow/hair/lip BP3D |
| Occhi | BP3D | BP3D (occhi/vasi orbitari HRA esclusi: fuori posto) |
| Collo / trachea | BP3D | BP3D (cartilagini/vie aeree HRA escluse come oversplit) |
| Visceri | BP3D | Preferenza HRA femminile dove non duplica BP3D |
| Riproduttivo | Maschile BP3D | **Solo HRA femminile** (utero, ovaie, vagina, mammelle). Nessun penis/prostata/testicolo. Round ligament uteri esclusi (L/R e Z fuori pelvi) |
| Cervello dettagliato | BP3D grezzo | Allen parcels **esclusi** (oversplit); restano pezzi BP3D nervoso |
| Linfatico | Assente in IS-A | Presente (HRA) |

**Differenze oneste (sesso / dataset):** riproduttivo femminile HRA; linfatico HRA; cute full-body omessa in Femmina vs cute maschile BP3D.

**Normalizzato:** id BP3D allineati; niente Allen; niente VH_F vasi/polmoni duplicati; niente cute maschile né involucro adattivo in Femmina; legamenti pelvici anomali esclusi/clampati.

**Artefatti tooling:** Femmina resta ~170 pezzi sopra Maschio per riproduttivo + linfatico + dettaglio HRA digestivo. Pregnancy HRA esclusa.

**Cute (Donna):** full-body tegumentario non incluso per ora (`ADAPTIVE_SKIN` rimosso; FJ2810 / VH_F_skin esclusi). Solo piccoli pezzi facciali BP3D (eyebrow / hair / lip).
