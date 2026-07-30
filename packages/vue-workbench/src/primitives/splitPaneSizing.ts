import type {
  ResponsiveSplitPaneItem,
  ResponsiveSplitPaneOrientation
} from "./responsiveSplitPaneTypes.js";

export type SplitPaneSizes = Record<string, number>;

export type SplitPaneLayoutAnchor = {
  sizes: SplitPaneSizes;
};

export type SplitPaneDividerResult = {
  sizes: SplitPaneSizes;
  changedPaneIds: string[];
};

export type SplitPaneDividerRange = {
  min: number;
  now: number;
  max: number;
};

const EPSILON = 0.01;

export function createSplitPaneSizingSignature(panes: readonly ResponsiveSplitPaneItem[]) {
  return JSON.stringify(panes.map((pane) => ({
    id: pane.id,
    defaultSize: pane.defaultSize,
    defaultCompactSize: pane.defaultCompactSize,
    minSize: pane.minSize,
    maxSize: pane.maxSize,
    sizePriority: pane.sizePriority,
    growPriority: pane.growPriority,
    shrinkPriority: pane.shrinkPriority,
    grow: pane.grow
  })));
}

export function paneMinSize(pane: ResponsiveSplitPaneItem) {
  return finiteNonNegative(pane.minSize, 0);
}

export function paneMaxSize(pane: ResponsiveSplitPaneItem) {
  return Math.max(
    paneMinSize(pane),
    finiteNonNegative(pane.maxSize, Number.POSITIVE_INFINITY)
  );
}

export function paneDefaultSize(
  pane: ResponsiveSplitPaneItem,
  axis: ResponsiveSplitPaneOrientation
) {
  const requested = axis === "vertical"
    ? pane.defaultCompactSize ?? pane.defaultSize
    : pane.defaultSize;
  return clamp(
    finiteNonNegative(requested, paneMinSize(pane)),
    paneMinSize(pane),
    paneMaxSize(pane)
  );
}

export function reconcilePreferredSizes(
  panes: readonly ResponsiveSplitPaneItem[],
  current: Readonly<SplitPaneSizes>,
  axis: ResponsiveSplitPaneOrientation
) {
  return Object.fromEntries(panes.map((pane) => {
    const existing = current[pane.id];
    const size = Number.isFinite(existing)
      ? clamp(Number(existing), paneMinSize(pane), paneMaxSize(pane))
      : paneDefaultSize(pane, axis);
    return [pane.id, size];
  }));
}

export function resolvePaneSizes(
  panes: readonly ResponsiveSplitPaneItem[],
  preferred: Readonly<SplitPaneSizes>,
  availableSize: number,
  axis: ResponsiveSplitPaneOrientation,
  anchor?: SplitPaneLayoutAnchor | null
) {
  const preferredSizes = reconcilePreferredSizes(panes, preferred, axis);
  const sizes = anchor
    ? reconcilePreferredSizes(panes, anchor.sizes, axis)
    : { ...preferredSizes };
  const target = Math.max(0, availableSize);
  const current = sumSizes(panes, sizes);
  const delta = target - current;
  if (delta > EPSILON) {
    const restored = anchor
      ? restorePreferredSizes(sizes, preferredSizes, panes, delta)
      : 0;
    distributeGrowth(sizes, panes, delta - restored);
  } else if (delta < -EPSILON) {
    distributeShrink(sizes, panes, -delta);
  }
  return sizes;
}

function restorePreferredSizes(
  sizes: SplitPaneSizes,
  preferred: Readonly<SplitPaneSizes>,
  panes: readonly ResponsiveSplitPaneItem[],
  amount: number
) {
  let remaining = amount;
  const priorities = [...new Set(panes.map(paneShrinkPriority))].sort((a, b) => b - a);
  for (const priority of priorities) {
    if (remaining <= EPSILON) break;
    const candidates = panes.filter((pane) => (
      paneShrinkPriority(pane) === priority
      && (preferred[pane.id] ?? 0) > (sizes[pane.id] ?? 0) + EPSILON
    ));
    const capacity = candidates.reduce(
      (sum, pane) => sum + Math.max(0, (preferred[pane.id] ?? 0) - (sizes[pane.id] ?? 0)),
      0
    );
    if (capacity <= EPSILON) continue;
    const consumed = Math.min(remaining, capacity);
    for (const pane of candidates) {
      const paneCapacity = Math.max(0, (preferred[pane.id] ?? 0) - (sizes[pane.id] ?? 0));
      sizes[pane.id] = (sizes[pane.id] ?? 0) + consumed * (paneCapacity / capacity);
    }
    remaining -= consumed;
  }
  return amount - remaining;
}

export function applySplitPaneDividerDelta(
  panes: readonly ResponsiveSplitPaneItem[],
  startSizes: Readonly<SplitPaneSizes>,
  dividerIndex: number,
  delta: number
): SplitPaneDividerResult {
  const sizes = { ...startSizes };
  const before = panes.slice(0, dividerIndex + 1);
  const after = panes.slice(dividerIndex + 1);
  const beforeDirect = before.at(-1);
  const afterDirect = after[0];
  if (!beforeDirect || !afterDirect) {
    return { sizes, changedPaneIds: [] };
  }

  const growSide = delta >= 0 ? before : after;
  const shrinkSide = delta >= 0 ? after : before;
  const growDirect = delta >= 0 ? beforeDirect : afterDirect;
  const shrinkDirect = delta >= 0 ? afterDirect : beforeDirect;
  const growCandidates = orderedCascadeCandidates(growSide, growDirect, "grow");
  const shrinkCandidates = orderedCascadeCandidates(shrinkSide, shrinkDirect, "shrink");
  const requested = Math.abs(delta);
  const applied = Math.min(
    requested,
    growCandidates.reduce((sum, pane) => sum + capacityToGrow(pane, sizes), 0),
    shrinkCandidates.reduce((sum, pane) => sum + capacityToShrink(pane, sizes), 0)
  );
  applySequential(sizes, growCandidates, applied, "grow");
  applySequential(sizes, shrinkCandidates, applied, "shrink");

  return {
    sizes,
    changedPaneIds: panes
      .filter((pane) => Math.abs((sizes[pane.id] ?? 0) - (startSizes[pane.id] ?? 0)) > EPSILON)
      .map((pane) => pane.id)
  };
}

export function commitDividerPreferences(
  panes: readonly ResponsiveSplitPaneItem[],
  startPreferred: Readonly<SplitPaneSizes>,
  result: SplitPaneDividerResult,
  axis: ResponsiveSplitPaneOrientation
) {
  const next = reconcilePreferredSizes(panes, startPreferred, axis);
  for (const paneId of result.changedPaneIds) {
    const pane = panes.find((candidate) => candidate.id === paneId);
    if (pane) {
      next[paneId] = clamp(result.sizes[paneId] ?? next[paneId] ?? 0, paneMinSize(pane), paneMaxSize(pane));
    }
  }
  return next;
}

export function getSplitPaneDividerRange(
  panes: readonly ResponsiveSplitPaneItem[],
  sizes: Readonly<SplitPaneSizes>,
  dividerIndex: number
): SplitPaneDividerRange {
  const before = panes.slice(0, dividerIndex + 1);
  const after = panes.slice(dividerIndex + 1);
  const extent = sumSizes(panes, sizes);
  const beforeMin = sumBy(before, paneMinSize);
  const beforeMax = sumBy(before, paneMaxSize);
  const afterMin = sumBy(after, paneMinSize);
  const afterMax = sumBy(after, paneMaxSize);
  const min = Math.max(beforeMin, extent - afterMax);
  const max = Math.min(beforeMax, extent - afterMin);
  return {
    min: finiteBoundary(min, beforeMin),
    now: clamp(sumSizes(before, sizes), finiteBoundary(min, beforeMin), finiteBoundary(max, extent - afterMin)),
    max: finiteBoundary(max, extent - afterMin)
  };
}

function paneGrowPriority(pane: ResponsiveSplitPaneItem) {
  return finiteNumber(pane.growPriority, finiteNumber(pane.sizePriority, 0));
}

function paneShrinkPriority(pane: ResponsiveSplitPaneItem) {
  return finiteNumber(pane.shrinkPriority, finiteNumber(pane.sizePriority, 0));
}

function paneGrowWeight(pane: ResponsiveSplitPaneItem) {
  return Math.max(0, finiteNumber(pane.grow, 1));
}

function distributeGrowth(
  sizes: SplitPaneSizes,
  panes: readonly ResponsiveSplitPaneItem[],
  amount: number
) {
  let remaining = amount;
  const priorities = [...new Set(panes.map(paneGrowPriority))].sort((a, b) => b - a);
  for (const priority of priorities) {
    if (remaining <= EPSILON) break;
    let candidates = panes.filter((pane) => (
      paneGrowPriority(pane) === priority
      && paneGrowWeight(pane) > 0
      && (sizes[pane.id] ?? 0) < paneMaxSize(pane)
    ));
    while (remaining > EPSILON && candidates.length) {
      const totalWeight = candidates.reduce((sum, pane) => sum + paneGrowWeight(pane), 0);
      let consumed = 0;
      for (const pane of candidates) {
        const capacity = paneMaxSize(pane) - (sizes[pane.id] ?? 0);
        const share = remaining * (paneGrowWeight(pane) / totalWeight);
        const paneDelta = Math.min(capacity, share);
        sizes[pane.id] = (sizes[pane.id] ?? 0) + paneDelta;
        consumed += paneDelta;
      }
      if (consumed <= EPSILON) break;
      remaining -= consumed;
      candidates = candidates.filter((pane) => (sizes[pane.id] ?? 0) < paneMaxSize(pane) - EPSILON);
    }
  }
}

function distributeShrink(
  sizes: SplitPaneSizes,
  panes: readonly ResponsiveSplitPaneItem[],
  amount: number
) {
  let remaining = amount;
  const priorities = [...new Set(panes.map(paneShrinkPriority))].sort((a, b) => a - b);
  for (const priority of priorities) {
    if (remaining <= EPSILON) break;
    const candidates = panes.filter((pane) => (
      paneShrinkPriority(pane) === priority
      && (sizes[pane.id] ?? 0) > paneMinSize(pane)
    ));
    const capacity = candidates.reduce(
      (sum, pane) => sum + Math.max(0, (sizes[pane.id] ?? 0) - paneMinSize(pane)),
      0
    );
    if (capacity <= EPSILON) continue;
    const consumed = Math.min(remaining, capacity);
    for (const pane of candidates) {
      const paneCapacity = Math.max(0, (sizes[pane.id] ?? 0) - paneMinSize(pane));
      sizes[pane.id] = (sizes[pane.id] ?? 0) - consumed * (paneCapacity / capacity);
    }
    remaining -= consumed;
  }
}

function capacityToGrow(pane: ResponsiveSplitPaneItem, sizes: Readonly<SplitPaneSizes>) {
  return Math.max(0, paneMaxSize(pane) - (sizes[pane.id] ?? 0));
}

function capacityToShrink(pane: ResponsiveSplitPaneItem, sizes: Readonly<SplitPaneSizes>) {
  return Math.max(0, (sizes[pane.id] ?? 0) - paneMinSize(pane));
}

function orderedCascadeCandidates(
  panes: readonly ResponsiveSplitPaneItem[],
  directPane: ResponsiveSplitPaneItem,
  mode: "grow" | "shrink"
) {
  const rest = panes.filter((pane) => pane.id !== directPane.id);
  if (panes.at(-1)?.id === directPane.id) rest.reverse();
  rest.sort((a, b) => {
    const aPriority = mode === "grow" ? paneGrowPriority(a) : paneShrinkPriority(a);
    const bPriority = mode === "grow" ? paneGrowPriority(b) : paneShrinkPriority(b);
    return mode === "grow" ? bPriority - aPriority : aPriority - bPriority;
  });
  return [directPane, ...rest];
}

function applySequential(
  sizes: SplitPaneSizes,
  panes: readonly ResponsiveSplitPaneItem[],
  amount: number,
  mode: "grow" | "shrink"
) {
  let remaining = amount;
  for (const pane of panes) {
    if (remaining <= EPSILON) break;
    const capacity = mode === "grow" ? capacityToGrow(pane, sizes) : capacityToShrink(pane, sizes);
    const paneDelta = Math.min(remaining, capacity);
    sizes[pane.id] = (sizes[pane.id] ?? 0) + (mode === "grow" ? paneDelta : -paneDelta);
    remaining -= paneDelta;
  }
}

function sumSizes(panes: readonly ResponsiveSplitPaneItem[], sizes: Readonly<SplitPaneSizes>) {
  return panes.reduce((sum, pane) => sum + (sizes[pane.id] ?? 0), 0);
}

function sumBy(
  panes: readonly ResponsiveSplitPaneItem[],
  resolve: (pane: ResponsiveSplitPaneItem) => number
) {
  return panes.reduce((sum, pane) => sum + resolve(pane), 0);
}

function finiteBoundary(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function finiteNumber(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function finiteNonNegative(value: number | undefined, fallback: number) {
  return Math.max(0, finiteNumber(value, fallback));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
