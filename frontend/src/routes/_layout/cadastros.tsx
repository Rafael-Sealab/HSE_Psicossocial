import { createFileRoute } from "@tanstack/react-router"
import { BriefcaseBusiness, Building2, CalendarPlus, Factory, Network, Pencil, Plus, Trash2, UsersRound } from "lucide-react"
import { type ComponentProps, type FormEvent, useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { PageHeader, SectionCard } from "@/components/Psychosocial/Kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { type AssessmentCycle, type Company, type CompanyStructure, type Ghe, type JobRole, type Sector, psychosocialApi } from "@/lib/psychosocialApi"

export const Route = createFileRoute("/_layout/cadastros")({ component: Cadastros })
type Editor = "company" | "unit" | "sector" | "ghe" | "job_role" | "cycle"

function Cadastros() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyId, setCompanyId] = useState(localStorage.getItem("psychosocial:companyId") ?? "")
  const [structure, setStructure] = useState<CompanyStructure | null>(null)
  const [cycles, setCycles] = useState<AssessmentCycle[]>([])
  const [editor, setEditor] = useState<Editor>("company")
  const [editingGhe, setEditingGhe] = useState<Ghe | null>(null)
  const [editingSector, setEditingSector] = useState<Sector | null>(null)
  const [editingRole, setEditingRole] = useState<JobRole | null>(null)
  const [busy, setBusy] = useState(false)

  const loadCompanies = useCallback(async (preferredId?: string) => {
    const response = await psychosocialApi.companies()
    setCompanies(response.data)
    const saved = localStorage.getItem("psychosocial:companyId")
    setCompanyId(preferredId ?? (response.data.some((company) => company.id === saved) ? saved! : response.data[0]?.id ?? ""))
  }, [])
  const loadStructure = useCallback(async (selectedId: string) => {
    if (!selectedId) { setStructure(null); setCycles([]); return }
    const [tree, cycleData] = await Promise.all([psychosocialApi.structure(selectedId), psychosocialApi.cycles(selectedId)])
    setStructure(tree); setCycles(cycleData)
  }, [])

  useEffect(() => { loadCompanies().catch((error) => toast.error(error.message)) }, [loadCompanies])
  useEffect(() => { if (companyId) localStorage.setItem("psychosocial:companyId", companyId); loadStructure(companyId).catch((error) => toast.error(error.message)) }, [companyId, loadStructure])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setBusy(true)
    try {
      if (editor === "company") {
        const created = await psychosocialApi.createCompany({ legal_name: String(data.get("legal_name")), trade_name: String(data.get("trade_name")) || undefined, cnpj: String(data.get("cnpj")) })
        await loadCompanies(created.id)
      } else if (editor === "unit") {
        await psychosocialApi.createUnit({ company_id: companyId, name: String(data.get("name")) }); await loadStructure(companyId)
      } else if (editor === "sector") {
        const values = { unit_id: String(data.get("unit_id")), name: String(data.get("name")) }
        if (editingSector) await psychosocialApi.updateSector(editingSector.id, values)
        else await psychosocialApi.createSector(values)
        setEditingSector(null); await loadStructure(companyId)
      } else if (editor === "ghe") {
        const values = { sector_id: String(data.get("sector_id")), name: String(data.get("name")), worker_count: Number(data.get("worker_count")), work_schedule: String(data.get("work_schedule")) || undefined, activity_description: String(data.get("activity_description")) || undefined }
        if (editingGhe) await psychosocialApi.updateGhe(editingGhe.id, values)
        else await psychosocialApi.createGhe(values)
        setEditingGhe(null); await loadStructure(companyId)
      } else if (editor === "job_role") {
        const values = { ghe_id: String(data.get("ghe_id")), name: String(data.get("name")), worker_count: Number(data.get("worker_count")) }
        if (editingRole) await psychosocialApi.updateJobRole(editingRole.id, values)
        else await psychosocialApi.createJobRole(values)
        setEditingRole(null)
        await loadStructure(companyId)
      } else {
        const cycle = await psychosocialApi.createCycle({ company_id: companyId, name: String(data.get("name")), assessment_date: String(data.get("assessment_date")), minimum_respondents: Number(data.get("minimum_respondents")) })
        localStorage.setItem("psychosocial:companyId", companyId)
        localStorage.setItem("psychosocial:cycleId", cycle.id); await loadStructure(companyId)
      }
      form.reset(); toast.success("Cadastro salvo com sucesso.")
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar.") }
    finally { setBusy(false) }
  }

  const editGhe = (ghe: Ghe) => { setEditingGhe(ghe); setEditor("ghe") }
  const editSector = (sector: Sector) => { setEditingSector(sector); setEditor("sector") }
  const editRole = (role: JobRole) => { setEditingRole(role); setEditor("job_role") }
  const deleteGhe = async (ghe: Ghe) => {
    if (!window.confirm(`Excluir o GHE “${ghe.name}”?`)) return
    try { await psychosocialApi.deleteGhe(ghe.id); if (editingGhe?.id === ghe.id) setEditingGhe(null); await loadStructure(companyId); toast.success("GHE excluído.") }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir o GHE.") }
  }

  const titles: Record<Editor, string> = { company: "Nova empresa", unit: "Nova unidade", sector: "Novo setor", ghe: "Novo GHE", job_role: "Nova função", cycle: "Novo ciclo de avaliação" }
  return <div className="space-y-6">
    <PageHeader eyebrow="Estrutura organizacional" title="Empresas, GHEs e ciclos" description="Cadastre a estrutura real usada na avaliação e no agrupamento confidencial das respostas." action={<Button onClick={() => setEditor("company")}><Plus /> Nova empresa</Button>} />
    <div className="filter-bar">
      <select value={companyId} onChange={(event) => setCompanyId(event.target.value)}><option value="">Selecione uma empresa</option>{companies.map((company) => <option value={company.id} key={company.id}>{company.trade_name || company.legal_name}</option>)}</select>
      <Button variant="outline" onClick={() => setEditor("unit")} disabled={!companyId}><Factory /> Unidade</Button>
      <Button variant="outline" onClick={() => { setEditingSector(null); setEditor("sector") }} disabled={!structure?.units.length}><Network /> Setor</Button>
      <Button variant="outline" onClick={() => { setEditingGhe(null); setEditor("ghe") }} disabled={!structure?.sectors.length}><UsersRound /> GHE</Button>
      <Button variant="outline" onClick={() => { setEditingRole(null); setEditor("job_role") }} disabled={!structure?.ghes.length}><BriefcaseBusiness /> Função</Button>
      <Button onClick={() => setEditor("cycle")} disabled={!companyId}><CalendarPlus /> Ciclo</Button>
    </div>
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <SectionCard title="Estrutura cadastrada" description="Informações carregadas diretamente do banco de dados.">
        {!structure ? <p className="text-sm text-muted-foreground">Cadastre ou selecione uma empresa.</p> : <div className="org-tree">
          <p className="active"><Building2 /><span><b>{structure.company.legal_name}</b><small>{structure.company.cnpj}</small></span></p>
          {structure.units.map((unit) => <div key={unit.id}><p><Factory /><span><b>{unit.name}</b><small>{structure.sectors.filter((item) => item.unit_id === unit.id).length} setores</small></span></p>
            {structure.sectors.filter((item) => item.unit_id === unit.id).map((sector) => <div className="ml-5" key={sector.id}><p><Network /><span><b>{sector.name}</b><small>{structure.ghes.filter((item) => item.sector_id === sector.id).length} GHEs</small></span><span className="ml-auto flex gap-1"><Button type="button" size="icon" variant="ghost" title="Editar setor" onClick={() => editSector(sector)}><Pencil /></Button></span></p>
              {structure.ghes.filter((item) => item.sector_id === sector.id).map((ghe) => <div className="ml-5" key={ghe.id}><p><UsersRound /><span><b>{ghe.name}</b><small>{ghe.worker_count} trabalhadores · {ghe.work_schedule || "jornada não informada"}</small></span><span className="ml-auto flex gap-1"><Button type="button" size="icon" variant="ghost" title="Editar GHE" onClick={() => editGhe(ghe)}><Pencil /></Button><Button type="button" size="icon" variant="ghost" title="Excluir GHE" onClick={() => deleteGhe(ghe)}><Trash2 /></Button></span></p>{structure.job_roles.filter((item) => item.ghe_id === ghe.id).map((role) => <p className="ml-5" key={role.id}><BriefcaseBusiness /><span><b>{role.name}</b><small>{role.worker_count} trabalhadores · função vinculada ao GHE</small></span><span className="ml-auto flex gap-1"><Button type="button" size="icon" variant="ghost" title="Editar função" onClick={() => editRole(role)}><Pencil /></Button></span></p>)}</div>)}</div>)}</div>)}
          <p><CalendarPlus /><span><b>{cycles.length} ciclos</b><small>{cycles.filter((item) => item.status !== "completed").length} em aberto</small></span></p>
        </div>}
      </SectionCard>
      <SectionCard title={editingGhe && editor === "ghe" ? "Editar GHE" : editingSector && editor === "sector" ? "Editar setor" : editingRole && editor === "job_role" ? "Editar função" : titles[editor]} description="Preencha os campos obrigatórios e salve para atualizar a estrutura.">
        <form className="space-y-5" onSubmit={submit} key={`${editor}-${editingGhe?.id ?? editingSector?.id ?? editingRole?.id ?? "new"}`}>
          {editor === "company" && <div className="form-grid"><Field name="legal_name" label="Razão social" required /><Field name="trade_name" label="Nome fantasia" /><Field name="cnpj" label="CNPJ" required placeholder="00.000.000/0000-00" /></div>}
          {editor === "unit" && <Field name="name" label="Nome da unidade" required placeholder="Ex.: Matriz" />}
          {editor === "sector" && <div className="form-grid"><SelectField name="unit_id" label="Unidade" defaultValue={editingSector?.unit_id} options={structure?.units.map((item) => [item.id, item.name]) ?? []} /><Field name="name" label="Nome do setor" defaultValue={editingSector?.name} required /></div>}
          {editor === "ghe" && <div className="form-grid"><SelectField name="sector_id" label="Setor" defaultValue={editingGhe?.sector_id} options={structure?.sectors.map((item) => [item.id, item.name]) ?? []} /><Field name="name" label="Nome do GHE" defaultValue={editingGhe?.name} required /><Field name="worker_count" label="Nº de trabalhadores" type="number" defaultValue={editingGhe?.worker_count ?? 0} required /><Field name="work_schedule" label="Jornada" defaultValue={editingGhe?.work_schedule ?? ""} placeholder="Ex.: 08:00–17:00" /><Field name="activity_description" label="Descrição da atividade" defaultValue={editingGhe?.activity_description ?? ""} /></div>}
          {editor === "job_role" && <div className="form-grid"><SelectField name="ghe_id" label="GHE" defaultValue={editingRole?.ghe_id} options={structure?.ghes.map((item) => [item.id, item.name]) ?? []} /><Field name="name" label="Nome da função no Forms" defaultValue={editingRole?.name} required placeholder="Ex.: Atendente" /><Field name="worker_count" label="Nº de trabalhadores" type="number" defaultValue={editingRole?.worker_count ?? 0} required /></div>}
          {editor === "cycle" && <div className="form-grid"><Field name="name" label="Nome do ciclo" required placeholder="Ex.: Avaliação 2026" /><Field name="assessment_date" label="Data" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /><Field name="minimum_respondents" label="Mínimo de respondentes" type="number" defaultValue="5" required /></div>}
          <div className="form-actions"><Button type="submit" disabled={busy || (editor !== "company" && !companyId)}>{busy ? "Salvando…" : "Salvar cadastro"}</Button></div>
        </form>
      </SectionCard>
    </div>
  </div>
}

function Field({ label, name, ...props }: ComponentProps<typeof Input> & { label: string; name: string }) {
  return <label className="form-field"><span>{label}</span><Input name={name} {...props} /></label>
}
function SelectField({ label, name, options, defaultValue }: { label: string; name: string; options: string[][]; defaultValue?: string }) {
  return <label className="form-field"><span>{label}</span><select name={name} defaultValue={defaultValue} required>{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label>
}
