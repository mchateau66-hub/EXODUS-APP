import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1",
    "rounded-full border px-2 py-0.5",
    "text-xs font-medium",
    "transition-[background-color,border-color,opacity,color] duration-150",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border-[var(--border)] bg-[var(--bg-elev)] text-[var(--text-muted)]",
        accent:
          "border-transparent bg-[var(--btn-ghost-bg-hover)] text-[var(--accent)]",
        success:
          "border-transparent bg-[rgba(34,197,94,0.10)] text-[rgba(34,197,94,1)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
