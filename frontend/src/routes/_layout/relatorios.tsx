import { createFileRoute } from "@tanstack/react-router"
import { FileCheck2, FileText, FileType2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { PageHeader, SectionCard } from "@/components/Psychosocial/Kit"
import { Button } from "@/components/ui/button"
import { generateDrpsWordReport, type SectorPriorityResult } from "@/lib/drpsWordReport"
import { type AepReportBundle, generateIntegratedWordReport } from "@/lib/integratedWordReport"
import { type AssessmentCycle, type Company, type CompanyStructure, psychosocialApi } from "@/lib/psychosocialApi"

export const Route = createFileRoute("/_layout/relatorios")({ component: Relatorios })

function Relatorios() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyId, setCompanyId] = useState(localStorage.getItem("psychosocial:companyId") ?? "")
  const [cycles, setCycles] = useState<AssessmentCycle[]>([])
  const [cycleId, setCycleId] = useState(localStorage.getItem("psychosocial:cycleId") ?? "")
  const [structure, setStructure] = useState<CompanyStructure | null>(null)
  const [busy, setBusy] = useState("")
  useEffect(() => { psychosocialApi.companies().then(({ data }) => { setCompanies(data); setCompanyId((current) => data.some((item) => item.id === current) ? current : data[0]?.id ?? "") }).catch((error) => toast.error(error.message)) }, [])
  useEffect(() => { if (!companyId) return; localStorage.setItem("psychosocial:companyId", companyId); Promise.all([psychosocialApi.cycles(companyId), psychosocialApi.structure(companyId)]).then(([cycleData, tree]) => { setCycles(cycleData); setStructure(tree); setCycleId((current) => cycleData.some((item) => item.id === current) ? current : cycleData[0]?.id ?? "") }).catch((error) => toast.error(error.message)) }, [companyId])
  const company = useMemo(() => companies.find((item) => item.id === companyId), [companies, companyId])
  const cycle = useMemo(() => cycles.find((item) => item.id === cycleId), [cycles, cycleId])
  async function loadIntegrated() {
    if (!company || !cycle || !structure) throw new Error("Selecione uma empresa e um ciclo.")
    const drps = await psychosocialApi.drpsResult(cycle.id)
    const aep: AepReportBundle[] = await Promise.all(structure.ghes.map(async (ghe) => ({ ghe, sectorName: structure.sectors.find((sector) => sector.id === ghe.sector_id)?.name ?? "Setor não identificado", assessment: await psychosocialApi.aepAssessment(cycle.id, ghe.id), evidences: await psychosocialApi.aepEvidence(cycle.id, ghe.id) })))
    return { company, cycle, structure, drps, aep }
  }
  async function generateIntegrated(mode: "rtirp" | "integration") { setBusy(mode); try { const data = await loadIntegrated(); await generateIntegratedWordReport({ ...data, mode }); toast.success(mode === "rtirp" ? "RTIRP gerado com sucesso." : "Resumo de integração gerado com sucesso.") } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível gerar o relatório.") } finally { setBusy("") } }
  async function generateDrps() { setBusy("drps"); try { if (!company || !cycle || !structure) throw new Error("Selecione uma empresa e um ciclo."); const result = await psychosocialApi.drpsResult(cycle.id); const settled = await Promise.allSettled(structure.sectors.map(async (sector) => { const sectorResult = await psychosocialApi.drpsResult(cycle.id, { sector_id: sector.id }); const critical = [...sectorResult.dimensions].sort((a, b) => b.mean - a.mean)[0]; return { sectorId: sector.id, sectorName: sector.name, respondentCount: sectorResult.respondent_count, generalMean: sectorResult.general_mean, criticalFactor: critical?.name ?? sectorResult.priority_dimension, risk: critical?.risk ?? sectorResult.overall_risk } satisfies SectorPriorityResult })); const prioritySectors = settled.flatMap((item) => item.status === "fulfilled" ? [item.value] : []).sort((a, b) => b.generalMean - a.generalMean); await generateDrpsWordReport({ company, cycle, result, scopeName: "Visão geral da empresa", prioritySectors }); toast.success("Relatório DRPS gerado com sucesso.") } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível gerar o relatório DRPS.") } finally { setBusy("") } }
  return <div className="space-y-6 reports-page">
    <PageHeader eyebrow="Saída técnica" title="Relatórios" description="Gere documentos a partir dos dados validados, sem usar Word ou PDF como motor de cálculo." />
    <div className="filter-bar"><select aria-label="Empresa" value={companyId} onChange={(event) => { setCompanyId(event.target.value); setCycleId("") }}>{companies.map((item) => <option value={item.id} key={item.id}>{item.trade_name || item.legal_name}</option>)}</select><select aria-label="Ciclo" value={cycleId} onChange={(event) => { setCycleId(event.target.value); localStorage.setItem("psychosocial:cycleId", event.target.value) }}><option value="">Selecione o ciclo</option>{cycles.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
    <div className="reports-grid">
      <SectionCard className="report-card rtirp-card" title="RTIRP — Relatório Técnico Integrado de Riscos Psicossociais" description="Parecer técnico global da situação da empresa, consolidando todas as etapas e resultados da metodologia Sealab.">
        <div className="report-preview"><FileCheck2 /><div><b>Parecer global da empresa</b><p>DRPS, AEP-PS, evidências, matriz de integração, conclusões, recomendações, indicadores e prazos.</p></div></div>
        <div className="report-actions single"><Button onClick={() => generateIntegrated("rtirp")} disabled={!cycleId || Boolean(busy)}>{busy === "rtirp" ? "Gerando…" : "Gerar RTIRP Word"}</Button></div>
        <p className="report-note">Se houver AEP-PS pendente, o documento será identificado automaticamente como parcial.</p>
      </SectionCard>
      <SectionCard className="report-card" title="Relatório técnico DRPS" description="Resumo executivo, metodologia, resultados gerais e setoriais, plano de ação e conclusão.">
        <div className="report-preview"><FileType2 /><div><b>Relatório de levantamento</b><p>Dados atualizados em 26 ago. 2026</p></div></div>
        <div className="report-actions single"><Button onClick={generateDrps} disabled={!cycleId || Boolean(busy)}>{busy === "drps" ? "Gerando…" : "Gerar relatório Word"}</Button></div>
      </SectionCard>
      <SectionCard className="report-card" title="Orientações para integração ao PGR/PCMSO" description="Propostas de fatores, controles, medidas, indicadores e prazos para análise e implementação pela empresa contratante.">
        <div className="report-preview"><FileText /><div><b>Resumo para integração</b><p>Inclui matriz DRPS × AEP-PS aprovada</p></div></div>
        <div className="report-actions single"><Button variant="outline" onClick={() => generateIntegrated("integration")} disabled={!cycleId || Boolean(busy)}>{busy === "integration" ? "Gerando…" : "Gerar resumo Word"}</Button></div>
      </SectionCard>
    </div>
  </div>
}
