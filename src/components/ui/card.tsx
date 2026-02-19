import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Card / Surface — Design System
 *
 * Strict mode:
 * - No hover/pressed effects unless `interactive=true`.
 * - States must only affect background/shadow/opacity (no layout changes).
 */

const cardVariants = cva(
  [
    "rounded-[var(--radius-lg)]",
    "transition-[background-color,border-color,box-shadow,opacity] duration-150",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)]",
        elevated:
          "bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow-elevated)]",
        ghost: "bg-transparent border border-transparent shadow-none",
      },
      padding: {
        sm: "p-3",
        md: "p-4",
        lg: "p-6",
      },
      fullWidth: {
        true: "w-full",
        false: "w-auto",
      },
      interactive: {
        true: [
          // hover/pressed are allowed only when interactive
          "hover:bg-[var(--card-bg-hover)] hover:shadow-[var(--card-shadow-hover)]",
          "active:shadow-[var(--card-shadow-active)]",
          // focus-visible ring (tokenized)
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--card-ring)] focus-visible:ring-offset-2",
          "ring-offset-white dark:ring-offset-slate-950",
        ].join(" "),
        false: "",
      },
    },
    compoundVariants: [
      // ghost should stay ghost even if interactive (no shadow)
      {
        variant: "ghost",
        interactive: true,
        className:
          "hover:bg-[var(--card-ghost-bg-hover)] active:bg-[var(--card-ghost-bg-pressed)] hover:shadow-none active:shadow-none",
      },
    ],
    defaultVariants: {
      variant: "default",
      padding: "md",
      fullWidth: true,
      interactive: false,
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean
}

/**
 * Card
 * - Use `interactive` when the surface is clickable (wrapped in Link/button, etc.)
 * - For clickable cards with Link, prefer:
 *   <Card asChild interactive><a .../></Card>
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    { className, variant, padding, fullWidth, interactive, asChild = false, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "div"

    return (
      <Comp
        ref={ref as any}
        className={cn(cardVariants({ variant, padding, fullWidth, interactive }), className)}
        {...props}
      />
    )
  }
)

Card.displayName = "Card"

export { Card, cardVariants }
