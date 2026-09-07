// Sa and Sha placeholder wordmark. This is a plain text logotype standing in
// until real brand artwork (from the frontend design pass) replaces it.

export interface SaAndShaLogoProps {
  className?: string;
  light?: boolean;
  variant?: "horizontal" | "stacked";
  size?: "sm" | "md" | "lg" | string;
}

const SIZE_MAP: Record<string, string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
};

export function SaAndShaLogo({
  className = "",
  light = false,
  variant = "horizontal",
  size = "md",
}: SaAndShaLogoProps) {
  const textColor = light ? "#FBF6EE" : "#2A211C";
  const accentColor = "#B08D57";
  const sizeClass = SIZE_MAP[size] ?? "text-lg";
  const stacked = variant === "stacked";

  return (
    <span
      className={`inline-flex ${stacked ? "flex-col items-center leading-tight gap-1" : "items-center gap-2"} font-serif uppercase tracking-[0.22em] font-medium ${sizeClass} ${className}`}
      style={{ color: textColor }}
    >
      <span>Sa</span>
      <span style={{ color: accentColor }}>&amp;</span>
      <span>Sha</span>
    </span>
  );
}

export default SaAndShaLogo;
