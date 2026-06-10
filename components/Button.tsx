import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "accent" | "danger" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-pitch text-white hover:bg-green-800",
  accent: "bg-amber-600 text-white hover:bg-amber-700",
  danger: "bg-boot text-white hover:bg-red-700",
  outline: "border border-green-900/15 bg-white text-green-950 hover:bg-green-50",
  ghost: "bg-green-950/10 text-green-950 hover:bg-green-950/15"
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
