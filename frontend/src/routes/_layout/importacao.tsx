import { createFileRoute, Link } from "@tanstack/react-router"
import { Check, Download, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import * as XLSX from "xlsx"

import { PageHeader, SectionCard } from "@/components/Psychosocial/Kit"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { type AssessmentCycle, type Company, type CompanyStructure, psychosocialApi } from "@/lib/psychosocialApi"

export const Route = createFileRoute("/_layout/importacao")({ component: Importacao })

const DRPS_CODES = Object.entries({ DEM: 4, CON: 4, APL: 3, APE: 3, REL: 4, CLA: 3, MUD: 3, REC: 3, EQU: 3, ASS: 3 })
  .flatMap(([prefix, count]) => Array.from({ length: count }, (_, index) => `${prefix}_${String(index + 1).padStart(2, "0")}`))

const DRPS_QUESTIONS = [
  "Meu trabalho exige que eu trabalhe muito rapidamente", "Tenho pressão para cumprir prazos apertados", "Minha carga de trabalho é excessiva", "Preciso trabalhar além do meu horário com frequência",
  "Tenho autonomia para decidir como realizar meu trabalho", "Posso organizar meu ritmo de trabalho", "Tenho liberdade para tomar decisões dentro da minha função", "Tenho influência sobre as decisões que afetam meu trabalho",
  "Recebo apoio do meu superior quando necessário", "Meu superior trata os colaboradores com respeito", "Recebo orientações claras do meu gestor",
  "Posso contar com meus colegas de trabalho", "Existe colaboração entre a equipe", "Existe um bom relacionamento entre colegas",
  "Existem conflitos frequentes no ambiente de trabalho", "Existem comportamentos desrespeitosos entre colegas", "Existem comportamentos desrespeitosos por parte da liderança", "Sinto que sou tratado com justiça no trabalho",
  "Sei exatamente quais são as minhas responsabilidades", "Recebo instruções claras sobre meu trabalho", "Não recebo demandas conflitantes",
  "Sou informado sobre mudanças que afetam meu trabalho", "As mudanças são bem comunicadas pela empresa", "Tenho tempo para me adaptar às mudanças",
  "Meu trabalho é reconhecido pela empresa", "Recebo feedback sobre meu desempenho", "Sinto que meu esforço é valorizado",
  "Meu trabalho interfere na minha vida pessoal", "Tenho tempo suficiente para descanso", "Consigo equilibrar trabalho e vida pessoal",
  "Já me senti constrangido em meu ambiente de trabalho", "Já presenciei situações de desrespeito", "Sinto que posso relatar problemas sem medo de represálias",
]

const LIKERT_VALUES: Record<string, number> = {
  nunca: 1,
  munca: 1,
  raramente: 2,
  "as vezes": 3,
  frequentemente: 4,
  sempre: 5,
}

type ParsedResponse = { source_response_id: string; answers: Record<string, number>; function_name?: string; sector_name?: string; sector_id?: string; ghe_id?: string }

function normalize(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u00a0/g, " ").replace(/[^a-zA-Z0-9_]+/g, " ").trim().toLowerCase()
}

function likertValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5) return value
  const normalized = normalize(value)
  if (LIKERT_VALUES[normalized]) return LIKERT_VALUES[normalized]
  const numeric = Number(String(value ?? "").replace(",", "."))
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 5 ? numeric : null
}

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = []; let current = ""; let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"' && line[index + 1] === '"' && quoted) { current += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === delimiter && !quoted) { cells.push(current.trim()); current = "" }
    else current += char
  }
  cells.push(current.trim()); return cells
}

function parseRows(rows: string[][]): ParsedResponse[] {
  if (rows.length < 2) throw new Error("O arquivo não contém respostas.")
  const normalizedQuestions = DRPS_QUESTIONS.map(normalize)
  const headerScore = (row: string[]) => row.reduce((score, header) => {
    const value = normalize(header)
    return score + (DRPS_CODES.some((code) => value.includes(code.toLowerCase())) || normalizedQuestions.some((question) => value.includes(question)) ? 1 : 0)
  }, 0)
  const headerRowIndex = rows.slice(0, 10).map(headerScore).reduce((best, score, index, scores) => score > scores[best] ? index : best, 0)
  const headers = rows[headerRowIndex].map(normalize)
  const dataRows = rows.slice(headerRowIndex + 1).filter((row) => row.some((cell) => String(cell).trim()))
  let indexes = DRPS_CODES.map((code, codeIndex) => headers.findIndex((header) => header.includes(code.toLowerCase()) || header.includes(normalizedQuestions[codeIndex])))
  if (indexes.some((index) => index === -1)) {
    const ratingColumns = headers.map((_, index) => index).filter((index) => dataRows.length > 0 && dataRows.every((row) => likertValue(row[index]) !== null))
    if (ratingColumns.length < DRPS_CODES.length) throw new Error("Não foi possível localizar as 33 respostas DRPS. Use o modelo ou mantenha as questões na ordem oficial.")
    indexes = ratingColumns.slice(0, DRPS_CODES.length)
  }
  const idIndex = headers.findIndex((header) => ["id", "response_id", "source_response_id", "resposta_id"].includes(header))
  const functionIndex = headers.findIndex((header) => header === "funcao" || header.startsWith("funcao "))
  const sectorIndex = headers.findIndex((header) => header.includes("qual seu setor") || header === "setor")
  return dataRows.map((cells, rowIndex) => {
    const answers: Record<string, number> = {}
    DRPS_CODES.forEach((code, codeIndex) => {
      const raw = likertValue(cells[indexes[codeIndex]])
      if (raw === null) throw new Error(`Resposta inválida em ${code}, linha ${rowIndex + headerRowIndex + 2}. Use Nunca, Raramente, Às vezes, Frequentemente ou Sempre.`)
      answers[code] = raw
    })
    return { source_response_id: idIndex >= 0 && cells[idIndex] ? String(cells[idIndex]) : `linha-${rowIndex + headerRowIndex + 2}`, answers, function_name: functionIndex >= 0 ? String(cells[functionIndex] ?? "").trim() : undefined, sector_name: sectorIndex >= 0 ? String(cells[sectorIndex] ?? "").trim() : undefined }
  })
}

function parseCsv(text: string): ParsedResponse[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) throw new Error("O arquivo não contém respostas.")
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ","
  return parseRows(lines.map((line) => splitCsvLine(line, delimiter)))
}

async function parseXlsx(file: File): Promise<ParsedResponse[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!firstSheet) throw new Error("A planilha não possui uma aba com respostas.")
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | Date)[]>(firstSheet, {
    header: 1,
    raw: false,
    defval: "",
  })
  return parseRows(rows.map((row) => row.map((cell) => cell == null ? "" : String(cell))))
}

function downloadTemplate() {
  const sample = DRPS_CODES.map(() => "3").join(";")
  const content = `response_id;${DRPS_CODES.join(";")}\nexemplo-001;${sample}\n`
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }))
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "modelo_importacao_drps.csv"; anchor.click(); URL.revokeObjectURL(url)
}

function Importacao() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyId, setCompanyId] = useState(localStorage.getItem("psychosocial:companyId") ?? "")
  const [cycles, setCycles] = useState<AssessmentCycle[]>([])
  const [structure, setStructure] = useState<CompanyStructure | null>(null)
  const [cycleId, setCycleId] = useState(localStorage.getItem("psychosocial:cycleId") ?? "")
  const [fileName, setFileName] = useState("")
  const [responses, setResponses] = useState<ParsedResponse[]>([])
  const [error, setError] = useState("")
  const [processing, setProcessing] = useState(false)
  const cycle = useMemo(() => cycles.find((item) => item.id === cycleId), [cycles, cycleId])
  const company = useMemo(() => companies.find((item) => item.id === companyId), [companies, companyId])
  const step = processing ? 3 : responses.length ? 2 : fileName ? 1 : 0

  useEffect(() => { psychosocialApi.companies().then(({ data }) => { setCompanies(data); const saved = localStorage.getItem("psychosocial:companyId"); setCompanyId(data.some((item) => item.id === saved) ? saved! : data[0]?.id ?? "") }).catch((reason) => toast.error(reason.message)) }, [])
  useEffect(() => {
    let current = true
    if (!companyId) { setCycles([]); setCycleId(""); return () => { current = false } }
    localStorage.setItem("psychosocial:companyId", companyId)
    Promise.all([psychosocialApi.cycles(companyId), psychosocialApi.structure(companyId)]).then(([data, companyStructure]) => {
      if (!current) return
      setCycles(data)
      setStructure(companyStructure)
      const saved = localStorage.getItem("psychosocial:cycleId")
      setCycleId(data.some((item) => item.id === saved) ? saved! : "")
    }).catch((reason) => toast.error(reason.message))
    return () => { current = false }
  }, [companyId])

  const changeCompany = (selectedId: string) => {
    setCompanyId(selectedId); setCycleId(""); setFileName(""); setResponses([]); setError("")
    localStorage.setItem("psychosocial:companyId", selectedId); localStorage.removeItem("psychosocial:cycleId")
  }
  const changeCycle = (selectedId: string) => {
    setCycleId(selectedId); setFileName(""); setResponses([]); setError("")
    if (selectedId) localStorage.setItem("psychosocial:cycleId", selectedId)
  }

  const selectFile = async (file?: File) => {
    if (!file) return
    setFileName(file.name); setResponses([]); setError("")
    try {
      const extension = file.name.toLowerCase()
      if (!extension.endsWith(".csv") && !extension.endsWith(".xlsx")) throw new Error("Utilize o arquivo .xlsx do Microsoft Forms ou um arquivo .csv.")
      if (file.size > 25 * 1024 * 1024) throw new Error("O arquivo ultrapassa o limite de 25 MB.")
      const parsed = extension.endsWith(".xlsx")
        ? await parseXlsx(file)
        : parseCsv(await file.text())
      const linked = parsed.map((row) => {
        if (!row.function_name) return row
        const role = structure?.job_roles.find((item) => normalize(item.name) === normalize(row.function_name))
        if (!role) throw new Error(`A função “${row.function_name}” ainda não está vinculada a um GHE. Cadastre-a na aba Cadastros antes de importar.`)
        const ghe = structure?.ghes.find((item) => item.id === role.ghe_id)
        const sector = structure?.sectors.find((item) => item.id === ghe?.sector_id)
        return { ...row, ghe_id: ghe?.id, sector_id: sector?.id }
      })
      setResponses(linked)
      if (cycle && linked.length < cycle.minimum_respondents) throw new Error(`O ciclo exige ao menos ${cycle.minimum_respondents} respondentes; o arquivo possui ${linked.length}.`)
      toast.success(`${linked.length} respostas validadas e vinculadas à estrutura.`)
    } catch (reason) { const message = reason instanceof Error ? reason.message : "Arquivo inválido."; setError(message); toast.error(message) }
  }

  const processImport = async () => {
    if (!cycleId || !responses.length || error || !company || !cycle) return
    if (!window.confirm(`Confirmar importação de ${responses.length} respostas para:\n\n${company.trade_name || company.legal_name}\n${cycle.name}`)) return
    setProcessing(true)
    try {
      const result = await psychosocialApi.importDrps({ cycle_id: cycleId, responses })
      localStorage.setItem("psychosocial:companyId", companyId)
      localStorage.setItem("psychosocial:cycleId", cycleId)
      localStorage.setItem("psychosocial:lastImport", JSON.stringify({ fileName, date: new Date().toISOString(), imported: result.imported }))
      toast.success(`${result.imported} respostas processadas em ${company.trade_name || company.legal_name} — ${cycle.name}.`)
      window.location.href = "/resultados"
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Falha no processamento.") }
    finally { setProcessing(false) }
  }

  return <div className="space-y-6">
    <PageHeader eyebrow="Coleta DRPS" title="Importar respostas" description="Importe o Excel do Microsoft Forms, valide as 33 questões e processe os resultados anonimamente." action={<div className="flex flex-wrap gap-2"><FormsSyncButton cycleId={cycleId} /><Button variant="outline" onClick={downloadTemplate}><Download /> Baixar modelo CSV</Button></div>} />
    <div className="filter-bar"><select value={companyId} onChange={(event) => changeCompany(event.target.value)}><option value="">Empresa</option>{companies.map((item) => <option value={item.id} key={item.id}>{item.trade_name || item.legal_name}</option>)}</select><select value={cycleId} onChange={(event) => changeCycle(event.target.value)}><option value="">Selecione o ciclo de avaliação</option>{cycles.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{!cycles.length && <Button asChild variant="outline"><Link to="/cadastros">Criar ciclo</Link></Button>}</div>
    <div className="stepper">{["Fonte", "Mapeamento", "Validação", "Processamento"].map((label, index) => <div className={index <= step ? "active" : ""} key={label}><span>{index + 1}</span><b>{label}</b></div>)}</div>
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <SectionCard title="Selecione a fonte"><div className="import-drop"><UploadCloud /><h3>{fileName || "Selecione a planilha de respostas"}</h3><p>Arquivo .xlsx do Microsoft Forms ou .csv, com as 33 questões na ordem oficial</p><Button asChild disabled={!cycleId}><label>Selecionar arquivo<input hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,text/csv" onChange={(event) => selectFile(event.target.files?.[0])} /></label></Button><small>Máximo de 25 MB</small></div>{error && <div className="privacy-banner"><div><b>Arquivo não validado</b><p>{error}</p></div></div>}{responses.length > 0 && !error && <div className="privacy-callout"><Check /><div><b>{responses.length} respostas válidas</b><p>33 questões reconhecidas em cada linha. Nenhum nome ou e-mail será armazenado.</p></div></div>}</SectionCard>
      <SectionCard title="Proteção e processamento"><div className="privacy-callout"><ShieldCheck /><div><b>Destino da importação</b><p>{company && cycle ? `${company.trade_name || company.legal_name} — ${cycle.name}` : "Selecione a empresa e o ciclo antes de importar."}</p></div></div><ul className="check-list"><li><Check />33 questões obrigatórias</li><li><Check />10 dimensões reconhecidas</li><li><Check />Escala Likert de 1 a 5</li><li><Check />Duplicidades substituídas pelo ID</li></ul><label className="form-field"><span>Mínimo do ciclo</span><InputLike value={cycle ? `${cycle.minimum_respondents} respondentes` : "Selecione um ciclo"} /></label><Button className="w-full" onClick={processImport} disabled={!cycleId || !responses.length || Boolean(error) || processing}>{processing ? "Processando…" : "Processar respostas"}</Button></SectionCard>
    </div>
    <SectionCard title="Último arquivo selecionado"><div className="responsive-table"><table><thead><tr><th>Arquivo</th><th>Respostas</th><th>Questões</th><th>Status</th></tr></thead><tbody><tr><td><b>{fileName || "Nenhum arquivo"}</b></td><td>{responses.length || "—"}</td><td>{responses.length ? 33 : "—"}</td><td><span className={`status ${responses.length && !error ? "success" : ""}`}>{error ? "Com erro" : responses.length ? "Validado" : "Aguardando"}</span></td></tr></tbody></table></div></SectionCard>
  </div>
}

function InputLike({ value }: { value: string }) { return <div className="rounded-md border px-3 py-2 text-sm">{value}</div> }

function FormsSyncButton({ cycleId }: { cycleId: string }) {
  return <Dialog>
    <DialogTrigger asChild><Button disabled={!cycleId}><RefreshCw /> Sincronizar com Microsoft Forms</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Conectar ao Microsoft Forms</DialogTitle><DialogDescription>A sincronização direta requer autorização da conta Microsoft responsável pelo formulário.</DialogDescription></DialogHeader>
      <div className="space-y-3 text-sm"><div className="privacy-callout"><ShieldCheck /><div><b>Conexão ainda não configurada</b><p>Será necessário autorizar a leitura do arquivo de respostas armazenado no OneDrive ou SharePoint.</p></div></div><p>Enquanto a conexão não for autorizada, continue usando o arquivo <b>.xlsx</b> baixado do Forms. O sistema já aceita esse formato.</p></div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose><Button disabled>Conectar conta Microsoft</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
