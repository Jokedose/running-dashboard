import logoUrl from "../assets/10k-runner-logo.jpg";

export function BrandLogo({ compact = false, wide = false }: { compact?: boolean; wide?: boolean }) {
  const className = wide ? "brand-logo wide" : compact ? "brand-logo compact" : "brand-logo";
  return (
    <div className={className}>
      <img src={logoUrl} alt="10K Runner" />
    </div>
  );
}
