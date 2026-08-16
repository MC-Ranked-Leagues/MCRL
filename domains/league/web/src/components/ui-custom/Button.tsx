import { Button as BaseButton, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BaseButtonProps = React.ComponentProps<typeof BaseButton>;

type SharedButtonProps = Pick<
  BaseButtonProps,
  "children" | "className" | "size" | "variant"
> & {
  minecraft?: boolean;
};

type CustomButtonProps =
  | (SharedButtonProps &
      Omit<
        React.AnchorHTMLAttributes<HTMLAnchorElement>,
        keyof SharedButtonProps | "href" | "target"
      > & {
        href: string;
        target?: "_self" | "_blank";
      })
  | (SharedButtonProps &
      Omit<BaseButtonProps, keyof SharedButtonProps | "href" | "target">);

export function CustomButton(props: CustomButtonProps) {
  const {
    className,
    minecraft = true,
    variant = "default",
    size = "default",
    children,
  } = props;
  // classes
  const buttonStyles = cn(
    buttonVariants({ variant, size }),
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
  );

  const content = <span className="relative z-10">{children}</span>;

  if ("href" in props) {
    const {
      className: _className,
      children: _children,
      href,
      minecraft: _minecraft,
      size: _size,
      target = "_self",
      variant: _variant,
      ...anchorProps
    } = props;

    return (
      <a
        className={buttonStyles}
        href={href}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        target={target}
        {...anchorProps}
      >
        {content}
      </a>
    );
  }

  const {
    className: _className,
    children: _children,
    minecraft: _minecraft,
    size: _size,
    variant: _variant,
    ...buttonProps
  } = props;

  return (
    <BaseButton
      variant={variant}
      size={size}
      className={buttonStyles}
      {...buttonProps}
    >
      {content}
    </BaseButton>
  );
}
