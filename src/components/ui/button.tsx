import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// 1) Variants = “surface” (bg + text) uniquement
// 2) States = hover/active/disabled via pseudo-classes (ne change pas layout/padding)
// 3) Size = padding + font-size

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "whitespace-nowrap rounded-xl font-medium",
    "transition-colors transition-shadow",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
    "ring-offset-white dark:ring-offset-slate-950",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          // default
          "bg-slate-900 text-white shadow-sm",
          // hover
          "hover:bg-slate-800 hover:shadow-md",
          // pressed
          "active:bg-slate-700 active:shadow-sm",
        ].join(" "),
        secondary: [
          "bg-slate-100 text-slate-900 shadow-sm",
          "hover:bg-slate-200 hover:shadow-md",
          "active:bg-slate-300 active:shadow-sm",
        ].join(" "),
        ghost: [
          "bg-transparent text-slate-900 shadow-none",
          "hover:bg-slate-100",
          "active:bg-slate-200",
        ].join(" "),
      },
      size: {
        sm: "h-9 px-3.5 text-sm",      // ~10/14
        md: "h-11 px-4 text-base",     // ~12/16
        lg: "h-12 px-[18px] text-lg",  // ~14/18
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
