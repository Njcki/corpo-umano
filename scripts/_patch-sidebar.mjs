import fs from 'fs';

let ui = fs.readFileSync('src/ui/AppUI.ts', 'utf8');
const old = `      <aside class="panel panel-left" id="filter-panel">
        <div class="panel-header">`;
const neu = `      <aside class="panel panel-left" id="filter-panel">
        <div class="panel-scroll">
        <div class="panel-header">`;
if (!ui.includes(old)) throw new Error('aside open missing');
if (!ui.includes('panel-scroll')) ui = ui.replace(old, neu);

const oldMid = `        </div>

        <details class="credits-acc">`;
const neuMid = `        </div>
        </div><!-- /.panel-scroll -->

        <details class="credits-acc">`;
if (ui.includes('<!-- /.panel-scroll -->')) {
  console.log('AppUI already wrapped');
} else {
  if (!ui.includes(oldMid)) throw new Error('credits join missing');
  ui = ui.replace(oldMid, neuMid);
}
fs.writeFileSync('src/ui/AppUI.ts', ui);
console.log('AppUI ok');

let css = fs.readFileSync('src/style.css', 'utf8');

if (!css.includes('.panel-scroll')) {
  css = css.replace(
`.panel {
  position: relative;
  z-index: 5;
  background: var(--panel);
  backdrop-filter: blur(18px) saturate(1.2);
  -webkit-backdrop-filter: blur(18px) saturate(1.2);
  border-right: 1px solid var(--panel-border);
  padding: 1.1rem 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  overflow: auto;
}`,
`.panel {
  position: relative;
  z-index: 5;
  background: var(--panel);
  backdrop-filter: blur(18px) saturate(1.2);
  -webkit-backdrop-filter: blur(18px) saturate(1.2);
  border-right: 1px solid var(--panel-border);
  padding: 1.1rem 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
  min-height: 0;
  height: 100%;
}

.panel-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding-bottom: 0.35rem;
  -webkit-overflow-scrolling: touch;
}`);
}

css = css.replace(
`.systems {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
  min-height: 0;
}`,
`.systems {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 0 0 auto;
}`);

css = css.replace(
`.credits-acc {
  margin-top: 0.35rem;
  border-top: 1px solid var(--panel-border);
  padding-top: 0.45rem;
  flex-shrink: 0;
}`,
`.credits-acc {
  position: relative;
  z-index: 0;
  flex: 0 0 auto;
  margin-top: 0;
  margin-left: -0.15rem;
  margin-right: -0.15rem;
  border-top: 1px solid var(--panel-border);
  padding: 0.55rem 0.15rem calc(0.55rem + env(safe-area-inset-bottom, 0px));
  background: var(--panel-solid, var(--panel));
}`);

css = css.replace(
`  .panel-left {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(320px, 88vw);
    transform: translateX(-105%);
    transition: transform 0.28s ease;
    z-index: 40;
    box-shadow: 8px 0 40px rgba(0, 0, 0, 0.4);
    /* Keep title/content below the fixed hamburger (44px) + safe area */
    padding-top: calc(max(0.85rem, env(safe-area-inset-top)) + 44px + 0.85rem);
  }`,
`  .panel-left {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(320px, 88vw);
    height: 100%;
    max-height: 100dvh;
    transform: translateX(-105%);
    transition: transform 0.28s ease;
    z-index: 40;
    box-shadow: 8px 0 40px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    /* Keep title/content below the fixed hamburger (44px) + safe area */
    padding-top: calc(max(0.85rem, env(safe-area-inset-top)) + 44px + 0.85rem);
    padding-bottom: 0;
  }`);

fs.writeFileSync('src/style.css', css);
console.log('CSS ok', css.includes('.panel-scroll'), css.includes('max-height: 100dvh'));
