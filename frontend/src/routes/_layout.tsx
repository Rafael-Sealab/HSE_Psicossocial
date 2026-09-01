import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { Footer } from "@/components/Common/Footer"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

function Layout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="app-topbar sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1 text-muted-foreground" />
          <div className="topbar-context"><span>DRPS Sealab</span><small>Gestão de riscos psicossociais</small></div>
          <div className="topbar-company">TECSEA · Avaliação 2026</div>
        </header>
        <main className="flex-1 bg-muted/25 p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  )
}
