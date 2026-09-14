import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold",
    "transition-[background-color,color,box-shadow,transform] duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    // Press feedback without shifting surrounding layout
    "active:scale-[0.98]",
    "[&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-card hover:bg-primary-700 hover:shadow-glow",
        secondary: "bg-primary-50 text-primary-800 hover:bg-primary-100 dark:bg-primary-950/70 dark:text-primary-200 dark:hover:bg-primary-900",
        outline: "border border-border bg-card text-foreground shadow-xs hover:border-primary-300 hover:bg-accent hover:text-accent-foreground dark:hover:border-primary-700",
        ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground shadow-card hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 text-small",
        sm: "h-9 rounded-md px-3 text-small",
        lg: "h-12 rounded-xl px-6 text-body",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

// Only the component is exported so Vite Fast Refresh can hot-swap this module.
export { Button };
