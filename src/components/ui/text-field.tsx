"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

type FieldSize = "sm" | "md" | "lg"

const inputVariants = cva(
  [
    // base
    "w-full bg-[var(--field-bg)] text-[var(--field-fg)]",
    "border border-[var(--field-border)]",
    "rounded-xl outline-none",
    "transition-[background-color,border-color,box-shadow,opacity,color] duration-150",
    // placeholder
    "placeholder:text-[var(--field-placeholder)]",
    // focus ring (tokenized)
    "focus-visible:ring-2 focus-visible:ring-[var(--field-ring)] focus-visible:ring-offset-2",
    "ring-offset-white dark:ring-offset-slate-950",
    // disabled
    "disabled:opacity-50 disabled:pointer-events-none",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-3.5 text-base",
        lg: "h-12 px-4 text-lg",
      },
      fullWidth: {
        true: "w-full",
        false: "w-auto",
      },
      hasLeft: {
        true: "",
        false: "",
      },
      hasRight: {
        true: "",
        false: "",
      },
      state: {
        default: "",
        error:
          "border-[var(--field-border-error)] focus-visible:ring-[var(--field-ring-error)]",
      },
    },
    compoundVariants: [
      // left icon padding
      { size: "sm", hasLeft: true, className: "pl-9" },
      { size: "md", hasLeft: true, className: "pl-10" },
      { size: "lg", hasLeft: true, className: "pl-11" },

      // right icon padding
      { size: "sm", hasRight: true, className: "pr-9" },
      { size: "md", hasRight: true, className: "pr-10" },
      { size: "lg", hasRight: true, className: "pr-11" },
    ],
    defaultVariants: {
      size: "md",
      fullWidth: true,
      state: "default",
    },
  }
)

export interface TextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  label?: string
  description?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  loading?: boolean
  containerClassName?: string
}

function Spinner({ size }: { size: FieldSize }) {
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

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      className,
      containerClassName,
      label,
      description,
      error,
      required,
      disabled,
      leftIcon,
      rightIcon,
      loading = false,
      size,
      fullWidth = true,
      id,
      name,
      "aria-describedby": ariaDescribedBy,
      ...inputProps
    },
    ref
  ) => {
    const inputId = React.useId()
    const resolvedId = id ?? inputId

    const resolvedSize = (size ?? "md") as FieldSize

    const isError = Boolean(error)
    const isDisabled = Boolean(disabled || loading)

    const descId = description ? `${resolvedId}-desc` : undefined
    const errId = isError ? `${resolvedId}-err` : undefined

    const describedBy =
      [ariaDescribedBy, descId, errId].filter(Boolean).join(" ") || undefined

    const hasLeft = Boolean(leftIcon)
    const hasRight = Boolean(rightIcon || loading)
    const state: "default" | "error" = isError ? "error" : "default"

    return (
      <div
        className={cn(
          fullWidth ? "w-full" : "w-auto",
          "space-y-1.5",
          containerClassName
        )}
      >
        {label ? (
          <label
            htmlFor={resolvedId}
            className={cn(
              "text-sm font-medium text-[var(--field-label)]",
              isDisabled ? "opacity-50" : ""
            )}
          >
            {label}
            {required ? (
              <span className="text-[var(--field-required)]"> *</span>
            ) : null}
          </label>
        ) : null}

        <div className={cn("relative", fullWidth ? "w-full" : "w-auto")}>
          {/* Left icon */}
          {leftIcon ? (
            <span
              className={cn(
                "pointer-events-none absolute inset-y-0 left-3 inline-flex items-center justify-center text-[var(--field-icon)]",
                resolvedSize === "sm" && "left-2.5",
                resolvedSize === "lg" && "left-3.5"
              )}
            >
              {leftIcon}
            </span>
          ) : null}

          <input
            ref={ref}
            id={resolvedId}
            name={name}
            required={required}
            disabled={isDisabled}
            aria-invalid={isError || undefined}
            aria-describedby={describedBy}
            className={cn(
              inputVariants({
                size: resolvedSize,
                fullWidth,
                hasLeft,
                hasRight,
                state,
              }),
              // state styling (background/shadow only) — no layout shift
              !isDisabled && !isError ? "hover:bg-[var(--field-bg-hover)]" : "",
              !isDisabled && !isError
                ? "focus-visible:shadow-[var(--field-shadow)]"
                : "",
              isError && !isDisabled ? "bg-[var(--field-bg-error)]" : "",
              className
            )}
            {...inputProps}
          />

          {/* Right icon / Loading */}
          {rightIcon || loading ? (
            <span
              className={cn(
                "pointer-events-none absolute inset-y-0 right-3 inline-flex items-center justify-center text-[var(--field-icon)]",
                resolvedSize === "sm" && "right-2.5",
                resolvedSize === "lg" && "right-3.5"
              )}
            >
              {loading ? <Spinner size={resolvedSize} /> : rightIcon}
            </span>
          ) : null}
        </div>

        {/* Helper row (reserved height to avoid layout shift) */}
        <div className="min-h-5">
          {isError ? (
            <p id={errId} className="text-sm text-[var(--field-error)]">
              {error}
            </p>
          ) : description ? (
            <p id={descId} className="text-sm text-[var(--field-description)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    )
  }
)

TextField.displayName = "TextField"

export { inputVariants }
