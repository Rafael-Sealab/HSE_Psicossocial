import { Link } from "@tanstack/react-router"

import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
}: LogoProps) {
  const fullLogo = (
    <img
      src="/assets/images/hse-psicossocial-logo.png"
      alt="HSE Psicossocial"
      className={cn("h-11 w-auto max-w-[230px] object-contain", className)}
    />
  )

  const iconLogo = (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center overflow-hidden",
        className,
      )}
      aria-label="HSE Psicossocial"
    >
      <img
        src="/assets/images/hse-psicossocial-logo.png"
        alt=""
        className="h-full w-auto max-w-none object-left"
      />
    </span>
  )

  const content =
    variant === "responsive" ? (
      <>
        <span className="group-data-[collapsible=icon]:hidden">{fullLogo}</span>
        <span className="hidden group-data-[collapsible=icon]:flex">
          {iconLogo}
        </span>
      </>
    ) : variant === "full" ? fullLogo : iconLogo

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
