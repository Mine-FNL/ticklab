import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(
  value: number | string | undefined,
  options: {
    decimals?: number;
    prefix?: string;
    suffix?: string;
    compact?: boolean;
  } = {}
): string {
  if (value === undefined || value === null) return "-";

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";

  const { decimals = 4, prefix = "", suffix = "", compact = false } = options;

  if (compact && Math.abs(num) >= 1000000) {
    return `${prefix}${(num / 1000000).toFixed(decimals)}M${suffix}`;
  }
  if (compact && Math.abs(num) >= 1000) {
    return `${prefix}${(num / 1000).toFixed(decimals)}K${suffix}`;
  }

  return `${prefix}${num.toFixed(decimals)}${suffix}`;
}

export function formatPercent(
  value: number | string | undefined,
  decimals: number = 2
): string {
  if (value === undefined || value === null) return "-";

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";

  const sign = num >= 0 ? "+" : "";
  return `${sign}${(num * 100).toFixed(decimals)}%`;
}

export function formatCurrency(
  value: number | string | undefined,
  currency: string = "USD",
  decimals: number = 2
): string {
  if (value === undefined || value === null) return "-";

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return formatter.format(num);
}

export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
