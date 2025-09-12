import * as React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const cardVariants = cva(
  "rounded-xl border bg-white text-gray-950 shadow-sm transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-gray-200 hover:shadow-md hover:border-gray-300",
        elevated: "border-gray-100 shadow-lg hover:shadow-xl",
        outlined: "border-gray-300 bg-transparent",
        ghost: "border-transparent shadow-none hover:shadow-sm",
        primary: "border-blue-200 bg-blue-50/50 hover:border-blue-300",
        success: "border-green-200 bg-green-50/50 hover:border-green-300",
        warning: "border-yellow-200 bg-yellow-50/50 hover:border-yellow-300",
        destructive: "border-red-200 bg-red-50/50 hover:border-red-300",
      },
      interactive: {
        true: "cursor-pointer hover:scale-[1.02] hover:shadow-lg",
        false: "",
      },
      size: {
        default: "p-6",
        sm: "p-4",
        lg: "p-8",
        compact: "p-3",
      }
    },
    defaultVariants: {
      variant: "default",
      interactive: false,
      size: "default",
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, interactive, size, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, interactive, size, className }))}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-semibold leading-none tracking-tight text-gray-900",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-gray-600 leading-relaxed", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }