import { Button as BaseButton, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CustomButtonProps extends React.ComponentProps<typeof BaseButton> {
  href?: string
  target?: "_self" | "_blank"
  minecraft?: boolean
}

export function CustomButton({
  className,
  href,
  target = "_self",
  minecraft = true,
  variant = "default",
  onClick,
  children,
  ...props
}: CustomButtonProps) {
  // classes
  const buttonStyles = cn(
    buttonVariants({ variant }),
    // Core animations and transitions
    "relative overflow-hidden transition-all duration-200 active:translate-y-0.5 active:scale-95",

    // Typography
    minecraft && "font-minecraft tracking-widest uppercase",

    // Hover animation
    minecraft && "hover:translate-y-1 hover:scale-95",

    // The 3d minecraft border effect
    minecraft && "border-b-0 shadow-none", // Reset standard borders
    "after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:rounded-b-md after:bg-black/30 after:transition-all",
    "hover:after:bottom-0 hover:after:h-0.5 active:after:h-0",
    className
  )

  const content = <span className="relative z-10">{children}</span>

  // anchor tag if there's a href
  if (href) {
    return (
      <a
        href={href}
        target={target}
        className={buttonStyles}
        {...(props as any)}
      >
        {content}
      </a>
    )
  }

  return (
    <BaseButton
      variant={variant}
      className={buttonStyles}
      onClick={onClick}
      {...props}
    >
      {content}
    </BaseButton>
  )
}
