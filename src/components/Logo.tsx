// House Money symbol: a roof over a sunrise (see docs/brand.md).
export function Logo({ size = 32, tile = "#16233F", roof = "#F5F3EE" }: { size?: number; tile?: string; roof?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="28" fill={tile} />
      <path d="M20 78 A30 30 0 0 1 80 78 Z" fill="#C4442E" />
      <path d="M34 78 A16 16 0 0 1 66 78 Z" fill="#FFD65C" />
      <rect x="16" y="78" width="68" height="3.5" rx="1.75" fill={roof} />
      <polyline points="29,40 50,23 71,40" fill="none" stroke={roof} strokeWidth="6" />
    </svg>
  );
}
