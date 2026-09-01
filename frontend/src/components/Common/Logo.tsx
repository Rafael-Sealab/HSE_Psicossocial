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
  const content =
    variant === "responsive" ? (
      <>
        <span className={cn("sealab-logo group-data-[collapsible=icon]:hidden", className)}><b>SEA</b>LAB <small>Saúde ocupacional</small></span>
        <span className={cn("sealab-mark hidden group-data-[collapsible=icon]:grid", className)}>S</span>
      </>
    ) : (
      <span className={cn(variant === "full" ? "sealab-logo" : "sealab-mark", className)}>{variant === "full" ? <><b>SEA</b>LAB</> : "S"}</span>
    )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
