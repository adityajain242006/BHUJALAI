import { Droplets, Settings } from "lucide-react";
import { OfflineStatus } from "./ui";

export type Tab = "explore" | "insights" | "groundwater";

const TABS: { id: Tab; label: string }[] = [
  { id: "explore", label: "Explore" },
  { id: "insights", label: "Insights" },
  { id: "groundwater", label: "Groundwater" },
];

export function Navbar({
  activeTab,
  onTabChange,
  offline,
}: {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
  offline: { loading: boolean; fromCache: boolean; syncedAt: number | null; error: string | null };
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-canvas)]/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]">
            <Droplets size={17} className="text-white" strokeWidth={2.2} />
          </div>
          <span className="font-display text-lg font-bold text-[var(--color-ink)]">
            Bhujal <span className="text-[var(--color-primary)]">AI</span>
          </span>
        </div>

        <nav className="hidden gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1 sm:flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <OfflineStatus {...offline} />
          </div>
          <button
            aria-label="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-ink-muted)] transition hover:bg-[var(--color-soft-green)] hover:text-[var(--color-ink)]"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* mobile tabs */}
      <div className="flex gap-1 overflow-x-auto border-t border-[var(--color-border)] px-4 py-2 sm:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ${
              activeTab === t.id
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface)] text-[var(--color-ink-muted)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </header>
  );
}
