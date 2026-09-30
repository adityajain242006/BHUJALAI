import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import type { Mesh } from "three";
import { Droplets, RotateCcw } from "lucide-react";

/**
 * Animated drilling cross-section: a drill bores from the surface down to the
 * site's predicted depth, then water appears with the expected yield.
 *
 * What is data vs. illustration:
 *  - Drilling depth and yield: the model's prediction for this site.
 *  - Dashed "nearby wells" line: real average depth of known wells within 500 m.
 *  - Rock layers: a generic Bengaluru hard-rock profile. There is no per-site
 *    geology in the dataset, so the layers are labelled as illustrative.
 *
 * Readouts (depth counter, water/yield) live in the DOM header, not in 3D — in-scene
 * text is kept to short labels, all drawn on top with depthTest off so they never
 * z-fight with the rock faces they sit on.
 */

const SCENE_HEIGHT = 3.6;
const SLAB_WIDTH = 3.6;
const SLAB_THICKNESS = 1;
const FRONT_Z = SLAB_THICKNESS / 2;
const SHAFT_X = 0.35;
const DRILL_DURATION_MS = 3600;

// Illustrative generic profile, in metres below ground.
const LAYERS = [
  { name: "Topsoil", from: 0, to: 3, color: "#8a6644", text: "#ffffff" },
  { name: "Weathered rock", from: 3, to: 30, color: "#c9a57a", text: "#3d2e1f" },
  { name: "Fractured hard rock", from: 30, to: Infinity, color: "#a9aca5", text: "#2c3430" },
];

interface Props {
  depthM: number;
  yieldLpm: number;
  avgNearbyDepthM: number | null;
}

export function Terrain3D({ depthM, yieldLpm, avgNearbyDepthM }: Props) {
  const [progress, setProgress] = useState(0);
  const [runId, setRunId] = useState(0);

  // Scale so the target (or the nearby-wells line, if deeper) sits ~80% of the way down.
  const deepest = Math.max(depthM, avgNearbyDepthM ?? 0);
  const maxM = Math.ceil((deepest * 1.25) / 50) * 50;

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setProgress(1);
      return;
    }
    setProgress(0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / DRILL_DURATION_MS, 1);
      setProgress(1 - (1 - t) * (1 - t)); // ease-out: fast start, slows as it nears depth
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [runId, depthM]);

  const currentDepth = progress * depthM;
  const done = progress >= 1;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* header strip — all live readouts are plain DOM, never overlapping the scene */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-3 py-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            {done ? "Target depth reached" : "Drilling…"}
          </div>
          <div className="font-display text-lg font-extrabold tabular-nums text-[var(--color-primary)]">
            {currentDepth.toFixed(0)}
            <span className="text-sm font-medium text-[var(--color-ink-muted)]"> / {depthM.toFixed(0)} m</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 rounded-full bg-[#e3eef5] px-2.5 py-1 text-xs font-semibold text-[#2a6a94] transition-opacity duration-300 ${
              done ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={!done}
          >
            <Droplets size={13} /> ~{yieldLpm.toFixed(0)} L/min
          </div>
          <button
            onClick={() => setRunId((r) => r + 1)}
            aria-label="Replay drilling animation"
            className="flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink)] hover:text-[var(--color-primary)]"
          >
            <RotateCcw size={12} /> Replay
          </button>
        </div>
      </div>

      <div className="h-72 w-full bg-gradient-to-b from-[#eef4ef] to-[var(--color-canvas)]">
        <Canvas camera={{ position: [0.9, -0.9, 7.4], fov: 38 }} dpr={[1, 1.5]}>
          <ambientLight intensity={1.1} />
          <directionalLight position={[2, 4, 5]} intensity={0.55} />
          {/* <Text> suspends while its font loads — contain that inside the canvas */}
          <Suspense fallback={null}>
            <Scene
              maxM={maxM}
              depthM={depthM}
              currentDepth={currentDepth}
              done={done}
              avgNearbyDepthM={avgNearbyDepthM}
            />
          </Suspense>
          <OrbitControls
            target={[0.4, -SCENE_HEIGHT / 2 + 0.3, 0]}
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 2 - 0.25}
            maxPolarAngle={Math.PI / 2 + 0.2}
            minAzimuthAngle={-0.35}
            maxAzimuthAngle={0.35}
          />
        </Canvas>
      </div>
    </div>
  );
}

function Scene({
  maxM,
  depthM,
  currentDepth,
  done,
  avgNearbyDepthM,
}: {
  maxM: number;
  depthM: number;
  currentDepth: number;
  done: boolean;
  avgNearbyDepthM: number | null;
}) {
  const toY = (m: number) => -(m / maxM) * SCENE_HEIGHT;
  const tickStep = maxM <= 200 ? 50 : 100;
  const ticks: number[] = [];
  for (let m = 0; m <= maxM; m += tickStep) ticks.push(m);

  const tipY = toY(currentDepth);
  const shaftLength = Math.max(-tipY, 0.001);
  const leftInner = -SLAB_WIDTH / 2 + 0.12;

  return (
    <group>
      {/* grass strip */}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[SLAB_WIDTH, 0.06, SLAB_THICKNESS]} />
        <meshStandardMaterial color="#4f7f5f" />
      </mesh>

      {/* strata — thin top layers get a minimum visual thickness so they stay readable */}
      {LAYERS.map((layer) => {
        const top = toY(layer.from);
        const bottom = Math.min(toY(Math.min(layer.to, maxM)), top - 0.16);
        const h = top - bottom;
        return (
          <group key={layer.name}>
            <mesh position={[0, top - h / 2, 0]}>
              <boxGeometry args={[SLAB_WIDTH, h, SLAB_THICKNESS]} />
              <meshStandardMaterial color={layer.color} />
            </mesh>
            {/* label sits inside the layer's own face — can't run off-frame */}
            <Label position={[leftInner, top - Math.min(h / 2, 0.14), FRONT_Z]} anchorX="left" color={layer.text} size={0.1}>
              {layer.name}
            </Label>
          </group>
        );
      })}

      {/* fracture lines in hard rock — where groundwater actually sits in this terrain */}
      {[0.3, 0.5, 0.68, 0.86].map((f, i) => (
        <mesh
          key={i}
          position={[i % 2 ? -0.5 : 0.3, toY(maxM * f), FRONT_Z + 0.003]}
          rotation={[0, 0, i % 2 ? 0.07 : -0.05]}
        >
          <planeGeometry args={[SLAB_WIDTH * 0.62, 0.02]} />
          <meshBasicMaterial color="#6f8391" />
        </mesh>
      ))}

      {/* depth scale, outside the slab on the right */}
      {ticks.map((m) => (
        <group key={m}>
          <mesh position={[SLAB_WIDTH / 2 + 0.07, toY(m), FRONT_Z]}>
            <planeGeometry args={[0.12, 0.014]} />
            <meshBasicMaterial color="#5b655e" />
          </mesh>
          <Label position={[SLAB_WIDTH / 2 + 0.18, toY(m), FRONT_Z]} anchorX="left" color="#5b655e" size={0.11}>
            {`${m} m`}
          </Label>
        </group>
      ))}

      {/* real average depth of nearby wells — label on the left, away from the shaft */}
      {avgNearbyDepthM != null && (
        <group position={[0, toY(avgNearbyDepthM), FRONT_Z + 0.004]}>
          {Array.from({ length: 12 }).map((_, i) => (
            <mesh key={i} position={[-SLAB_WIDTH / 2 + 0.15 + i * 0.3, 0, 0]}>
              <planeGeometry args={[0.16, 0.025]} />
              <meshBasicMaterial color="#1f4d3a" />
            </mesh>
          ))}
          <Label position={[leftInner, 0.1, 0]} anchorX="left" color="#1f4d3a" size={0.1}>
            {`Nearby wells avg ~${avgNearbyDepthM.toFixed(0)} m`}
          </Label>
        </group>
      )}

      {/* drilling rig on the surface */}
      <mesh position={[SHAFT_X, 0.32, 0]}>
        <boxGeometry args={[0.07, 0.64, 0.07]} />
        <meshStandardMaterial color="#1f4d3a" />
      </mesh>
      <mesh position={[SHAFT_X, 0.64, 0]}>
        <boxGeometry args={[0.44, 0.05, 0.05]} />
        <meshStandardMaterial color="#1f4d3a" />
      </mesh>

      {/* bore shaft, set just behind the front face so it reads as cut into the rock */}
      <mesh position={[SHAFT_X, -shaftLength / 2, FRONT_Z - 0.06]}>
        <cylinderGeometry args={[0.055, 0.055, shaftLength, 12]} />
        <meshStandardMaterial color="#2c3430" />
      </mesh>
      <DrillBit position={[SHAFT_X, tipY, FRONT_Z - 0.06]} spinning={!done} />

      {done && <WaterPocket position={[SHAFT_X, toY(depthM), FRONT_Z - 0.06]} />}
    </group>
  );
}

function DrillBit({ position, spinning }: { position: [number, number, number]; spinning: boolean }) {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current && spinning) ref.current.rotation.y += dt * 10;
  });
  return (
    <mesh ref={ref} position={position} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[0.1, 0.24, 6]} />
      <meshStandardMaterial color="#c9862a" metalness={0.4} roughness={0.4} />
    </mesh>
  );
}

function WaterPocket({ position }: { position: [number, number, number] }) {
  const ref = useRef<Mesh>(null);
  const born = useRef(performance.now());
  useFrame(() => {
    if (!ref.current) return;
    const age = (performance.now() - born.current) / 1000;
    const grow = Math.min(age / 0.6, 1);
    const pulse = 1 + Math.sin(age * 3) * 0.05;
    ref.current.scale.setScalar(grow * pulse);
  });
  return (
    <mesh ref={ref} position={position} scale={0}>
      <sphereGeometry args={[0.22, 24, 24]} />
      <meshStandardMaterial color="#3b82b0" transparent opacity={0.8} emissive="#2a6a94" emissiveIntensity={0.35} />
    </mesh>
  );
}

/**
 * In-scene SDF text (drei <Text>), drawn with depthTest off and a high renderOrder so
 * it always renders on top of the rock face it sits on — no z-fighting flicker.
 * Deliberately not drei <Html>, which mounts a separate React root per label and
 * logs unmount errors under React 19.
 */
function Label({
  children,
  position,
  anchorX,
  color,
  size,
}: {
  children: string;
  position: [number, number, number];
  anchorX: "left" | "right";
  color: string;
  size: number;
}) {
  return (
    <Text
      position={[position[0], position[1], position[2] + 0.01]}
      fontSize={size}
      anchorX={anchorX}
      anchorY="middle"
      color={color}
      renderOrder={10}
      material-depthTest={false}
      material-toneMapped={false}
    >
      {children}
    </Text>
  );
}
