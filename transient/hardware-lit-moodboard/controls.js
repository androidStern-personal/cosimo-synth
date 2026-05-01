/* ============================================================
   COSIMO · MOODBOARD CONTROLS
   Wires every visual control to real interactivity:
   pointer events for mouse + touch + pen, keyboard fallback,
   ARIA roles/values for screen readers.
   No visual design changes; only behavior.
   ============================================================ */
(() => {
  const MINUS = '\u2212';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, fb = 0) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fb;
  };

  /* ============================================================
     KNOB DESIGN CONFIG — exposed on window so the demo's control
     panel can tweak values live. Defaults match the locked-in
     two-zone design. window.__cosimoRefreshKnobs() re-renders
     every initialised knob from the current config.
     ============================================================ */
  const DEFAULT_KNOB_CONFIG = {
    layout: {
      discRadius: 32,    /* inner-disc radius (when knob has mod) */
      modGap: 4,         /* radial gap between disc edge and mod inner edge */
      modWidth: 32,      /* mod sector radial thickness */
    },
    colors: {
      modHueOffset: 180,   /* degrees rotated from the section accent */
      modLightness: 78,    /* OKLCH lightness for the mod sector (%) */
      modChroma: 0.22,     /* OKLCH chroma for the mod sector */
      trackOpacity: 0.45,  /* dim underlay opacity (both inner and outer) */
      modOpacity: 0.92,    /* bright mod sector opacity */
    },
    stipple: {
      cell: 2.4,    /* pattern repeat unit; smaller = denser/finer */
      dotR: 0.85,   /* dot radius; raise for more coverage */
    },
    behavior: {
      dragSensitivity: 200,  /* px-per-full-range; lower = faster */
      curve: 'linear',       /* 'linear' | 'sigmoid' | 'exp' | 'log' */
    },
  };
  if (!window.__cosimoKnobConfig) {
    window.__cosimoKnobConfig = JSON.parse(JSON.stringify(DEFAULT_KNOB_CONFIG));
  }
  const getCfg = () => window.__cosimoKnobConfig;
  const knobRefreshers = [];
  window.__cosimoRefreshKnobs = () => knobRefreshers.forEach((fn) => fn());
  /* push CSS variables that the stylesheet reads (mod color tuning) */
  const applyConfigCSSVars = () => {
    const c = getCfg().colors;
    const root = document.documentElement.style;
    root.setProperty('--mod-hue-offset', String(c.modHueOffset));
    root.setProperty('--mod-lightness', c.modLightness + '%');
    root.setProperty('--mod-chroma', String(c.modChroma));
    root.setProperty('--track-opacity', String(c.trackOpacity));
    root.setProperty('--mod-opacity', String(c.modOpacity));
  };
  /* Per-knob stipple patterns get registered here. When config
     changes, every registered pattern updater is called. */
  const stippleUpdaters = [];
  const applyStipplePattern = () => stippleUpdaters.forEach((fn) => fn());
  window.__cosimoApplyStipple = applyStipplePattern;
  applyConfigCSSVars();

  /* readouts: .cell__cap or .demo__big-cell-val */
  const writeReadout = (el, text) => {
    const cell = el.closest('.cell');
    if (cell) {
      const cap = cell.querySelector('.cell__cap');
      if (cap) cap.textContent = text;
      return;
    }
    const big = el.closest('.demo__big-cell');
    if (big) {
      const node = big.querySelector('.demo__big-cell-val');
      if (node) node.textContent = text;
    }
  };

  const fmtUni = (v) => v.toFixed(2);
  const fmtBi = (v) => {
    if (Math.abs(v) < 0.005) return '0.00';
    return (v > 0 ? '+' : MINUS) + Math.abs(v).toFixed(2);
  };
  const fmtRange = (lo, hi) => `${lo.toFixed(2)} ${'\u2192'} ${hi.toFixed(2)}`;

  const isStamped = (el) => [...el.classList].some((c) => c.includes('--state-'));

  /* ============================================================
     SLIDER — horizontal & vertical, unipolar, bipolar, range
     ============================================================ */
  const initSlider = (el) => {
    if (el.dataset.wired) return;
    el.dataset.wired = '1';

    const isV = el.classList.contains('slider-v');
    const cls = isV ? 'slider-v' : 'slider-h';
    const isBi = el.classList.contains(`${cls}--bi`);
    const isRange = el.classList.contains(`${cls}--range`);
    const bar = el.querySelector(`.${cls}__bar`);
    if (!bar) return;

    const min = isBi ? -1 : 0;
    const max = 1;

    el.setAttribute('role', 'slider');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-valuemin', String(min));
    el.setAttribute('aria-valuemax', String(max));
    if (isV) el.setAttribute('aria-orientation', 'vertical');

    let activeProp = isRange ? '--val-lo' : '--val';

    const get = (p) => num(el.style.getPropertyValue(p));
    const set = (p, v) => {
      v = clamp(v, min, max);
      if (isRange) {
        const lo = get('--val-lo');
        const hi = get('--val-hi');
        if (p === '--val-lo') v = Math.min(v, hi);
        else if (p === '--val-hi') v = Math.max(v, lo);
      }
      el.style.setProperty(p, v);
      el.setAttribute('aria-valuenow', v.toFixed(3));
      refreshReadout();
    };

    const refreshReadout = () => {
      if (isRange) writeReadout(el, fmtRange(get('--val-lo'), get('--val-hi')));
      else writeReadout(el, isBi ? fmtBi(get('--val')) : fmtUni(get('--val')));
    };

    const posToVal = (e) => {
      const r = bar.getBoundingClientRect();
      const t = isV
        ? (r.bottom - e.clientY) / r.height
        : (e.clientX - r.left) / r.width;
      return min + clamp(t, 0, 1) * (max - min);
    };

    bar.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { bar.setPointerCapture(e.pointerId); } catch (_) {}
      const v = posToVal(e);
      if (isRange) {
        const dLo = Math.abs(v - get('--val-lo'));
        const dHi = Math.abs(v - get('--val-hi'));
        activeProp = dLo <= dHi ? '--val-lo' : '--val-hi';
      }
      set(activeProp, v);
      el.focus();
    });
    bar.addEventListener('pointermove', (e) => {
      if (!bar.hasPointerCapture(e.pointerId)) return;
      set(activeProp, posToVal(e));
    });
    const release = (e) => {
      if (bar.hasPointerCapture(e.pointerId)) bar.releasePointerCapture(e.pointerId);
    };
    bar.addEventListener('pointerup', release);
    bar.addEventListener('pointercancel', release);

    el.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.2 : (e.altKey ? 0.01 : 0.05);
      const incKeys = isV ? ['ArrowUp', 'ArrowRight'] : ['ArrowRight', 'ArrowUp'];
      const decKeys = isV ? ['ArrowDown', 'ArrowLeft'] : ['ArrowLeft', 'ArrowDown'];
      let prop = activeProp;
      let v = get(prop);
      let handled = true;

      if (e.key === 'Tab' && isRange && !e.shiftKey) {
        if (prop === '--val-lo') {
          activeProp = '--val-hi';
          e.preventDefault();
          return;
        }
        handled = false;
      } else if (incKeys.includes(e.key)) v += step;
      else if (decKeys.includes(e.key)) v -= step;
      else if (e.key === 'Home') v = min;
      else if (e.key === 'End') v = max;
      else if (e.key === 'PageUp') v += step * 4;
      else if (e.key === 'PageDown') v -= step * 4;
      else handled = false;

      if (handled) {
        e.preventDefault();
        set(prop, v);
      }
    });

    refreshReadout();
  };

  /* ============================================================
     KNOB — unipolar (270° arc) & bipolar (centered)
     uses pathLength=100; arc is 75 of 100; bipolar center at 37.5
     ============================================================ */
  const initKnob = (svg) => {
    if (svg.dataset.wired) return;
    svg.dataset.wired = '1';

    const valueEl = svg.querySelector('.knob__value');
    if (!valueEl) return;
    const isBi = !!svg.querySelector('.knob__center-tick');
    const min = isBi ? -1 : 0;
    const max = 1;

    const parseInitial = () => {
      const da = (valueEl.getAttribute('stroke-dasharray') || '').trim();
      const parts = da.split(/\s+/).map(parseFloat);
      if (!isBi) return clamp((parts[0] || 0) / 75, 0, 1);
      if (parts.length >= 4) {
        const pre = parts[1];
        const v = parts[2];
        if (pre >= 37.45) return clamp(v / 37.5, 0, 1);
        return clamp((pre - 37.5) / 37.5, -1, 0);
      }
      return 0;
    };

    let value = parseInitial();

    /* Two-zone knob: both the inner disc and the outer mod sector are
       filled, with matching radial thickness. Geometry comes from the
       global config so the demo's control panel can re-tune it. */
    const hasModRing = Number.isFinite(parseFloat(svg.dataset.mod)) &&
      Math.abs(parseFloat(svg.dataset.mod)) > 0.005;
    /* Geometry getters read live from config — recomputed each time
       a path is rebuilt so config changes flow through without
       rebinding listeners. */
    const getDiscR = () => hasModRing ? getCfg().layout.discRadius : 44;
    const getModRI = () => getDiscR() + getCfg().layout.modGap;
    const getModRO = () => getModRI() + getCfg().layout.modWidth;
    const getZoneBoundary = () => getDiscR() + Math.max(2, getCfg().layout.modGap / 2);
    const updateViewBox = () => {
      if (!hasModRing) return;
      const ro = getModRO();
      const pad = Math.max(0, ro - 50 + 5);
      svg.setAttribute('viewBox', `${-pad} ${-pad} ${100 + 2 * pad} ${100 + 2 * pad}`);
    };
    updateViewBox();

    const NS = svg.namespaceURI;

    /* Per-knob stipple patterns. Defined inside the knob's own SVG
       so the patterns' CSS variables (--accent, --mod-hue-offset, etc.)
       cascade from the section. Two patterns: one in the section
       accent (for the value track) and one in the complement (for
       the mod track). Unique IDs prevent cross-knob collision. */
    const knobUid = `k${initKnob._n = (initKnob._n || 0) + 1}`;
    const stippleAccId = `stipple-acc-${knobUid}`;
    const stippleModId = `stipple-mod-${knobUid}`;
    const defs = document.createElementNS(NS, 'defs');
    const makeStipple = (id, fillExpr) => {
      const pat = document.createElementNS(NS, 'pattern');
      pat.setAttribute('id', id);
      pat.setAttribute('patternUnits', 'userSpaceOnUse');
      const dot = document.createElementNS(NS, 'circle');
      dot.style.fill = fillExpr;
      pat.appendChild(dot);
      defs.appendChild(pat);
      return { pat, dot };
    };
    const stippleAcc = makeStipple(stippleAccId, 'var(--accent)');
    const stippleMod = makeStipple(
      stippleModId,
      'oklch(from var(--accent) var(--mod-lightness, 78%) var(--mod-chroma, 0.22) calc(h + var(--mod-hue-offset, 180)))'
    );
    svg.insertBefore(defs, svg.firstChild);
    const updateStipple = () => {
      const s = getCfg().stipple;
      const half = s.cell / 2;
      [stippleAcc, stippleMod].forEach(({ pat, dot }) => {
        pat.setAttribute('width', String(s.cell));
        pat.setAttribute('height', String(s.cell));
        dot.setAttribute('cx', String(half));
        dot.setAttribute('cy', String(half));
        dot.setAttribute('r', String(s.dotR));
      });
    };
    stippleUpdaters.push(updateStipple);
    updateStipple();

    /* Invisible hit rect covering the viewBox so the SVG receives
       pointer events anywhere in its bounding box, not just on the
       rendered paths. Resized on every refresh so the hit area
       follows the current viewBox. */
    let hitRect = null;
    if (hasModRing) {
      hitRect = document.createElementNS(NS, 'rect');
      hitRect.setAttribute('fill', 'transparent');
      hitRect.setAttribute('pointer-events', 'fill');
      svg.insertBefore(hitRect, svg.firstChild);
    }
    const sizeHitRect = () => {
      if (!hitRect) return;
      const vb = svg.viewBox.baseVal;
      hitRect.setAttribute('x', String(vb.x));
      hitRect.setAttribute('y', String(vb.y));
      hitRect.setAttribute('width', String(vb.width));
      hitRect.setAttribute('height', String(vb.height));
    };
    sizeHitRect();

    /* Replace the static track <circle> with a filled 270° pie wedge.
       This shows the full available range as a quiet underlay. */
    const existingTrack = svg.querySelector('.knob__track');
    const trackPath = document.createElementNS(NS, 'path');
    trackPath.setAttribute('class', 'knob__track');
    trackPath.setAttribute('fill', `url(#${stippleAccId})`);
    trackPath.setAttribute('stroke', 'none');
    if (existingTrack) existingTrack.replaceWith(trackPath);
    else svg.insertBefore(trackPath, svg.firstChild);

    /* Mod track — a dim 270° annular sector showing the full outer
       hit zone as a quiet underlay, mirroring how the inner track
       shows the full value range behind the bright value wedge. */
    let modTrackPath = null;
    if (hasModRing) {
      modTrackPath = document.createElementNS(NS, 'path');
      modTrackPath.setAttribute('class', 'knob__mod-track');
      modTrackPath.setAttribute('fill', `url(#${stippleModId})`);
      modTrackPath.setAttribute('stroke', 'none');
      svg.appendChild(modTrackPath);
    }

    /* Replace the value <circle> with a filled wedge whose angular
       range tracks the current value. */
    const valuePath = document.createElementNS(NS, 'path');
    valuePath.setAttribute('class', 'knob__value');
    valuePath.setAttribute('fill', 'currentColor');
    valuePath.setAttribute('stroke', 'none');
    valueEl.replaceWith(valuePath);

    /* Focus outline is a CLOSED PATH that traces the full perimeter of
       the value arc: outer edge + end cap + inner edge + start cap.
       The dashed stroke runs around the entire shape (not just one
       edge). Stroke-width tiny — the path geometry IS the outline. */
    const focusOutline = document.createElementNS(NS, 'path');
    focusOutline.setAttribute('class', 'knob__focus-outline');
    focusOutline.setAttribute('fill', 'none');
    focusOutline.setAttribute('stroke-width', '1.4');
    focusOutline.setAttribute('stroke-dasharray', '2 1.6');
    focusOutline.setAttribute('stroke-linejoin', 'round');
    valuePath.after(focusOutline);

    const TAU = Math.PI / 180;
    const ptOnCircle = (deg, r) => [
      50 + r * Math.cos(deg * TAU),
      50 - r * Math.sin(deg * TAU),
    ];

    /* Geometry now flows from getDiscR()/getModRI()/getModRO() which
       read live config. The build functions below reach for the
       current value at render time. */

    const buildTrackD = () => {
      const r = getDiscR();
      const [sx, sy] = ptOnCircle(225, r);
      const [ex, ey] = ptOnCircle(-45, r);
      const f = (n) => n.toFixed(3);
      return `M 50 50 L ${f(sx)} ${f(sy)} A ${r} ${r} 0 1 1 ${f(ex)} ${f(ey)} Z`;
    };

    const buildValueD = (v) => {
      if (Math.abs(v) < 0.005) return '';
      const r = getDiscR();
      let startMath, endMath, sweep, arcDeg;
      if (!isBi) {
        startMath = 225;
        endMath = startMath - v * 270;
        sweep = 1;
        arcDeg = v * 270;
      } else if (v > 0) {
        startMath = 90;
        endMath = startMath - v * 135;
        sweep = 1;
        arcDeg = v * 135;
      } else {
        startMath = 90;
        endMath = startMath - v * 135;
        sweep = 0;
        arcDeg = -v * 135;
      }
      const [sx, sy] = ptOnCircle(startMath, r);
      const [ex, ey] = ptOnCircle(endMath, r);
      const lg = arcDeg > 180 ? 1 : 0;
      const f = (n) => n.toFixed(3);
      return `M 50 50 L ${f(sx)} ${f(sy)} A ${r} ${r} 0 ${lg} ${sweep} ${f(ex)} ${f(ey)} Z`;
    };

    /* Mod track is the static 270° annular sector. */
    const buildModTrackD = () => {
      const ri = getModRI();
      const ro = getModRO();
      const f = (n) => n.toFixed(3);
      const [oxs, oys] = ptOnCircle(225, ro);
      const [oxe, oye] = ptOnCircle(-45, ro);
      const [ixs, iys] = ptOnCircle(225, ri);
      const [ixe, iye] = ptOnCircle(-45, ri);
      return (
        `M ${f(oxs)} ${f(oys)} ` +
        `A ${ro} ${ro} 0 1 1 ${f(oxe)} ${f(oye)} ` +
        `L ${f(ixe)} ${f(iye)} ` +
        `A ${ri} ${ri} 0 1 0 ${f(ixs)} ${f(iys)} Z`
      );
    };

    /* Wedge outline for focus indicator: traces the value wedge's
       perimeter slightly enlarged (radial-radial-arc-back-to-center). */
    const buildOutlineD = (v) => {
      if (Math.abs(v) < 0.005) return '';
      const rO = getDiscR() + 2;
      let startMath, endMath, sweep, arcDeg;
      if (!isBi) {
        startMath = 225;
        endMath = startMath - v * 270;
        sweep = 1;
        arcDeg = v * 270;
      } else if (v > 0) {
        startMath = 90;
        endMath = startMath - v * 135;
        sweep = 1;
        arcDeg = v * 135;
      } else {
        startMath = 90;
        endMath = startMath - v * 135;
        sweep = 0;
        arcDeg = -v * 135;
      }
      const [sx, sy] = ptOnCircle(startMath, rO);
      const [ex, ey] = ptOnCircle(endMath, rO);
      const lg = arcDeg > 180 ? 1 : 0;
      const f = (n) => n.toFixed(3);
      return `M 50 50 L ${f(sx)} ${f(sy)} A ${rO} ${rO} 0 ${lg} ${sweep} ${f(ex)} ${f(ey)} Z`;
    };

    /* Modulation ring — optional outer arc at r=52 that indicates
       the parameter's modulated range relative to the knob's base
       value. Markup-controlled:
         data-mod="0.3"        unipolar mod (sign = direction)
         data-mod="-0.4"       unipolar mod, negative direction
         data-mod="0.25" data-mod-bi   bipolar mod (centered on base) */
    let modAmount = parseFloat(svg.dataset.mod);
    const modBipolar = svg.hasAttribute('data-mod-bi');
    const hasMod = Number.isFinite(modAmount) && Math.abs(modAmount) > 0.005;

    let modPath = null;
    let modHandles = [];
    if (hasMod) {
      modPath = document.createElementNS(NS, 'path');
      modPath.setAttribute('class', 'knob__mod');
      modPath.setAttribute('fill', 'currentColor');
      modPath.setAttribute('stroke', 'none');
      svg.appendChild(modPath);
    }

    /* Map value (in knob's value-space) to math angle on the knob's
       arc. Unipolar maps [0,1] across [225°, -45°]; bipolar maps
       [-1,+1] across the same angular range. */
    const valueToAngle = (v) => isBi ? 90 - v * 135 : 225 - v * 270;
    const valueMin = isBi ? -1 : 0;
    const valueMax = 1;

    /* Modulation range in value-space: bipolar centers on base,
       unipolar starts at base and extends in sign's direction. The
       mod path is a filled ANNULAR SECTOR (a thick, solid ring slice)
       sitting outside the inner disc. */
    const buildModD = (baseV) => {
      if (!hasMod) return '';
      const m = Math.abs(modAmount);
      let lowV, highV;
      if (modBipolar) {
        lowV = baseV - m;
        highV = baseV + m;
      } else if (modAmount > 0) {
        lowV = baseV;
        highV = baseV + m;
      } else {
        lowV = baseV - m;
        highV = baseV;
      }
      lowV = clamp(lowV, valueMin, valueMax);
      highV = clamp(highV, valueMin, valueMax);
      if (highV - lowV < 0.005) return '';

      const startMath = valueToAngle(lowV);   /* higher math angle */
      const endMath = valueToAngle(highV);    /* lower math angle  */
      const arcDeg = startMath - endMath;
      const lg = arcDeg > 180 ? 1 : 0;
      const f = (n) => n.toFixed(3);
      const ri = getModRI();
      const ro = getModRO();
      const [oxs, oys] = ptOnCircle(startMath, ro);
      const [oxe, oye] = ptOnCircle(endMath, ro);
      const [ixs, iys] = ptOnCircle(startMath, ri);
      const [ixe, iye] = ptOnCircle(endMath, ri);
      return (
        `M ${f(oxs)} ${f(oys)} ` +
        `A ${ro} ${ro} 0 ${lg} 1 ${f(oxe)} ${f(oye)} ` +
        `L ${f(ixe)} ${f(iye)} ` +
        `A ${ri} ${ri} 0 ${lg} 0 ${f(ixs)} ${f(iys)} Z`
      );
    };

    /* Reverse of valueToAngle — given a math angle on the knob, returns
       the corresponding value (clamped to the knob's range, taking the
       angular gap at the bottom into account). */
    const angleToValue = (angleDeg) => {
      let a = ((angleDeg % 360) + 360) % 360;
      let f;
      if (a <= 225) {
        f = (225 - a) / 270;
      } else if (a >= 315) {
        f = (225 - (a - 360)) / 270;
      } else {
        /* in the bottom gap (225..315) — clamp to nearest valid edge */
        f = a < 270 ? 0 : 1;
      }
      f = clamp(f, 0, 1);
      return isBi ? f * 2 - 1 : f;
    };

    const updateModHandles = () => { /* no dots in filled-sector design */ };

    const apply = (v) => {
      value = clamp(v, min, max);
      trackPath.setAttribute('d', buildTrackD());
      valuePath.setAttribute('d', buildValueD(value));
      focusOutline.setAttribute('d', buildOutlineD(value));
      if (modTrackPath) modTrackPath.setAttribute('d', buildModTrackD());
      if (modPath) modPath.setAttribute('d', buildModD(value));
      svg.setAttribute('aria-valuenow', value.toFixed(3));
      writeReadout(svg, isBi ? fmtBi(value) : fmtUni(value));
    };

    /* Knob-level refresh — called by the demo's control panel after
       the global config changes. Updates viewBox, hit rect, and re-
       renders all paths from the latest geometry. */
    const refresh = () => {
      updateViewBox();
      sizeHitRect();
      apply(value);
    };
    knobRefreshers.push(refresh);

    /* Mod position indicator — small dot at the mod arc tip(s), purely
       visual. Pointer interaction is handled at the SVG level by the
       zone-based pointerdown router below (vertical drag in the outer
       zone adjusts mod amount). */
    const createModHandle = (side) => {
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('class', 'knob__mod-handle');
      dot.setAttribute('r', '4');
      dot.style.pointerEvents = 'none';
      svg.appendChild(dot);
      return { side, dot };
    };

    /* Filled-sector mod no longer needs separate handle dots — the
       sector's edges are the visible boundaries. Skip dot creation. */
    /* (modHandles intentionally left empty) */

    svg.setAttribute('role', 'slider');
    svg.setAttribute('tabindex', '0');
    svg.setAttribute('aria-valuemin', String(min));
    svg.setAttribute('aria-valuemax', String(max));
    apply(value);

    let startY = 0;
    let startVal = 0;
    let dragMode = 'value';     /* 'value' or 'mod' */
    /* ZONE_BOUNDARY is read live so the split moves when the config does */

    svg.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { svg.setPointerCapture(e.pointerId); } catch (_) {}

      /* Zone routing: the outer ring (where the mod arc lives) drags
         mod amount; the inner area drags value. Boundary is at r=47,
         halfway between the value arc's outer edge and the mod arc's
         inner edge. Knobs without mod always drag value. */
      if (hasMod) {
        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const px = vb.x + ((e.clientX - rect.left) / rect.width) * vb.width;
        const py = vb.y + ((e.clientY - rect.top) / rect.height) * vb.height;
        const dx = px - 50;
        const dy = py - 50;
        const dist = Math.sqrt(dx * dx + dy * dy);
        dragMode = dist >= getZoneBoundary() ? 'mod' : 'value';
      } else {
        dragMode = 'value';
      }

      startY = e.clientY;
      startVal = dragMode === 'mod' ? modAmount : value;
      svg.focus();
    });
    /* Apply the drag-curve transfer function to the linear pixel delta
       before scaling. Linear keeps things proportional; sigmoid slows
       at the extremes; exp accelerates fast drags; log smooths them. */
    const transferCurve = (dy, curve) => {
      if (curve === 'sigmoid') return Math.tanh(dy * 0.0085) * 117;
      if (curve === 'exp') return Math.sign(dy) * (Math.exp(Math.abs(dy) * 0.011) - 1) * 18;
      if (curve === 'log') return Math.sign(dy) * Math.log(1 + Math.abs(dy) * 0.04) * 26;
      return dy;
    };
    svg.addEventListener('pointermove', (e) => {
      if (!svg.hasPointerCapture(e.pointerId)) return;
      const dy = startY - e.clientY;
      const cfg = getCfg().behavior;
      const baseSens = e.shiftKey ? 1000 : (e.altKey ? 4000 : cfg.dragSensitivity);
      const shaped = transferCurve(dy, cfg.curve);
      const delta = shaped / baseSens;
      if (dragMode === 'mod') {
        modAmount = clamp(startVal + delta, modBipolar ? 0 : -1, 1);
        apply(value);
      } else {
        apply(startVal + delta);
      }
    });
    const release = (e) => {
      if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    };
    svg.addEventListener('pointerup', release);
    svg.addEventListener('pointercancel', release);

    svg.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.2 : (e.altKey ? 0.01 : 0.05);
      let nv = value;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') nv += step;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') nv -= step;
      else if (e.key === 'Home') nv = min;
      else if (e.key === 'End') nv = max;
      else if (e.key === 'PageUp') nv += step * 4;
      else if (e.key === 'PageDown') nv -= step * 4;
      else return;
      e.preventDefault();
      apply(nv);
    });

    svg.addEventListener('dblclick', (e) => {
      e.preventDefault();
      apply(isBi ? 0 : 0.5);
    });

    svg.addEventListener('wheel', (e) => {
      if (document.activeElement !== svg) return;
      e.preventDefault();
      const step = e.shiftKey ? 0.005 : 0.02;
      apply(value + (e.deltaY < 0 ? step : -step));
    }, { passive: false });
  };

  /* ============================================================
     TOGGLE BUTTONS — pill / square (independent on/off)
     ============================================================ */
  const initToggleButton = (el) => {
    if (el.dataset.wired || isStamped(el)) return;
    el.dataset.wired = '1';

    const onClass = el.classList.contains('pill') ? 'pill--on' : 'square--on';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-pressed', String(el.classList.contains(onClass)));

    const flip = () => {
      const on = el.classList.toggle(onClass);
      el.setAttribute('aria-pressed', String(on));
    };
    el.addEventListener('click', flip);
    el.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flip();
      }
    });
  };

  /* ============================================================
     RADIO GROUP helper — segmented, tabs, shape picker, .radio
     ============================================================ */
  const initRadioGroup = (group, itemSel, onClass) => {
    if (group.dataset.wired) return;
    group.dataset.wired = '1';
    group.setAttribute('role', 'radiogroup');

    const items = [...group.querySelectorAll(itemSel)];
    if (!items.length) return;

    const select = (idx) => {
      items.forEach((it, i) => {
        const on = i === idx;
        it.classList.toggle(onClass, on);
        it.setAttribute('aria-checked', String(on));
        it.setAttribute('tabindex', on ? '0' : '-1');
      });
      items[idx].focus();
    };

    items.forEach((it, idx) => {
      it.setAttribute('role', 'radio');
      const on = it.classList.contains(onClass);
      it.setAttribute('aria-checked', String(on));
      it.setAttribute('tabindex', on ? '0' : '-1');

      it.addEventListener('click', (e) => {
        e.preventDefault();
        select(idx);
      });
      it.addEventListener('keydown', (e) => {
        let target = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') target = (idx + 1) % items.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') target = (idx - 1 + items.length) % items.length;
        else if (e.key === 'Home') target = 0;
        else if (e.key === 'End') target = items.length - 1;
        else if (e.key === ' ' || e.key === 'Enter') target = idx;
        else return;
        e.preventDefault();
        select(target);
      });
    });

    if (!items.some((it) => it.classList.contains(onClass))) {
      items[0].setAttribute('tabindex', '0');
    }
  };

  /* === Tabs (role=tablist + tab) — same shape as radio === */
  const initTabs = (el) => {
    if (el.dataset.wired) return;
    el.dataset.wired = '1';
    el.setAttribute('role', 'tablist');

    const items = [...el.querySelectorAll('.tabs__item')];
    if (!items.length) return;

    const select = (idx) => {
      items.forEach((it, i) => {
        const on = i === idx;
        it.classList.toggle('tabs__item--on', on);
        it.setAttribute('aria-selected', String(on));
        it.setAttribute('tabindex', on ? '0' : '-1');
      });
      items[idx].focus();
    };

    items.forEach((it, idx) => {
      it.setAttribute('role', 'tab');
      const on = it.classList.contains('tabs__item--on');
      it.setAttribute('aria-selected', String(on));
      it.setAttribute('tabindex', on ? '0' : '-1');

      it.addEventListener('click', (e) => {
        e.preventDefault();
        select(idx);
      });
      it.addEventListener('keydown', (e) => {
        let target = -1;
        if (e.key === 'ArrowRight') target = (idx + 1) % items.length;
        else if (e.key === 'ArrowLeft') target = (idx - 1 + items.length) % items.length;
        else if (e.key === 'Home') target = 0;
        else if (e.key === 'End') target = items.length - 1;
        else if (e.key === ' ' || e.key === 'Enter') target = idx;
        else return;
        e.preventDefault();
        select(target);
      });
    });
  };

  /* ============================================================
     TOGGLE switch — flips .toggle--on
     ============================================================ */
  const initToggleSwitch = (el) => {
    if (el.dataset.wired || isStamped(el)) return;
    el.dataset.wired = '1';
    el.setAttribute('role', 'switch');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-checked', String(el.classList.contains('toggle--on')));

    const flip = () => {
      const on = el.classList.toggle('toggle--on');
      el.style.setProperty('--on', on ? '1' : '0');
      el.setAttribute('aria-checked', String(on));
    };
    el.addEventListener('click', flip);
    el.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flip();
      }
    });
  };

  /* ============================================================
     RADIO group — adjacent .radio inside a common parent
     ============================================================ */
  const initRadioCluster = (parent) => {
    if (parent.dataset.radioWired) return;
    const radios = [...parent.children].filter((c) => c.classList?.contains('radio'));
    if (radios.length < 2) return;
    parent.dataset.radioWired = '1';
    parent.setAttribute('role', 'radiogroup');

    const select = (idx) => {
      radios.forEach((r, i) => {
        const on = i === idx;
        r.classList.toggle('radio--on', on);
        r.setAttribute('aria-checked', String(on));
        r.setAttribute('tabindex', on ? '0' : '-1');
      });
      radios[idx].focus();
    };

    radios.forEach((r, idx) => {
      r.setAttribute('role', 'radio');
      const on = r.classList.contains('radio--on');
      r.setAttribute('aria-checked', String(on));
      r.setAttribute('tabindex', on ? '0' : '-1');

      r.addEventListener('click', (e) => {
        e.preventDefault();
        select(idx);
      });
      r.addEventListener('keydown', (e) => {
        let target = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') target = (idx + 1) % radios.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') target = (idx - 1 + radios.length) % radios.length;
        else if (e.key === ' ' || e.key === 'Enter') target = idx;
        else return;
        e.preventDefault();
        select(target);
      });
    });
  };

  /* ============================================================
     CHECK — independent toggle
     ============================================================ */
  const initCheck = (el) => {
    if (el.dataset.wired) return;
    el.dataset.wired = '1';
    el.setAttribute('role', 'checkbox');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-checked', String(el.classList.contains('check--on')));

    const flip = () => {
      const on = el.classList.toggle('check--on');
      el.setAttribute('aria-checked', String(on));
    };
    el.addEventListener('click', flip);
    el.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flip();
      }
    });
  };

  /* ============================================================
     STEP cell — toggle on/off in step-grid
     ============================================================ */
  const initStep = (el) => {
    if (el.dataset.wired) return;
    el.dataset.wired = '1';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-pressed', String(el.classList.contains('step--on')));

    const flip = () => {
      const on = el.classList.toggle('step--on');
      el.setAttribute('aria-pressed', String(on));
    };
    el.addEventListener('click', flip);
    el.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flip();
      }
    });
  };

  /* ============================================================
     XY pad — drag dot to set --x / --y (0..1)
     ============================================================ */
  const initXY = (el) => {
    if (el.dataset.wired) return;
    el.dataset.wired = '1';

    el.setAttribute('role', 'slider');
    el.setAttribute('aria-orientation', 'horizontal');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', 'XY parameter');

    const get = (p) => num(el.style.getPropertyValue(p), 0.5);
    const setXY = (x, y) => {
      x = clamp(x, 0, 1);
      y = clamp(y, 0, 1);
      el.style.setProperty('--x', x);
      el.style.setProperty('--y', y);
      el.setAttribute('aria-valuetext', `x ${x.toFixed(2)}, y ${y.toFixed(2)}`);
    };
    setXY(get('--x'), get('--y'));

    const posToXY = (e) => {
      const r = el.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
    };

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      const [x, y] = posToXY(e);
      setXY(x, y);
      el.focus();
    });
    el.addEventListener('pointermove', (e) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      const [x, y] = posToXY(e);
      setXY(x, y);
    });
    const release = (e) => {
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);

    el.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.2 : 0.05;
      let x = get('--x');
      let y = get('--y');
      let h = true;
      if (e.key === 'ArrowRight') x += step;
      else if (e.key === 'ArrowLeft') x -= step;
      else if (e.key === 'ArrowUp') y += step;
      else if (e.key === 'ArrowDown') y -= step;
      else h = false;
      if (h) {
        e.preventDefault();
        setXY(x, y);
      }
    });
  };

  /* ============================================================
     MINI KEYBOARD — click white/black key (mono active highlight)
     ============================================================ */
  const initKeys = (el) => {
    if (el.dataset.wired) return;
    el.dataset.wired = '1';

    const whites = [...el.querySelectorAll('.keys__white')];
    const blacks = [...el.querySelectorAll('.keys__black')];
    const all = [...whites, ...blacks];
    if (!all.length) return;

    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Mini keyboard');

    const trigger = (k) => {
      whites.forEach((w) => {
        w.classList.remove('keys__white--on');
        w.setAttribute('aria-pressed', 'false');
      });
      blacks.forEach((b) => {
        b.classList.remove('keys__black--on');
        b.setAttribute('aria-pressed', 'false');
      });
      const cls = k.classList.contains('keys__white') ? 'keys__white--on' : 'keys__black--on';
      k.classList.add(cls);
      k.setAttribute('aria-pressed', 'true');
    };

    all.forEach((k) => {
      k.setAttribute('role', 'button');
      k.setAttribute('tabindex', '0');
      const on = k.classList.contains('keys__white--on') || k.classList.contains('keys__black--on');
      k.setAttribute('aria-pressed', String(on));

      k.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        trigger(k);
        k.focus();
      });
      k.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          trigger(k);
        }
      });
    });
  };

  /* ============================================================
     MOD MATRIX — toggle cells (preserves prior value)
     ============================================================ */
  const initMatrix = (el) => {
    if (el.dataset.wired) return;
    el.dataset.wired = '1';

    const cells = [...el.querySelectorAll('.matrix__cell')].filter(
      (c) => !c.classList.contains('matrix__head') && !c.classList.contains('matrix__row-head')
    );

    cells.forEach((c) => {
      c.setAttribute('role', 'button');
      c.setAttribute('tabindex', '0');
      c.setAttribute('aria-pressed', String(c.classList.contains('matrix__cell--on')));
      c.dataset.savedValue = c.textContent.trim();

      const flip = () => {
        const on = c.classList.toggle('matrix__cell--on');
        c.setAttribute('aria-pressed', String(on));
        if (on) {
          c.textContent = c.dataset.savedValue !== '·' ? c.dataset.savedValue : '+0.5';
        } else {
          if (c.textContent.trim() !== '·') c.dataset.savedValue = c.textContent.trim();
          c.textContent = '\u00B7';
        }
      };
      c.addEventListener('click', flip);
      c.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          flip();
        }
      });
    });
  };

  /* ============================================================
     STEPPER — − / + buttons modify a numeric value
     ============================================================ */
  const initStepper = (el) => {
    if (el.dataset.wired) return;
    el.dataset.wired = '1';

    const btns = [...el.querySelectorAll('.stepper__btn')];
    const valEl = el.querySelector('.stepper__val');
    if (btns.length < 2 || !valEl) return;

    const [decBtn, incBtn] = btns;

    const parse = (s) => {
      const m = s.trim().match(/^([+\-\u2212]?)([\d.]+)(.*)$/);
      if (!m) return null;
      const sign = m[1] === '-' || m[1] === MINUS ? -1 : 1;
      return { sign, mag: parseFloat(m[2]), prefix: m[1], suffix: m[3] || '' };
    };

    const adjust = (delta) => {
      const cur = parse(valEl.textContent);
      if (!cur) return;
      const next = cur.sign * cur.mag + delta;
      const showSign = cur.prefix === '+' || cur.prefix === '-' || cur.prefix === MINUS;
      let text;
      if (showSign) {
        const s = next > 0 ? '+' : (next < 0 ? MINUS : '');
        text = s + Math.abs(next) + cur.suffix;
      } else {
        text = (next < 0 ? MINUS : '') + Math.abs(next) + cur.suffix;
      }
      valEl.textContent = text;
    };

    [decBtn, incBtn].forEach((b) => {
      b.setAttribute('role', 'button');
      b.setAttribute('tabindex', '0');
    });
    decBtn.setAttribute('aria-label', 'decrement');
    incBtn.setAttribute('aria-label', 'increment');

    decBtn.addEventListener('click', () => adjust(-1));
    incBtn.addEventListener('click', () => adjust(1));
    [decBtn, incBtn].forEach((b) => {
      b.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          b.click();
        }
      });
    });
  };

  /* ============================================================
     INIT — scan once on load
     ============================================================ */
  const init = () => {
    document.querySelectorAll('.slider-h, .slider-v').forEach(initSlider);
    document.querySelectorAll('.knob').forEach(initKnob);
    document.querySelectorAll('.pill, .square').forEach(initToggleButton);
    document.querySelectorAll('.segmented').forEach((g) =>
      initRadioGroup(g, '.segmented__item', 'segmented__item--on')
    );
    document.querySelectorAll('.tabs').forEach(initTabs);
    document.querySelectorAll('.toggle').forEach(initToggleSwitch);
    document.querySelectorAll('.shape-picker').forEach((g) =>
      initRadioGroup(g, '.shape-picker__btn', 'shape-picker__btn--on')
    );
    /* radio clusters live in .cell parents that group adjacent .radio elements */
    document.querySelectorAll('.radio').forEach((r) => {
      if (r.parentElement) initRadioCluster(r.parentElement);
    });
    document.querySelectorAll('.check').forEach(initCheck);
    document.querySelectorAll('.step').forEach(initStep);
    document.querySelectorAll('.xy').forEach(initXY);
    document.querySelectorAll('.keys').forEach(initKeys);
    document.querySelectorAll('.matrix').forEach(initMatrix);
    document.querySelectorAll('.stepper').forEach(initStepper);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
