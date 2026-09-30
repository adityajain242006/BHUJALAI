import { useEffect, useState, useCallback, useRef, memo } from "react";
import { MapContainer, TileLayer, CircleMarker, Pane, useMap } from "react-leaflet";
import L, { type LeafletMouseEvent } from "leaflet";
import { motion } from "framer-motion";
import { Layers, Locate, RotateCcw, Check } from "lucide-react";
import type { Cell, Tile, MonitoringWell } from "../types";
import { DECISION_META } from "../lib/decision";
import { describeTrend } from "../lib/geo";
import { MapLegend } from "./ui";
import { siteLabel } from "../lib/site";

// Greater Bengaluru: city + outskirts (Hoskote, Devanahalli, Doddaballapur, Nelamangala, Anekal)
const CENTER: [number, number] = [13.0, 77.62];
const ZOOM = 10;
const WELL_COLOR = "#2a6a94";

interface FlyTarget {
  point: [number, number];
  zoom: number;
  nonce: number; // lets "reset" re-fire even if the target point hasn't changed
}

type Hover =
  | { kind: "cell"; cell: Cell; x: number; y: number }
  | { kind: "well"; well: MonitoringWell; x: number; y: number }
  | null;

function FlyTo({ target }: { target: FlyTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target.point, target.zoom, { duration: 0.6 });
  }, [target, map]);
  return null;
}

export function MapView({
  tile,
  wells,
  selected,
  onSelect,
}: {
  tile: Tile;
  wells: MonitoringWell[];
  selected: Cell | null;
  onSelect: (cell: Cell) => void;
}) {
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  const [hover, setHover] = useState<Hover>(null);
  const [showWells, setShowWells] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (cell: Cell) => {
      onSelect(cell);
      setFlyTarget({ point: [cell.lat, cell.lon], zoom: 13, nonce: Date.now() });
    },
    [onSelect]
  );

  return (
    <div ref={wrapperRef} className="relative h-full w-full overflow-hidden rounded-2xl border border-[var(--color-border)]">
      <MapContainer center={CENTER} zoom={ZOOM} minZoom={9} className="h-full w-full" preferCanvas zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="bhujal-basemap"
        />
        <FlyTo target={flyTarget} />
        <SiteMarkers cells={tile.cells} onSelect={handleSelect} onHover={setHover} />
        {showWells && (
          <Pane name="monitoring-wells" style={{ zIndex: 450 }}>
            <WellMarkers wells={wells} onHover={setHover} />
          </Pane>
        )}
        {selected && <SelectedMarker cell={selected} />}
      </MapContainer>

      {hover && <HoverCard hover={hover} containerWidth={wrapperRef.current?.clientWidth ?? 800} />}

      {/* floating controls — the wrapper ignores pointer events so the map stays draggable underneath */}
      <div className="pointer-events-none absolute inset-0 z-[1000] flex flex-col justify-between p-3">
        <div className="flex items-start justify-between">
          <div className="pointer-events-auto">
            <MapLegend showWells={showWells && wells.length > 0} />
          </div>
          <div className="pointer-events-auto">
            <LayerSelector
              showWells={showWells}
              wellCount={wells.length}
              onToggleWells={() => setShowWells((s) => !s)}
            />
          </div>
        </div>
        <div className="pointer-events-auto flex justify-end gap-2 self-end">
          <ControlButton
            icon={<RotateCcw size={15} />}
            label="Reset view"
            onClick={() => setFlyTarget({ point: CENTER, zoom: ZOOM, nonce: Date.now() })}
          />
          <ControlButton icon={<Locate size={15} />} label="Locate me" onClick={() => {}} disabled />
        </div>
      </div>
    </div>
  );
}

/**
 * All grid markers (~6,500 at 1 km over greater Bengaluru). Memoized on props that
 * never change after load, so hover/selection state in MapView doesn't re-render
 * thousands of markers. One shared <HoverCard> replaces per-marker tooltips, which
 * would mean thousands of bound tooltip instances.
 */
const SiteMarkers = memo(function SiteMarkers({
  cells,
  onSelect,
  onHover,
}: {
  cells: Cell[];
  onSelect: (cell: Cell) => void;
  onHover: (h: Hover) => void;
}) {
  return (
    <>
      {cells.map((cell, i) => {
        const meta = DECISION_META[cell.decision];
        return (
          <CircleMarker
            key={i}
            center={[cell.lat, cell.lon]}
            radius={3}
            pathOptions={{ color: meta.color, fillColor: meta.color, fillOpacity: 0.55, weight: 1 }}
            eventHandlers={{
              click: () => onSelect(cell),
              mouseover: (e: LeafletMouseEvent) => {
                e.target.setRadius(5.5);
                onHover({ kind: "cell", cell, x: e.containerPoint.x, y: e.containerPoint.y });
              },
              mouseout: (e: LeafletMouseEvent) => {
                e.target.setRadius(3);
                onHover(null);
              },
            }}
          />
        );
      })}
    </>
  );
});

const WellMarkers = memo(function WellMarkers({
  wells,
  onHover,
}: {
  wells: MonitoringWell[];
  onHover: (h: Hover) => void;
}) {
  const show = (w: MonitoringWell) => (e: LeafletMouseEvent) =>
    onHover({ kind: "well", well: w, x: e.containerPoint.x, y: e.containerPoint.y });
  return (
    <>
      {wells.map((w) => (
        <CircleMarker
          key={`${w.station}-${w.lat}-${w.lon}`}
          center={[w.lat, w.lon]}
          radius={5}
          pathOptions={{ color: "#ffffff", weight: 1.5, fillColor: WELL_COLOR, fillOpacity: 0.95 }}
          eventHandlers={{ mouseover: show(w), click: show(w), mouseout: () => onHover(null) }}
        />
      ))}
    </>
  );
});

function HoverCard({ hover, containerWidth }: { hover: NonNullable<Hover>; containerWidth: number }) {
  // flip to the left of the pointer near the right edge so the card isn't clipped
  const flip = hover.x > containerWidth - 260;
  const style = flip
    ? { right: containerWidth - hover.x + 14, top: hover.y - 10 }
    : { left: hover.x + 14, top: hover.y - 10 };
  return (
    <div
      className="pointer-events-none absolute z-[1100] max-w-[240px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs shadow-md"
      style={style}
      role="tooltip"
    >
      {hover.kind === "cell" ? (
        <CellHoverBody cell={hover.cell} />
      ) : (
        <WellHoverBody well={hover.well} />
      )}
    </div>
  );
}

function CellHoverBody({ cell }: { cell: Cell }) {
  const meta = DECISION_META[cell.decision];
  return (
    <>
      <div className="font-semibold text-[var(--color-ink)]">{siteLabel(cell.lat, cell.lon)}</div>
      {cell.district && <div className="text-[var(--color-ink-muted)]">{cell.district}</div>}
      <div className="mt-0.5" style={{ color: meta.color }}>
        {meta.symbol} {meta.label}
        {cell.decision !== "INSUFFICIENT_DATA" &&
          ` · ${Math.round(cell.success_probability * 100)}% success probability`}
      </div>
    </>
  );
}

function WellHoverBody({ well }: { well: MonitoringWell }) {
  const trend = describeTrend(well.trend_m_per_year);
  return (
    <>
      <div className="flex items-center gap-1.5 font-semibold text-[var(--color-ink)]">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: WELL_COLOR }} />
        {well.village || well.station}
      </div>
      <div className="text-[var(--color-ink-muted)]">
        Govt. monitoring {well.well_type ? well.well_type.toLowerCase() : "well"} · {well.district}
      </div>
      <div className="mt-1 space-y-0.5 text-[var(--color-ink)]">
        {well.recent_depth_to_water_m != null && (
          <div>Water found at ~{well.recent_depth_to_water_m.toFixed(1)} m (recent)</div>
        )}
        {well.pre_monsoon_depth_m != null && well.post_monsoon_depth_m != null && (
          <div>
            Summer {well.pre_monsoon_depth_m.toFixed(1)} m → after monsoon {well.post_monsoon_depth_m.toFixed(1)} m
          </div>
        )}
        {trend && (
          <div style={{ color: trend.worrying ? "var(--color-avoid)" : "var(--color-drill)" }}>{trend.text}</div>
        )}
        {well.well_depth_m != null && <div>Well depth {well.well_depth_m.toFixed(0)} m</div>}
      </div>
      <div className="mt-1 text-[10px] text-[var(--color-ink-muted)]">
        CGWB readings {well.first_year}–{well.last_year}
      </div>
    </>
  );
}

// The grid uses the canvas renderer (fast for thousands of points), but canvas paths
// can't take CSS classes — so the single selection ring gets its own SVG renderer
// to allow a subtle CSS pulse.
const svgRenderer = L.svg();

function SelectedMarker({ cell }: { cell: Cell }) {
  const color = DECISION_META[cell.decision].color;
  return (
    <>
      <CircleMarker
        center={[cell.lat, cell.lon]}
        radius={14}
        interactive={false}
        pathOptions={{
          color,
          weight: 2,
          fillOpacity: 0.12,
          fillColor: color,
          className: "bhujal-selected-ring",
          renderer: svgRenderer,
        }}
      />
      <CircleMarker
        center={[cell.lat, cell.lon]}
        radius={7}
        interactive={false}
        pathOptions={{ color: "#ffffff", weight: 2.5, fillColor: color, fillOpacity: 1 }}
      />
    </>
  );
}

function ControlButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? `${label} (not available in this prototype)` : label}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm ${
        disabled ? "cursor-not-allowed opacity-40" : "text-[var(--color-ink)] hover:text-[var(--color-primary)]"
      }`}
    >
      {icon}
    </motion.button>
  );
}

/**
 * Suitability and Monitoring wells are backed by real data. The rest are listed so
 * the intended product shape is visible, but disabled rather than faked.
 */
function LayerSelector({
  showWells,
  wellCount,
  onToggleWells,
}: {
  showWells: boolean;
  wellCount: number;
  onToggleWells: () => void;
}) {
  const [open, setOpen] = useState(false);
  const unavailable = ["Terrain", "Rainfall", "Geology"];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium text-[var(--color-ink)] shadow-sm"
      >
        <Layers size={14} /> Layers
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-60 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-sm shadow-lg">
          <div className="flex items-center justify-between rounded-lg bg-[var(--color-soft-green)] px-2.5 py-1.5 font-semibold">
            Suitability <span className="text-[10px] font-normal">always on</span>
          </div>
          <button
            onClick={onToggleWells}
            disabled={wellCount === 0}
            aria-pressed={showWells}
            className="mt-1 flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--color-soft-green)]/60 disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: WELL_COLOR }} />
              Monitoring wells <span className="text-[10px] text-[var(--color-ink-muted)]">({wellCount})</span>
            </span>
            {showWells && <Check size={14} className="text-[var(--color-primary)]" />}
          </button>
          <div className="mt-1 border-t border-[var(--color-border)] pt-1.5">
            {unavailable.map((u) => (
              <div
                key={u}
                title="No data for this layer in the current district file"
                className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[var(--color-ink-muted)] opacity-50"
              >
                {u} <span className="text-[10px]">not in dataset</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
