/**
 * Not a government well ID — a readable grid reference derived from real
 * coordinates, used only so the UI has something to call the selected point.
 */
export function siteLabel(lat: number, lon: number): string {
  return `SITE ${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}
