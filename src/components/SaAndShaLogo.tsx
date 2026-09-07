// Sa and Sha placeholder wordmark. This is a plain text logotype standing in
// until real brand artwork (from the frontend design pass) replaces it.
// Keeps the same prop shape as the Kora Linen logo component it replaces
// so callers don't need to change.

export interface SaAndShaLogoProps {
  className?: string;
  light?: boolean;
  variant?: "horizontal" | "stacked";
  size?: "sm" | "md" | "lg" | string;
}

const SIZE_MAP: Record<string, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
};

export function SaAndShaLogo({
  className = "",
  light = false,
  variant = "horizontal",
  size = "md",
}: SaAndShaLogoProps) {
  const textColor = light ? "#F5F1EA" : "#2C2B26";
  const sizeClass = SIZE_MAP[size] ?? "text-xl";
  const stacked = variant === "stacked";

  return (
    <span
      className={`inline-flex ${stacked ? "flex-col items-center leading-tight" : "items-center"} font-serif tracking-wide ${sizeClass} ${className}`}
      style={{ color: textColor }}
    >
      Sa and Sha
    </span>
  );
}

export default SaAndShaLogo;
