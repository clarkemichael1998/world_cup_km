import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "accent" | "danger" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-gradient-to-r from-green-950 via-green-800 to-amber-700 text-white shadow-sm hover:from-green-900 hover:to-amber-600",
  accent: "bg-amber-400 text-amber-950 shadow-sm hover:bg-amber-300",
  danger: "bg-boot text-white hover:bg-red-700",
  outline: "border border-green-900/15 bg-white/85 text-green-950 shadow-sm hover:bg-white",
  ghost: "bg-white/85 text-green-950 shadow-sm ring-1 ring-green-900/10 hover:bg-white"
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-3 text-sm"
};

const BASE = "inline-flex items-center justify-center rounded-md font-black transition disabled:cursor-not-allowed disabled:opacity-40";

// Shared classes so <Link> CTAs and <button>s render identically.
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className = "") {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`.trim();
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = "primary", size = "md", className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}
