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
    <span
      className={cn(
        "flex w-full items-center justify-center rounded-xl bg-[#c9ded7] px-2 py-2 shadow-sm ring-1 ring-[#8fb9aa]/40",
        className,
      )}
    >
      <img
        src="/assets/images/hse-psicossocial-logo.png"
        alt="HSE Psicossocial"
        className="h-16 w-auto max-w-full object-contain"
      />
    </span>
  )

  const iconLogo = (
    <span
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#c9ded7] p-1 shadow-sm ring-1 ring-[#8fb9aa]/40",
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
