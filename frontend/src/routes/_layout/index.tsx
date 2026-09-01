import { createFileRoute, Link } from "@tanstack/react-router"
import { Building2, ClipboardCheck, ListChecks, Users } from "lucide-react"

import {
  MetricCard,
  PageHeader,
  RiskBadge,
  SectionCard,
} from "@/components/Psychosocial/Kit"
import { Button } from "@/components/ui/button"
import { actions, dimensions } from "@/lib/psychosocial"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Visão geral | HSE Psicossocial" }] }),
})

function Dashboard() {
  const priorities = [...dimensions].sort((a, b) => b.score - a.score).slice(0, 5)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ciclo 2026"
        title="Visão geral psicossocial"
        description="Acompanhe participação, riscos, AEP-PS e medidas preventivas em um só lugar."
        action={<Button asChild><Link to="/importacao">Importar respostas</Link></Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Empresas avaliadas" value="3" hint="2 ciclos em andamento" icon={<Building2 />} />
        <MetricCard label="Participação DRPS" value="90,9%" hint="10 de 11 trabalhadores" icon={<Users />} />
        <MetricCard label="GHEs com AEP-PS" value="6/8" hint="2 avaliações pendentes" icon={<ClipboardCheck />} />
        <MetricCard label="Ações pendentes" value="12" hint="1 ação fora do prazo" icon={<ListChecks />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <SectionCard title="Dimensões prioritárias" description="Médias adversas do DRPS; quanto maior, maior a exposição percebida.">
          <div className="dimension-bars">
            {priorities.map((dimension) => (
              <div className="dimension-row" key={dimension.code}>
                <span className="dimension-code">{dimension.code}</span>
                <div>
                  <div className="dimension-label"><span>{dimension.name}</span><b>{dimension.score.toFixed(2)}</b></div>
                  <div className="bar-track"><span style={{ width: `${(dimension.score / 5) * 100}%` }} /></div>
                </div>
                <RiskBadge risk={dimension.risk} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Próximas etapas" description="Pendências do ciclo selecionado.">
          <div className="space-y-4">
            {actions.map((item) => (
              <div className="rounded-lg border p-4" key={item.action}>
                <div className="mb-2 flex items-center justify-between gap-3"><b>{item.dimension}</b><RiskBadge risk={item.risk} /></div>
                <p className="text-sm">{item.action}</p>
                <small className="text-muted-foreground">{item.owner} · {item.due} · {item.status}</small>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
