import { BarChart3, Building2, ClipboardCheck, FileDown, GitCompareArrows, Home, ListChecks, Upload, Users } from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { type Item, Main } from "./Main"
import { User } from "./User"

const baseItems: Item[] = [
  { icon: Home, title: "Visão geral", path: "/" },
  { icon: Building2, title: "Cadastros", path: "/cadastros" },
  { icon: Upload, title: "Importação DRPS", path: "/importacao" },
  { icon: BarChart3, title: "Resultados DRPS", path: "/resultados" },
  { icon: ClipboardCheck, title: "AEP-PS", path: "/aep-ps" },
  { icon: GitCompareArrows, title: "Matriz integrada", path: "/matriz" },
  { icon: ListChecks, title: "Plano de ação", path: "/plano-de-acao" },
  { icon: FileDown, title: "Relatórios", path: "/relatorios" },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()

  const items = currentUser?.is_superuser
    ? [...baseItems, { icon: Users, title: "Admin", path: "/admin" }]
    : baseItems

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
