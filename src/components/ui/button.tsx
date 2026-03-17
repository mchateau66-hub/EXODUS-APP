import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Button — Design System
 *
 * Mini convention (DebugUI):
 * - `data-state="hover" | "pressed" | "focus"` is DEV-only.
 * - In production:
 *   - data-state is NOT forwarded to the DOM (zero trace)
 *   - no forced-state styles are injected
 */

const buttonVariants = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2",
    "whitespace-nowrap rounded-xl font-medium",
    "transition-[background-color,box-shadow,opacity,color] duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--btn-ring)] focus-visible:ring-offset-2",
    "[--tw-ring-offset-color:var(--bg)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&>svg]:pointer-events-none [&>svg]:shrink-0 [&>svg]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] shadow-sm",
          "hover:bg-[var(--btn-primary-bg-hover)] hover:shadow-md",
          "active:bg-[var(--btn-primary-bg-pressed)] active:shadow-sm",
        ].join(" "),
        secondary: [
          "bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-fg)] shadow-sm",
          "hover:bg-[var(--btn-secondary-bg-hover)] hover:shadow-md",
          "active:bg-[var(--btn-secondary-bg-pressed)] active:shadow-sm",
        ].join(" "),
        ghost: [
          "bg-[var(--btn-ghost-bg)] text-[var(--btn-ghost-fg)] shadow-none",
          "hover:bg-[var(--btn-ghost-bg-hover)]",
          "active:bg-[var(--btn-ghost-bg-pressed)]",
        ].join(" "),
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-4 text-base",
        lg: "h-12 px-[18px] text-lg",
      },
      fullWidth: {
        true: "w-full",
        false: "w-auto",
      },
      iconOnly: {
        true: "p-0",
        false: "",
      },
    },
    compoundVariants: [
      { size: "sm", iconOnly: true, className: "h-9 w-9" },
      { size: "md", iconOnly: true, className: "h-11 w-11" },
      { size: "lg", iconOnly: true, className: "h-12 w-12" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
      iconOnly: false,
    },
  }
)

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  disabled?: boolean
}

function Spinner({ size }: { size: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "animate-spin rounded-full border-2 border-current/35 border-t-transparent",
        size === "lg" ? "size-5" : "size-4"
      )}
    />
  )
}

function composeHandlers<E>(
  a?: (event: E) => void,
  b?: (event: E) => void
): (event: E) => void {
  return (event) => {
    a?.(event)
    b?.(event)
  }
}

// DEV-only forced state styles (used when data-state is present)
const DEBUG_FORCED_FOCUS =
  "data-[state=focus]:ring-2 data-[state=focus]:ring-[var(--btn-ring)] data-[state=focus]:ring-offset-2"

const DEBUG_BY_VARIANT: Record<"primary" | "secondary" | "ghost", string> = {
  primary:
    "data-[state=hover]:bg-[var(--btn-primary-bg-hover)] data-[state=hover]:shadow-md " +
    "data-[state=pressed]:bg-[var(--btn-primary-bg-pressed)] data-[state=pressed]:shadow-sm",
  secondary:
    "data-[state=hover]:bg-[var(--btn-secondary-bg-hover)] data-[state=hover]:shadow-md " +
    "data-[state=pressed]:bg-[var(--btn-secondary-bg-pressed)] data-[state=pressed]:shadow-sm",
  ghost:
    "data-[state=hover]:bg-[var(--btn-ghost-bg-hover)] " +
    "data-[state=pressed]:bg-[var(--btn-ghost-bg-pressed)]",
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      iconOnly,
      asChild = false,
      loading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      children,
      type = "button",
      onClick,
      onPointerDown,
      ...props
    },
    ref
  ) => {
    const isDisabled = Boolean(disabled || loading)
    const resolvedSize = (size ?? "md") as NonNullable<ButtonProps["size"]>

    // A11y: icon-only -> aria-label required
    if (
      process.env.NODE_ENV !== "production" &&
      iconOnly &&
      !props["aria-label"]
    ) {
      console.warn("Button: iconOnly=true requires an aria-label.")
    }

    // Extract data-state and do NOT forward it in production
    const isDev = process.env.NODE_ENV !== "production"
    const dataState = (props as any)["data-state"] as
      | "default"
      | "hover"
      | "pressed"
      | "focus"
      | undefined

    const { ["data-state"]: _dataState, ...restProps } = props as any

    // DEV-only: if data-state is provided, inject forced styles
    const forcedVariant = (variant ?? "primary") as "primary" | "secondary" | "ghost"
    const debugClasses =
      isDev && dataState
        ? cn(DEBUG_FORCED_FOCUS, DEBUG_BY_VARIANT[forcedVariant])
        : ""

    const baseClassName = cn(
      buttonVariants({ variant, size: resolvedSize, fullWidth, iconOnly }),
      debugClasses,
      className
    )

    const content = (label: React.ReactNode) => (
      <>
        {loading ? (
          <span className="pointer-events-none absolute inset-0 inline-flex items-center justify-center">
            <Spinner size={resolvedSize} />
          </span>
        ) : null}

        <span
          className={cn(
            "inline-flex items-center justify-center gap-2",
            loading ? "opacity-0" : "opacity-100"
          )}
        >
          {iconOnly ? (
            <>{label ?? leftIcon ?? rightIcon}</>
          ) : (
            <>
              {leftIcon ? (
                <span className="inline-flex shrink-0 items-center justify-center">
                  {leftIcon}
                </span>
              ) : null}
              {label}
              {rightIcon ? (
                <span className="inline-flex shrink-0 items-center justify-center">
                  {rightIcon}
                </span>
              ) : null}
            </>
          )}
        </span>
      </>
    )

    if (asChild) {
      const onlyChild = React.Children.only(children) as React.ReactElement<any>
      const childProps = onlyChild.props ?? {}

      const blockEvent = (e: React.SyntheticEvent) => {
        e.preventDefault()
        const ne = e.nativeEvent as any
        ne?.stopImmediatePropagation?.()
        e.stopPropagation()
      }      

      const mergedOnPointerDown = isDisabled
        ? blockEvent
        : composeHandlers(childProps.onPointerDown, onPointerDown)

      const mergedOnClick = isDisabled
        ? blockEvent
        : composeHandlers(childProps.onClick, onClick)

      // Forward data-state only in DEV
      const devStateProps = isDev && dataState ? { "data-state": dataState } : {}

      return React.cloneElement(onlyChild, {
        ...restProps,
        ...devStateProps,
        className: cn(
          baseClassName,
          isDisabled ? "pointer-events-none opacity-50" : "",
          childProps.className
        ),
        onPointerDown: mergedOnPointerDown,
        onClick: mergedOnClick,
        "aria-busy": loading || undefined,
        "aria-disabled": isDisabled || undefined,
        "data-loading": loading ? "true" : undefined,
        children: content(childProps.children),
      })
    }

    // Forward data-state only in DEV
    const devStateProps = isDev && dataState ? { "data-state": dataState } : {}

    return (
      <button
        className={baseClassName}
        ref={ref}
        aria-busy={loading || undefined}
        aria-disabled={isDisabled || undefined}
        data-loading={loading ? "true" : undefined}
        type={type}
        disabled={isDisabled}
        onPointerDown={onPointerDown}
        onClick={onClick}
        {...restProps}
        {...devStateProps}
      >
        {content(children)}
      </button>
    )
  }
)

Button.displayName = "Button"

export { Button, buttonVariants }
