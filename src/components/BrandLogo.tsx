import logoUrl from "../assets/10k-runner-logo.jpg";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "brand-logo compact" : "brand-logo"}>
      <img src={logoUrl} alt="10K Runner" />
    </div>
  );
}
