import { createFileRoute, Link } from "@tanstack/react-router"
import { Download, FileText, LoaderCircle, ShieldAlert } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { PageHeader, RiskBadge, SectionCard } from "@/components/Psychosocial/Kit"
import { Button } from "@/components/ui/button"
import { generateDrpsWordReport, getDrpsTechnicalInterpretation, type SectorPriorityResult } from "@/lib/drpsWordReport"
import type { Risk } from "@/lib/psychosocial"
import { type AssessmentCycle, type Company, type CompanyStructure, type DrpsResult, psychosocialApi } from "@/lib/psychosocialApi"

export const Route = createFileRoute("/_layout/resultados")({ component: Resultados })

const riskLabels: Record<DrpsResult["overall_risk"], Risk> = {
  irrelevante: "Irrelevante", baixo: "Baixo", médio: "Médio", alto: "Alto", crítico: "Crítico",
}
const riskOrder: Record<DrpsResult["overall_risk"], number> = { irrelevante: 0, baixo: 1, médio: 2, alto: 3, crítico: 4 }

function resultErrorMessage(message: string) {
  if (message.includes("insufficient respondents")) return "Ainda não há respostas suficientes neste ciclo. Volte à importação, selecione esta mesma empresa e ciclo e processe a planilha."
  return message
}

function Resultados() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyId, setCompanyId] = useState(localStorage.getItem("psychosocial:companyId") ?? "")
  const [cycles, setCycles] = useState<AssessmentCycle[]>([])
  const [structure, setStructure] = useState<CompanyStructure | null>(null)
  const [cycleId, setCycleId] = useState(localStorage.getItem("psychosocial:cycleId") ?? "")
  const [scope, setScope] = useState<"company" | "sector" | "ghe">("company")
  const [groupId, setGroupId] = useState("")
  const [result, setResult] = useState<DrpsResult | null>(null)
  const [prioritySectors, setPrioritySectors] = useState<SectorPriorityResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    psychosocialApi.companies().then(({ data }) => {
      setCompanies(data)
      const saved = localStorage.getItem("psychosocial:companyId")
      setCompanyId(data.some((company) => company.id === saved) ? saved! : (data[0]?.id ?? ""))
    }).catch((reason) => setError(reason.message)).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!companyId) return
    localStorage.setItem("psychosocial:companyId", companyId)
    setLoading(true)
    Promise.all([psychosocialApi.cycles(companyId), psychosocialApi.structure(companyId)]).then(([data, companyStructure]) => {
      setCycles(data)
      setStructure(companyStructure)
      const saved = localStorage.getItem("psychosocial:cycleId")
      setCycleId(data.some((cycle) => cycle.id === saved) ? saved! : (data[0]?.id ?? ""))
    }).catch((reason) => setError(reason.message)).finally(() => setLoading(false))
  }, [companyId])

  useEffect(() => {
    if (!cycleId) { setResult(null); return }
    setLoading(true)
    setError("")
    const filters = scope === "sector" && groupId ? { sector_id: groupId } : scope === "ghe" && groupId ? { ghe_id: groupId } : undefined
    if (scope !== "company" && !groupId) { setResult(null); setLoading(false); return }
    psychosocialApi.drpsResult(cycleId, filters).then((data) => {
      setResult(data)
      localStorage.setItem("psychosocial:cycleId", cycleId)
    }).catch((reason) => { setResult(null); setError(resultErrorMessage(reason.message)) }).finally(() => setLoading(false))
  }, [cycleId, scope, groupId])

  useEffect(() => {
    if (!cycleId || !structure?.sectors.length) { setPrioritySectors([]); return }
    let active = true
    Promise.allSettled(structure.sectors.map(async (sector) => {
      const sectorResult = await psychosocialApi.drpsResult(cycleId, { sector_id: sector.id })
      const critical = [...sectorResult.dimensions].sort((left, right) => riskOrder[right.risk] - riskOrder[left.risk] || right.mean - left.mean)[0]
      return { sectorId: sector.id, sectorName: sector.name, respondentCount: sectorResult.respondent_count, generalMean: sectorResult.general_mean, criticalFactor: critical?.name ?? sectorResult.priority_dimension, risk: critical?.risk ?? sectorResult.overall_risk } satisfies SectorPriorityResult
    })).then((settled) => {
      if (!active) return
      setPrioritySectors(settled.flatMap((item) => item.status === "fulfilled" ? [item.value] : []).sort((left, right) => riskOrder[right.risk] - riskOrder[left.risk] || right.generalMean - left.generalMean))
    })
    return () => { active = false }
  }, [cycleId, structure])

  const priority = useMemo(() => result?.dimensions.find((item) => item.code === result.priority_dimension), [result])
  const company = useMemo(() => companies.find((item) => item.id === companyId), [companies, companyId])
  const cycle = useMemo(() => cycles.find((item) => item.id === cycleId), [cycles, cycleId])
  const groupName = scope === "sector" ? structure?.sectors.find((item) => item.id === groupId)?.name : scope === "ghe" ? structure?.ghes.find((item) => item.id === groupId)?.name : "Visão geral da empresa"
  const interpretation = useMemo(() => result ? getDrpsTechnicalInterpretation(result, groupName || "Visão geral da empresa", scope) : [], [result, groupName, scope])

  function exportCsv() {
    if (!result) return
    const rows = [
      ["Código", "Dimensão", "Média", "Probabilidade", "Severidade", "Risco"],
      ...result.dimensions.map((item) => [item.code, item.name, item.mean.toFixed(2), item.probability, item.severity, riskLabels[item.risk]]),
    ]
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\n")
    const link = document.createElement("a")
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }))
    link.download = "resultado-drps.csv"
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async function exportWord() {
    if (!result || !company || !cycle) return
    await generateDrpsWordReport({ company, cycle, result, scopeName: groupName || "Visão geral da empresa", scopeType: scope, prioritySectors })
  }

  return <div className="space-y-6">
    <PageHeader eyebrow="Diagnóstico DRPS" title="Resultados da avaliação" description="Percepção coletiva calculada a partir das respostas importadas." action={<div className="flex gap-2"><Button variant="outline" onClick={exportCsv} disabled={!result}><Download />CSV</Button><Button onClick={exportWord} disabled={!result}><FileText />Relatório Word</Button></div>} />
    <div className="filter-bar">
      <select value={companyId} onChange={(event) => { setCompanyId(event.target.value); setCycleId(""); localStorage.setItem("psychosocial:companyId", event.target.value); localStorage.removeItem("psychosocial:cycleId") }} aria-label="Empresa">{companies.map((company) => <option key={company.id} value={company.id}>{company.trade_name || company.legal_name}</option>)}</select>
      <select value={cycleId} onChange={(event) => setCycleId(event.target.value)} aria-label="Ciclo de avaliação">{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</select>
      <select aria-label="Nível de consolidação" value={scope} onChange={(event) => { setScope(event.target.value as typeof scope); setGroupId("") }}><option value="company">Visão geral da empresa</option><option value="sector">Por setor</option><option value="ghe">Por GHE</option></select>
      {scope === "sector" && <select aria-label="Setor" value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">Selecione o setor</option>{structure?.sectors.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>}
      {scope === "ghe" && <select aria-label="GHE" value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">Selecione o GHE</option>{structure?.ghes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>}
    </div>
    {loading && <div className="empty-state"><LoaderCircle className="animate-spin" /><p>Calculando resultados...</p></div>}
    {!loading && !result && <SectionCard title="Ainda não há resultado disponível"><div className="empty-state"><p>{error || "Crie um ciclo e importe as respostas para gerar o diagnóstico."}</p><Button asChild><Link to="/importacao">Ir para importação</Link></Button></div></SectionCard>}
    {!loading && result && <>
      <div className="privacy-banner"><ShieldAlert /><div><b>Confidencialidade preservada</b><p>{result.respondent_count} respostas válidas. A análise respeita o mínimo definido no ciclo.</p></div></div>
      <div className="grid gap-4 md:grid-cols-3">
        <SectionCard title="Média geral"><strong className="text-3xl">{result.general_mean.toFixed(2)}</strong><p className="chart-note">Escala consolidada de 1 a 5</p></SectionCard>
        <SectionCard title="Risco geral"><RiskBadge risk={riskLabels[result.overall_risk]} /></SectionCard>
        <SectionCard title="Prioridade"><strong>{priority?.name ?? result.priority_dimension}</strong><p className="chart-note">Dimensão que requer atenção primeiro</p></SectionCard>
      </div>
      <SectionCard title="Perfil das dimensões"><div className="dimension-bars large">{result.dimensions.map((dimension) => <div className="dimension-row" key={dimension.code}><span className="dimension-code">{dimension.code}</span><div><div className="dimension-label"><span>{dimension.name}</span><b>{dimension.mean.toFixed(2)}</b></div><div className="bar-track"><span style={{ width: `${dimension.mean / 5 * 100}%` }} /></div></div><RiskBadge risk={riskLabels[dimension.risk]} /></div>)}</div></SectionCard>
      <SectionCard title="Detalhamento técnico"><div className="responsive-table"><table><thead><tr><th>Dimensão</th><th>Média</th><th>Probabilidade</th><th>Severidade</th><th>Risco</th></tr></thead><tbody>{result.dimensions.map((dimension) => <tr key={dimension.code}><td><b>{dimension.code}</b> — {dimension.name}</td><td>{dimension.mean.toFixed(2)}</td><td>{dimension.probability}</td><td>{dimension.severity}</td><td><RiskBadge risk={riskLabels[dimension.risk]} /></td></tr>)}</tbody></table></div></SectionCard>
      {scope === "company" && <SectionCard title="6 - Setores prioritários para intervenção" description="Ranking calculado pelo nível de risco e, em caso de empate, pelo maior índice médio. Setores abaixo do mínimo de anonimização não são exibidos."><div className="responsive-table"><table><thead><tr><th>Rank</th><th>Setor</th><th>Índice (média geral)</th><th>Fator crítico</th><th>Nível de risco</th></tr></thead><tbody>{prioritySectors.length ? prioritySectors.map((sector, index) => <tr key={sector.sectorId}><td><b>{index + 1}</b></td><td>{sector.sectorName}</td><td>{sector.generalMean.toFixed(2)}</td><td>{sector.criticalFactor}</td><td><RiskBadge risk={riskLabels[sector.risk]} /></td></tr>) : <tr><td colSpan={5}>Nenhum setor atingiu o mínimo de respondentes para apresentação.</td></tr>}</tbody></table></div></SectionCard>}
      <SectionCard title="Interpretação técnica do cenário" description={`Abrangência: ${groupName}`}><div className="space-y-3 text-sm leading-relaxed">{interpretation.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></SectionCard>
    </>}
  </div>
}
