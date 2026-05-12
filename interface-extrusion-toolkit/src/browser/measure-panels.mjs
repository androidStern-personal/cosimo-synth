export const DEFAULT_SECTION_SHAPE_POLICY = Object.freeze({
  requireAxisAligned: true,
  rejectClipPath: true,
  rejectPercentOrEllipticalRadius: true,
});

export function assertFiniteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number; got ${String(value)}`);
  }
}

export function splitCssRadiusTokens(value) {
  return String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function parseCircularPxRadius(value, panelId, cornerName) {
  const raw = String(value ?? '').trim();
  if (raw === '') return { x: 0, y: 0 };
  if (raw.includes('%')) {
    throw new Error(
      `Unsupported radius for panel "${panelId}" ${cornerName}: v1 supports only circular px radii, got ${raw}`
    );
  }
  if (raw.includes('/')) {
    throw new Error(
      `Unsupported radius for panel "${panelId}" ${cornerName}: v1 does not support slash/elliptical radii, got ${raw}`
    );
  }

  const tokens = splitCssRadiusTokens(raw);
  if (tokens.length === 0) return { x: 0, y: 0 };
  if (tokens.length > 2) {
    throw new Error(
      `Unsupported radius for panel "${panelId}" ${cornerName}: expected one px value or two equal px values, got ${raw}`
    );
  }

  const nums = tokens.map((token) => {
    if (!/^-?\d*\.?\d+px$/.test(token)) {
      throw new Error(
        `Unsupported radius for panel "${panelId}" ${cornerName}: v1 supports only px radii, got ${raw}`
      );
    }
    const n = Number.parseFloat(token);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(
        `Unsupported radius for panel "${panelId}" ${cornerName}: radius must be non-negative, got ${raw}`
      );
    }
    return n;
  });

  const x = nums[0];
  const y = nums.length === 2 ? nums[1] : nums[0];
  if (Math.abs(x - y) > 1e-6) {
    throw new Error(
      `Unsupported radius for panel "${panelId}" ${cornerName}: v1 supports only circular radii, got ${raw}`
    );
  }
  return { x, y };
}

export function clampCornerRadius(radius, width, height) {
  const max = Math.max(0, Math.min(width, height) / 2);
  return {
    x: Math.min(Math.max(0, radius.x), max),
    y: Math.min(Math.max(0, radius.y), max),
  };
}

export function normalizePanelRect(panel) {
  for (const key of ['x', 'y', 'width', 'height']) {
    assertFiniteNumber(panel[key], `panel ${panel.id}.${key}`);
  }
  if (panel.width <= 0 || panel.height <= 0) {
    throw new Error(`panel "${panel.id}" must have positive width and height`);
  }

  const radii = panel.radii ?? {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 0, y: 0 },
    bottomRight: { x: 0, y: 0 },
    bottomLeft: { x: 0, y: 0 },
  };

  return {
    id: String(panel.id),
    x: panel.x,
    y: panel.y,
    width: panel.width,
    height: panel.height,
    radii: {
      topLeft: clampCornerRadius(radii.topLeft, panel.width, panel.height),
      topRight: clampCornerRadius(radii.topRight, panel.width, panel.height),
      bottomRight: clampCornerRadius(radii.bottomRight, panel.width, panel.height),
      bottomLeft: clampCornerRadius(radii.bottomLeft, panel.width, panel.height),
    },
  };
}

export function assertPanelInsideRoot(panel, rootWidth, rootHeight) {
  const eps = 0.5;
  if (panel.x < -eps || panel.y < -eps) {
    throw new Error(`panel "${panel.id}" starts outside the capture root`);
  }
  if (panel.x + panel.width > rootWidth + eps || panel.y + panel.height > rootHeight + eps) {
    throw new Error(`panel "${panel.id}" exceeds capture root bounds`);
  }
}

export function makeBrowserMeasurementFunctionSource() {
  // This source is intentionally standalone so it can be stringified into page.evaluate.
  return function measureInPage(args) {
    const { rootSelector, sections } = args;
    const root = document.querySelector(rootSelector);
    if (!root) throw new Error(`Missing capture root: ${rootSelector}`);

    const rootRect = root.getBoundingClientRect();
    const rootStyle = getComputedStyle(root);
    const rootOverflow = `${rootStyle.overflow} ${rootStyle.overflowX} ${rootStyle.overflowY}`;
    if (/scroll|auto/i.test(rootOverflow)) {
      throw new Error(
        `Capture root ${rootSelector} must be fixed-size and non-scrollable; got overflow=${rootOverflow}`
      );
    }

    function parseCircularPxRadius(raw, panelId, cornerName) {
      raw = String(raw || '').trim();
      if (!raw) return { x: 0, y: 0 };
      if (raw.includes('%') || raw.includes('/')) {
        throw new Error(
          `Unsupported radius for panel "${panelId}" ${cornerName}: v1 supports only circular px radii, got ${raw}`
        );
      }
      const tokens = raw.split(/\s+/).filter(Boolean);
      if (tokens.length > 2) {
        throw new Error(
          `Unsupported radius for panel "${panelId}" ${cornerName}: expected one px value or two equal px values, got ${raw}`
        );
      }
      const nums = tokens.map((token) => {
        if (!/^-?\d*\.?\d+px$/.test(token)) {
          throw new Error(
            `Unsupported radius for panel "${panelId}" ${cornerName}: v1 supports only px radii, got ${raw}`
          );
        }
        const n = Number.parseFloat(token);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error(
            `Unsupported radius for panel "${panelId}" ${cornerName}: radius must be non-negative, got ${raw}`
          );
        }
        return n;
      });
      const x = nums[0] || 0;
      const y = nums.length === 2 ? nums[1] : x;
      if (Math.abs(x - y) > 1e-6) {
        throw new Error(
          `Unsupported radius for panel "${panelId}" ${cornerName}: v1 supports only circular radii, got ${raw}`
        );
      }
      return { x, y };
    }

    function clamp(radius, width, height) {
      const max = Math.max(0, Math.min(width, height) / 2);
      return { x: Math.min(radius.x, max), y: Math.min(radius.y, max) };
    }

    function hasForbiddenTransform(el, id) {
      const style = getComputedStyle(el);
      const transform = style.transform || 'none';
      if (transform !== 'none') {
        // v1 rejects any CSS transform. This is stricter than only rejecting rotate/skew,
        // but safer for deterministic coordinate matching.
        throw new Error(`Panel "${id}" has CSS transform (${transform}); v1 supports only untransformed axis-aligned rectangles`);
      }
      const clipPath = style.clipPath || style.webkitClipPath || 'none';
      if (clipPath && clipPath !== 'none') {
        throw new Error(`Panel "${id}" has clip-path (${clipPath}); v1 does not support clip-path sections`);
      }
    }

    const measured = sections.map((section) => {
      const matches = Array.from(root.querySelectorAll(section.selector));
      if (matches.length !== 1) {
        throw new Error(`Expected exactly one element for section "${section.id}" selector ${section.selector}, found ${matches.length}`);
      }
      const el = matches[0];
      hasForbiddenTransform(el, section.id);
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const panel = {
        id: section.id,
        x: rect.left - rootRect.left,
        y: rect.top - rootRect.top,
        width: rect.width,
        height: rect.height,
        radii: {
          topLeft: parseCircularPxRadius(style.borderTopLeftRadius, section.id, 'topLeft'),
          topRight: parseCircularPxRadius(style.borderTopRightRadius, section.id, 'topRight'),
          bottomRight: parseCircularPxRadius(style.borderBottomRightRadius, section.id, 'bottomRight'),
          bottomLeft: parseCircularPxRadius(style.borderBottomLeftRadius, section.id, 'bottomLeft'),
        },
      };
      for (const [corner, radius] of Object.entries(panel.radii)) {
        panel.radii[corner] = clamp(radius, panel.width, panel.height);
      }
      if (panel.width <= 0 || panel.height <= 0) {
        throw new Error(`Panel "${section.id}" has non-positive size`);
      }
      if (panel.x < -0.5 || panel.y < -0.5 || panel.x + panel.width > rootRect.width + 0.5 || panel.y + panel.height > rootRect.height + 0.5) {
        throw new Error(`Panel "${section.id}" is outside the capture root`);
      }
      return panel;
    });

    return {
      cssWidth: rootRect.width,
      cssHeight: rootRect.height,
      sections: measured,
    };
  };
}
