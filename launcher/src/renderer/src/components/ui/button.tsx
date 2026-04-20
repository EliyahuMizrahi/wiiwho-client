import * as React from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[--color-wiiwho-accent]",
  {
    variants: {
      variant: {
        default:
          'bg-[--color-wiiwho-accent] text-neutral-950 shadow hover:bg-[#14c9d6]',
        destructive:
          'bg-red-600 text-white shadow-sm hover:bg-red-600/90 focus-visible:ring-red-600/50',
        outline:
          'border border-neutral-700 bg-transparent shadow-sm hover:bg-neutral-800 hover:text-neutral-50',
        secondary:
          'bg-neutral-800 text-neutral-50 shadow-sm hover:bg-neutral-800/80',
        ghost: 'hover:bg-neutral-800 hover:text-neutral-50',
        link: 'text-[--color-wiiwho-accent] underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps): React.JSX.Element {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
