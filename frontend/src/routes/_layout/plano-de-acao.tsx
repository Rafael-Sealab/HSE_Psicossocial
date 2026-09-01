import { createFileRoute } from "@tanstack/react-router"
import { CalendarClock, Download } from "lucide-react"
import { PageHeader, RiskBadge, SectionCard } from "@/components/Psychosocial/Kit"
import { Button } from "@/components/ui/button"
import { actions } from "@/lib/psychosocial"

export const Route = createFileRoute("/_layout/plano-de-acao")({ component: Plano })

function Plano() {
  const indicators = ["Registro da rotina de feedback e pesquisa de percepção", "Plano de comunicação, registro de ciência e verificação de entendimento", "Revisão da distribuição de tarefas e acompanhamento da carga de trabalho"]
  return <div className="space-y-6 action-plan-page">
    <PageHeader eyebrow="Orientação preventiva ao cliente" title="Plano de ação recomendado" description="Propostas técnicas para apoiar a empresa na definição de responsáveis, implementação de controles e atendimento dos prazos recomendados." action={<div className="action-plan-header-actions"><Button><Download />Exportar recomendações</Button></div>} />
    <div className="metric-grid three action-plan-metrics">
      <div className="status-card"><span>Medidas recomendadas</span><b>{actions.length}</b><small>Orientações propostas pela Sealab</small></div>
      <div className="status-card warning"><span>Prioridade elevada</span><b>{actions.filter((item) => item.risk === "Alto" || item.risk === "Crítico").length}</b><small>Medidas com menor prazo recomendado</small></div>
      <div className="status-card"><span>Horizonte de implementação</span><b className="text-xl">Até 180 dias</b><small>Conforme classificação do risco</small></div>
    </div>
    <SectionCard title="Recomendações organizacionais e setoriais" description="A empresa contratante define os responsáveis internos, executa as medidas e mantém as evidências de cumprimento." className="action-plan-table-card">
      <div className="responsive-table action-plan-table"><table><thead><tr><th>Prioridade</th><th>Dimensão / ação proposta</th><th>Abrangência</th><th>Responsável sugerido</th><th>Prazo recomendado</th><th>Indicador sugerido</th></tr></thead><tbody>{actions.map((action, index) => <tr key={action.dimension}>
        <td data-label="Prioridade"><RiskBadge risk={action.risk} /></td>
        <td data-label="Ação proposta"><div><b>{action.dimension}</b><p className="table-detail">{action.action}</p></div></td>
        <td data-label="Abrangência">{index === 1 ? "Setor / GHE" : "Organizacional"}</td>
        <td data-label="Responsável sugerido">{action.owner}</td>
        <td data-label="Prazo recomendado"><span className="action-plan-date"><CalendarClock />{action.due}</span></td>
        <td data-label="Indicador sugerido">{indicators[index]}</td>
      </tr>)}</tbody></table></div>
    </SectionCard>
    <SectionCard title="Critérios sugeridos para verificação pela empresa" description="A Sealab fornece a orientação técnica; a contratante organiza a execução, guarda as evidências e avalia a eficácia das medidas."><div className="monitor-grid"><div><b>Indicador</b><p>Medida objetiva para verificar a implementação e o resultado.</p></div><div><b>Meta sugerida</b><p>Resultado esperado dentro do prazo recomendado.</p></div><div><b>Evidência esperada</b><p>Registros, procedimentos, atas, treinamentos ou outros comprovantes.</p></div><div><b>Reavaliação</b><p>Revisar quando houver mudanças ou no ciclo definido pela empresa.</p></div></div></SectionCard>
  </div>
}
