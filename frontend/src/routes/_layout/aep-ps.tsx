import { createFileRoute } from "@tanstack/react-router"
import { CheckCircle2, Download, Info, LoaderCircle, Paperclip, Save, Smartphone, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { PageHeader, SectionCard } from "@/components/Psychosocial/Kit"
import { Button } from "@/components/ui/button"
import { generateAepWordReport } from "@/lib/aepWordReport"
import { type AepAnswer, type AepEvidence, type AepItem, type AssessmentCycle, type Company, type CompanyStructure, psychosocialApi } from "@/lib/psychosocialApi"

export const Route = createFileRoute("/_layout/aep-ps")({ component: Aep })
type DraftAnswer = { score?: number; evidence: string; existingControls: string }
const evidenceOptions = [
  "Observação da atividade e da organização real do trabalho",
  "Entrevista com trabalhadores",
  "Entrevista com liderança/gestão",
  "Descrição de cargos, procedimentos, escalas, metas e registros",
  "Resultados do DRPS do GHE",
  "Outras evidências documentais pertinentes",
]

function Aep() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [cycles, setCycles] = useState<AssessmentCycle[]>([])
  const [structure, setStructure] = useState<CompanyStructure | null>(null)
  const [items, setItems] = useState<AepItem[]>([])
  const [companyId, setCompanyId] = useState(localStorage.getItem("psychosocial:companyId") ?? "")
  const [cycleId, setCycleId] = useState(localStorage.getItem("psychosocial:cycleId") ?? "")
  const [gheId, setGheId] = useState(localStorage.getItem("psychosocial:aepGheId") ?? "")
  const [open, setOpen] = useState("")
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({})
  const [notes, setNotes] = useState("")
  const [evidenceSources, setEvidenceSources] = useState<string[]>([])
  const [evidences, setEvidences] = useState<AepEvidence[]>([])
  const [attachmentCategory, setAttachmentCategory] = useState(evidenceOptions[0])
  const [attachmentItem, setAttachmentItem] = useState("")
  const [attachmentDescription, setAttachmentDescription] = useState("")
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([psychosocialApi.companies(), psychosocialApi.aepItems()]).then(([companyData, itemData]) => {
      setCompanies(companyData.data); setItems(itemData); setOpen(itemData[0]?.dimension_code ?? "")
      const saved = localStorage.getItem("psychosocial:companyId")
      setCompanyId(companyData.data.some((company) => company.id === saved) ? saved! : (companyData.data[0]?.id ?? ""))
    }).catch((reason) => setError(reason.message)).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!companyId) return
    localStorage.setItem("psychosocial:companyId", companyId); setLoading(true)
    Promise.all([psychosocialApi.cycles(companyId), psychosocialApi.structure(companyId)]).then(([cycleData, companyStructure]) => {
      setCycles(cycleData); setStructure(companyStructure)
      const savedCycle = localStorage.getItem("psychosocial:cycleId")
      const savedGhe = localStorage.getItem("psychosocial:aepGheId")
      setCycleId(cycleData.some((cycle) => cycle.id === savedCycle) ? savedCycle! : (cycleData[0]?.id ?? ""))
      setGheId(companyStructure.ghes.some((ghe) => ghe.id === savedGhe) ? savedGhe! : (companyStructure.ghes[0]?.id ?? ""))
    }).catch((reason) => setError(reason.message)).finally(() => setLoading(false))
  }, [companyId])

  useEffect(() => {
    if (!cycleId || !gheId) { setAnswers({}); setNotes(""); setEvidenceSources([]); return }
    localStorage.setItem("psychosocial:cycleId", cycleId); localStorage.setItem("psychosocial:aepGheId", gheId)
    setLoading(true); setError("")
    Promise.all([psychosocialApi.aepAssessment(cycleId, gheId), psychosocialApi.aepEvidence(cycleId, gheId)]).then(([assessment, savedEvidence]) => {
      setAnswers(Object.fromEntries((assessment?.answers ?? []).map((answer) => [answer.item_code, { score: answer.score, evidence: answer.evidence ?? "", existingControls: answer.existing_controls ?? "" }])))
      setNotes(assessment?.notes ?? "")
      setEvidenceSources(assessment?.evidence_sources ?? [])
      setEvidences(savedEvidence)
      setMessage(assessment?.completed_at ? "AEP-PS concluída. Você pode revisar e salvar novamente." : "")
    }).catch((reason) => setError(reason.message)).finally(() => setLoading(false))
  }, [cycleId, gheId])

  const dimensions = useMemo(() => Array.from(new Map(items.map((item) => [item.dimension_code, item.dimension_name])).entries()), [items])
  const visibleItems = items.filter((item) => item.dimension_code === open)
  const answered = Object.values(answers).filter((answer) => answer.score !== undefined).length
  const company = companies.find((item) => item.id === companyId)
  const cycle = cycles.find((item) => item.id === cycleId)
  const ghe = structure?.ghes.find((item) => item.id === gheId)
  const sector = structure?.sectors.find((item) => item.id === ghe?.sector_id)
  const roles = structure?.job_roles.filter((item) => item.ghe_id === gheId) ?? []
  const dimensionIndex = Math.max(0, dimensions.findIndex(([code]) => code === open))

  function setScore(code: string, score: number) {
    setMessage(""); setAnswers((current) => ({ ...current, [code]: { score, evidence: current[code]?.evidence ?? "", existingControls: current[code]?.existingControls ?? "" } }))
  }
  function setEvidence(code: string, evidence: string) {
    setAnswers((current) => ({ ...current, [code]: { ...current[code], evidence, existingControls: current[code]?.existingControls ?? "" } }))
  }
  function setExistingControls(code: string, existingControls: string) {
    setAnswers((current) => ({ ...current, [code]: { ...current[code], evidence: current[code]?.evidence ?? "", existingControls } }))
  }
  async function save(completed: boolean) {
    if (!cycleId || !gheId) return
    if (completed && answered !== items.length) { setError(`Ainda faltam ${items.length - answered} itens para concluir.`); return }
    const missingEvidence = items.find((item) => (answers[item.code]?.score ?? -1) >= 2 && !answers[item.code]?.evidence.trim())
    if (completed && missingEvidence) { setOpen(missingEvidence.dimension_code); setError(`Informe a evidência obrigatória do item ${missingEvidence.code}.`); return }
    setSaving(true); setError("")
    try {
      const payloadAnswers: AepAnswer[] = items.flatMap((item) => answers[item.code]?.score === undefined ? [] : [{ item_code: item.code, score: answers[item.code].score!, evidence: answers[item.code].evidence || null, existing_controls: answers[item.code].existingControls || null }])
      await psychosocialApi.saveAepAssessment(cycleId, gheId, { notes, evidence_sources: evidenceSources, completed, answers: payloadAnswers })
      setMessage(completed ? "AEP-PS concluída e vinculada ao ciclo DRPS." : "Rascunho salvo com segurança.")
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar a AEP-PS.") }
    finally { setSaving(false) }
  }
  function go(offset: number) {
    const next = dimensions[dimensionIndex + offset]
    if (next) { setOpen(next[0]); window.scrollTo({ top: 0, behavior: "smooth" }) }
  }
  async function uploadEvidence() {
    if (!attachmentFile || !cycleId || !gheId) return
    setSaving(true); setError("")
    try {
      const body = new FormData(); body.append("category", attachmentCategory); body.append("description", attachmentDescription); body.append("item_code", attachmentItem); body.append("file", attachmentFile)
      const evidence = await psychosocialApi.uploadAepEvidence(cycleId, gheId, body)
      setEvidences((current) => [evidence, ...current]); setAttachmentFile(null); setAttachmentDescription(""); setAttachmentItem("")
      const input = document.querySelector<HTMLInputElement>("#aep-evidence-file"); if (input) input.value = ""
      setMessage("Evidência anexada e vinculada à AEP-PS.")
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível anexar a evidência.") }
    finally { setSaving(false) }
  }
  async function removeEvidence(evidence: AepEvidence) {
    if (!window.confirm(`Excluir a evidência “${evidence.filename}”?`)) return
    await psychosocialApi.deleteAepEvidence(evidence.id)
    setEvidences((current) => current.filter((item) => item.id !== evidence.id))
  }
  async function exportAep() {
    if (!company || !cycle || !ghe) return
    setSaving(true); setError("")
    try {
      const drpsResult = await psychosocialApi.drpsResult(cycle.id, { ghe_id: ghe.id }).catch(() => undefined)
      await generateAepWordReport({ company, cycle, sector, ghe, roles, items, answers, evidenceSources, evidences, notes, drpsResult })
      setMessage("Relatório AEP-PS exportado em Word.")
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível exportar a AEP-PS.") }
    finally { setSaving(false) }
  }

  return <div className="space-y-5 aep-field-page">
    <PageHeader eyebrow="Avaliação técnica vinculada ao DRPS" title="AEP-PS de campo" description="Registre no celular, tablet ou computador as condições reais observadas em cada GHE." action={<div className="aep-header-actions"><Button variant="outline" onClick={exportAep} disabled={saving || !gheId || answered === 0}><Download />Exportar AEP-PS</Button><Button onClick={() => save(false)} disabled={saving || !gheId}><Save />Salvar rascunho</Button></div>} />
    <div className="method-note"><Smartphone /><p><b>Uso em campo:</b> o preenchimento fica vinculado à empresa, ao ciclo DRPS e ao GHE selecionado. Você pode salvar parcialmente e continuar depois.</p></div>
    <div className="filter-bar aep-filters">
      <select aria-label="Empresa" value={companyId} onChange={(event) => { setCompanyId(event.target.value); setCycleId(""); setGheId("") }}>{companies.map((item) => <option key={item.id} value={item.id}>{item.trade_name || item.legal_name}</option>)}</select>
      <select aria-label="Ciclo DRPS" value={cycleId} onChange={(event) => setCycleId(event.target.value)}><option value="">Selecione o ciclo DRPS</option>{cycles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select aria-label="GHE avaliado" value={gheId} onChange={(event) => setGheId(event.target.value)}><option value="">Selecione o GHE</option>{structure?.ghes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    </div>
    {loading && <div className="empty-state"><LoaderCircle className="animate-spin" /><p>Carregando avaliação...</p></div>}
    {!loading && (!cycleId || !gheId) && <SectionCard title="Selecione o ciclo e o GHE"><p className="text-sm text-muted-foreground">A AEP-PS precisa desses vínculos para compor posteriormente a matriz DRPS × AEP-PS e o RTIRP.</p></SectionCard>}
    {!loading && cycleId && gheId && <>
      <div className="aep-summary">
        <div><span>Empresa</span><b>{company?.trade_name || company?.legal_name}</b></div><div><span>Ciclo DRPS</span><b>{cycle?.name}</b></div><div><span>Setor / GHE</span><b>{sector?.name} · {ghe?.name}</b></div><div><span>Funções</span><b>{roles.map((item) => item.name).join(" · ") || "Não cadastradas"}</b></div><div><span>Trabalhadores</span><b>{ghe?.worker_count ?? 0}</b></div>
      </div>
      <div className="method-note"><Info /><p><b>Escala metodológica:</b> 0 Não aplicável · 1 Controlado · 2 Requer atenção · 3 Requer intervenção. Evidências são obrigatórias para notas 2 e 3 na conclusão.</p></div>
      <SectionCard title="Fontes de evidência utilizadas" description="Marque as fontes consultadas durante a avaliação em campo."><div className="aep-evidence-sources">{evidenceOptions.map((option) => <label key={option}><input type="checkbox" checked={evidenceSources.includes(option)} onChange={(event) => setEvidenceSources((current) => event.target.checked ? [...current, option] : current.filter((item) => item !== option))} /><span>{option}</span></label>)}</div></SectionCard>
      <SectionCard title="Evidências anexadas" description="Arquivos opcionais, gerais do GHE ou relacionados diretamente a um item da AEP-PS.">
        <div className="aep-upload-grid">
          <label className="form-field"><span>Categoria</span><select value={attachmentCategory} onChange={(event) => setAttachmentCategory(event.target.value)}>{evidenceOptions.filter((option) => option !== "Resultados do DRPS do GHE").map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="form-field"><span>Vinculação</span><select value={attachmentItem} onChange={(event) => setAttachmentItem(event.target.value)}><option value="">Evidência geral do GHE</option>{items.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.text}</option>)}</select></label>
          <label className="form-field aep-upload-description"><span>Descrição</span><input value={attachmentDescription} onChange={(event) => setAttachmentDescription(event.target.value)} placeholder="O que este arquivo comprova ou contextualiza?" /></label>
          <label className="form-field"><span>Arquivo — até 10 MB</span><input id="aep-evidence-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)} /></label>
          <Button type="button" onClick={uploadEvidence} disabled={!attachmentFile || saving}><Paperclip />Anexar evidência</Button>
        </div>
        <div className="aep-evidence-list">{evidences.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum arquivo anexado. O preenchimento pode continuar normalmente.</p> : evidences.map((evidence) => <div key={evidence.id}><Paperclip /><div><b>{evidence.filename}</b><small>{evidence.item_code ? `Item ${evidence.item_code}` : "Evidência geral do GHE"} · {(evidence.size_bytes / 1024).toFixed(0)} KB</small><p>{evidence.description || evidence.category}</p></div><Button variant="outline" size="icon" aria-label={`Baixar ${evidence.filename}`} onClick={() => psychosocialApi.downloadAepEvidence(evidence)}><Download /></Button><Button variant="outline" size="icon" aria-label={`Excluir ${evidence.filename}`} onClick={() => removeEvidence(evidence)}><Trash2 /></Button></div>)}</div>
      </SectionCard>
      <div className="aep-progress-mobile"><b>{answered} de {items.length} itens</b><span style={{ width: `${items.length ? answered / items.length * 100 : 0}%` }} /></div>
      {error && <div className="aep-feedback error">{error}</div>}{message && <div className="aep-feedback success"><CheckCircle2 />{message}</div>}
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <SectionCard title="Progresso" className="aep-dimension-card"><div className="dimension-nav">{dimensions.map(([code, name]) => { const dimensionItems = items.filter((item) => item.dimension_code === code); const complete = dimensionItems.every((item) => answers[item.code]?.score !== undefined); return <button type="button" onClick={() => setOpen(code)} className={open === code ? "active" : ""} key={code}><span>{code}</span>{name}<small>{complete ? <><CheckCircle2 />Concluída</> : `${dimensionItems.filter((item) => answers[item.code]?.score !== undefined).length}/${dimensionItems.length}`}</small></button> })}</div></SectionCard>
        <SectionCard className="aep-form-card" title={`${open} · ${dimensions.find(([code]) => code === open)?.[1] ?? "Dimensão"}`} description="Avalie a condição encontrada considerando a atividade real observada.">
          <div className="aep-legend"><span>0 <small>Não aplicável</small></span><span>1 <small>Controlado</small></span><span>2 <small>Atenção</small></span><span>3 <small>Intervenção</small></span></div>
          <div className="aep-items">{visibleItems.map((item) => { const selected = answers[item.code]?.score; return <div className="aep-item" key={item.code}><div><b>{item.code}</b><p>{item.text}</p></div><div className="score-buttons" role="group" aria-label={`Pontuação de ${item.code}`}>{[0, 1, 2, 3].map((score) => <button type="button" aria-label={`${item.code}: nota ${score}`} className={selected === score ? `selected score-${score}` : ""} onClick={() => setScore(item.code, score)} key={score}>{score}</button>)}</div>{(selected ?? -1) >= 2 && <textarea value={answers[item.code]?.evidence ?? ""} onChange={(event) => setEvidence(item.code, event.target.value)} placeholder="Evidência ou justificativa observada (obrigatória)…" aria-label={`Evidência para ${item.code}`} />}{(selected ?? -1) >= 1 && <textarea value={answers[item.code]?.existingControls ?? ""} onChange={(event) => setExistingControls(item.code, event.target.value)} placeholder="Controle existente relacionado a este item…" aria-label={`Controle existente para ${item.code}`} />}</div> })}</div>
          <label className="form-field mt-5"><span>Controles existentes, fontes e observações técnicas do GHE</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Registre medidas existentes, documentos consultados e observações relevantes…" /></label>
          <div className="form-actions aep-form-actions"><Button variant="outline" onClick={() => go(-1)} disabled={dimensionIndex === 0}>Anterior</Button>{dimensionIndex < dimensions.length - 1 ? <Button onClick={() => { void save(false); go(1) }}>Salvar e avançar</Button> : <Button onClick={() => save(true)} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}Concluir AEP-PS</Button>}</div>
        </SectionCard>
      </div>
    </>}
  </div>
}
