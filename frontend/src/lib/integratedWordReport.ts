import { AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, PageNumber, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } from "docx"
import type { AepAssessment, AepEvidence, AssessmentCycle, Company, CompanyStructure, DrpsResult, Ghe } from "@/lib/psychosocialApi"

const BLUE = "337DB7", LIGHT = "D9E8F5", PALE = "EEF5FB", WHITE = "FFFFFF", INK = "17212B", MUTED = "52606D", WIDTH = 10766
const borders = { top: { style: BorderStyle.SINGLE, size: 4, color: BLUE }, bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE }, left: { style: BorderStyle.SINGLE, size: 4, color: BLUE }, right: { style: BorderStyle.SINGLE, size: 4, color: BLUE } }
const riskLabel = { irrelevante: "Irrelevante", baixo: "Baixo", médio: "Médio", alto: "Alto", crítico: "Crítico" }
const actions: Record<string, string> = {
  DEM: "Revisar volume, ritmo, prioridades, prazos e distribuição das atividades.", CON: "Ampliar participação e autonomia compatíveis com as responsabilidades.", APL: "Fortalecer orientação, apoio e feedback das lideranças.", APE: "Aprimorar cooperação, comunicação e suporte entre trabalhadores.", REL: "Prevenir conflitos e fortalecer relações respeitosas entre equipes.", CLA: "Formalizar atribuições, prioridades e expectativas de desempenho.", MUD: "Planejar, comunicar e acompanhar mudanças organizacionais.", REC: "Estruturar práticas transparentes de feedback e reconhecimento.", EQU: "Revisar jornada, pausas, previsibilidade e demandas fora do horário.", ASS: "Fortalecer segurança psicológica, canais e procedimentos de apuração.",
}
export type AepReportBundle = { ghe: Ghe; sectorName: string; assessment: AepAssessment | null; evidences: AepEvidence[] }
type Input = { company: Company; cycle: AssessmentCycle; structure: CompanyStructure; drps: DrpsResult; aep: AepReportBundle[]; mode: "rtirp" | "integration"; logoData?: ArrayBuffer }

function run(value: string, bold = false, color = INK, size = 19) { return new TextRun({ text: value, bold, color, size, font: "Arial" }) }
function para(value: string, options: { bold?: boolean; color?: string; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number } = {}) { return new Paragraph({ alignment: options.align, spacing: { before: options.before ?? 0, after: options.after ?? 110, line: 276 }, children: [run(value, options.bold, options.color, options.size)] }) }
function cell(value: string, width: number, options: { bold?: boolean; fill?: string; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; size?: number } = {}) { return new TableCell({ width: { size: width, type: WidthType.DXA }, borders, shading: options.fill ? { type: ShadingType.CLEAR, fill: options.fill } : undefined, verticalAlign: VerticalAlign.CENTER, margins: { top: 110, bottom: 110, left: 130, right: 130 }, children: [para(value || "—", { bold: options.bold, color: options.color, size: options.size ?? 17, align: options.align, after: 0 })] }) }
function table(rows: TableRow[], widths: number[]) { return new Table({ rows, width: { size: WIDTH, type: WidthType.DXA }, columnWidths: widths, layout: "fixed" }) }
function section(number: string, title: string) { return table([new TableRow({ children: [cell(`${number} - ${title}`, WIDTH, { bold: true, fill: BLUE, color: WHITE, size: 22 })] })], [WIDTH]) }
function headerRow(labels: string[], widths: number[]) { return new TableRow({ tableHeader: true, children: labels.map((label, index) => cell(label, widths[index], { bold: true, fill: LIGHT, align: AlignmentType.CENTER, size: 15 })) }) }
function safe(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") }

async function build(input: Input) {
  const { company, cycle, structure, drps, aep, mode, logoData } = input
  const completed = aep.filter((item) => item.assessment?.completed_at)
  const pending = aep.filter((item) => !item.assessment?.completed_at)
  const allEvidence = aep.reduce((sum, item) => sum + item.evidences.length, 0)
  const integration = drps.dimensions.map((dimension) => {
    const scores = completed.flatMap((bundle) => bundle.assessment?.answers.filter((answer) => answer.item_code.startsWith(`${dimension.code}.`)).map((answer) => answer.score) ?? [])
    const aepMax = scores.length ? Math.max(...scores) : undefined
    const drpsUnfavorable = ["médio", "alto", "crítico"].includes(dimension.risk)
    const aepUnfavorable = aepMax === undefined ? undefined : aepMax >= 2
    const status = aepUnfavorable === undefined ? "Pendente" : drpsUnfavorable === aepUnfavorable ? (drpsUnfavorable ? "Convergência de risco" : "Convergência favorável") : "Divergência"
    const referral = status === "Convergência de risco" ? "Priorizar no PGR" : status === "Convergência favorável" ? "Manter controles" : status === "Divergência" ? "Aprofundar evidências" : "Concluir AEP-PS"
    return { ...dimension, aepMax, status, referral }
  })
  const priority = integration.filter((item) => item.status === "Convergência de risco" || item.status === "Divergência")
  const metaW = [1900, 3483, 1900, 3483]
  const meta = table([
    new TableRow({ children: [cell("EMPRESA", metaW[0], { bold: true, fill: LIGHT }), cell(company.trade_name || company.legal_name, metaW[1]), cell("CNPJ", metaW[2], { bold: true, fill: LIGHT }), cell(company.cnpj, metaW[3])] }),
    new TableRow({ children: [cell("CICLO", metaW[0], { bold: true, fill: LIGHT }), cell(cycle.name, metaW[1]), cell("DATA", metaW[2], { bold: true, fill: LIGHT }), cell(new Date(`${cycle.assessment_date}T12:00:00`).toLocaleDateString("pt-BR"), metaW[3])] }),
    new TableRow({ children: [cell("ABRANGÊNCIA", metaW[0], { bold: true, fill: LIGHT }), cell(`${structure.sectors.length} setor(es) · ${structure.ghes.length} GHE(s)`, metaW[1]), cell("SITUAÇÃO", metaW[2], { bold: true, fill: LIGHT }), cell(pending.length ? "Relatório parcial" : "Ciclo integrado", metaW[3], { bold: true, fill: pending.length ? "FFF2CC" : "DCEBD2" })] }),
  ], metaW)
  const intW = [2700, 1450, 1450, 2866, 2300]
  const intRows = [headerRow(["Dimensão", "DRPS", "AEP-PS", "Integração", "Encaminhamento"], intW), ...integration.map((item) => new TableRow({ cantSplit: true, children: [cell(item.name, intW[0]), cell(`${item.mean.toFixed(2).replace(".", ",")} · ${riskLabel[item.risk]}`, intW[1], { align: AlignmentType.CENTER, size: 15 }), cell(item.aepMax === undefined ? "Pendente" : String(item.aepMax), intW[2], { align: AlignmentType.CENTER }), cell(item.status, intW[3], { bold: true, fill: item.status === "Convergência de risco" ? "F8D7DA" : item.status === "Divergência" ? "FFF2CC" : PALE, align: AlignmentType.CENTER, size: 15 }), cell(item.referral, intW[4], { size: 15 })] }))]
  const aepW = [2900, 2500, 1700, 1666, 2000]
  const aepRows = [headerRow(["Setor", "GHE", "Situação", "Evidências", "Maior nota AEP"], aepW), ...aep.map((bundle) => { const scores = bundle.assessment?.answers.map((answer) => answer.score) ?? []; return new TableRow({ cantSplit: true, children: [cell(bundle.sectorName, aepW[0]), cell(bundle.ghe.name, aepW[1]), cell(bundle.assessment?.completed_at ? "Concluída" : bundle.assessment ? "Rascunho" : "Não iniciada", aepW[2], { align: AlignmentType.CENTER }), cell(String(bundle.evidences.length), aepW[3], { align: AlignmentType.CENTER }), cell(scores.length ? String(Math.max(...scores)) : "—", aepW[4], { align: AlignmentType.CENTER })] }) })]
  const recW = [2400, 4566, 1700, 2100]
  const recRows = [headerRow(["Fator", "Recomendação técnica", "Prazo orientativo", "Indicador sugerido"], recW), ...(priority.length ? priority.map((item) => new TableRow({ cantSplit: true, children: [cell(item.name, recW[0], { bold: true }), cell(actions[item.code] ?? "Avaliar medida preventiva compatível com os achados.", recW[1]), cell(item.status === "Convergência de risco" ? "Até 90 dias" : "Até 180 dias", recW[2], { align: AlignmentType.CENTER }), cell("Registro da medida e verificação da condição", recW[3])] })) : [new TableRow({ children: [cell("Manter os controles existentes e realizar verificação periódica.", WIDTH)] })])]
  const header = new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: logoData ? [new ImageRun({ data: logoData, type: "png", transformation: { width: 168, height: 55 } })] : [run("SEALAB MEDICINA OCUPACIONAL", true, BLUE, 22)] })] })
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Metodologia Sealab  |  ", false, MUTED, 16), new TextRun({ children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], font: "Arial", size: 16, color: MUTED })] })] })
  const title = mode === "rtirp" ? "RELATÓRIO TÉCNICO INTEGRADO DE RISCOS PSICOSSOCIAIS" : "ORIENTAÇÕES PARA INTEGRAÇÃO AO GRO/PGR"
  const opening = [para(title, { bold: true, color: BLUE, size: 27, align: AlignmentType.CENTER, after: 60 }), para(mode === "rtirp" ? "Diagnóstico organizacional, integração AEP-PS e recomendações técnicas" : "Resumo técnico DRPS × AEP-PS", { color: MUTED, size: 18, align: AlignmentType.CENTER, after: 220 })]
  const statusParagraph = pending.length
    ? para(`DOCUMENTO PARCIAL: permanecem pendentes as AEP-PS de ${pending.map((item) => `${item.sectorName} / ${item.ghe.name}`).join("; ")}. O parecer deverá ser atualizado após a conclusão dessas avaliações.`, { color: "8A5A00", bold: true, after: 150 })
    : para("Todas as AEP-PS dos GHEs cadastrados foram concluídas, permitindo a consolidação integrada do ciclo.", { after: 150 })
  const controlW = [3300, 7466]
  const controlTable = table([
    headerRow(["Item", "Informação"], controlW),
    new TableRow({ children: [cell("Documento", controlW[0]), cell("Relatório Técnico Integrado de Riscos Psicossociais", controlW[1])] }),
    new TableRow({ children: [cell("Empresa", controlW[0]), cell(company.legal_name, controlW[1])] }),
    new TableRow({ children: [cell("Metodologia", controlW[0]), cell("DRPS Sealab + AEP-PS por GHE", controlW[1])] }),
    new TableRow({ children: [cell("Base técnica", controlW[0]), cell("HSE-IT adaptado, NR-01, NR-17 e ISO 45003", controlW[1])] }),
    new TableRow({ children: [cell("Emissão", controlW[0]), cell(new Date().toLocaleDateString("pt-BR"), controlW[1])] }),
    new TableRow({ children: [cell("Revisão", controlW[0]), cell("00", controlW[1])] }),
    new TableRow({ children: [cell("Validade orientativa", controlW[0]), cell("12 meses ou até mudança relevante nas condições avaliadas", controlW[1])] }),
  ], controlW)
  const summaryW = [5383, 5383]
  const summaryTable = table([
    headerRow(["Indicador", "Resultado"], summaryW),
    new TableRow({ children: [cell("Respondentes válidos no DRPS", summaryW[0]), cell(String(drps.respondent_count), summaryW[1], { align: AlignmentType.CENTER })] }),
    new TableRow({ children: [cell("Índice geral psicossocial", summaryW[0]), cell(drps.general_mean.toFixed(2).replace(".", ","), summaryW[1], { align: AlignmentType.CENTER })] }),
    new TableRow({ children: [cell("Classificação geral", summaryW[0]), cell(riskLabel[drps.overall_risk], summaryW[1], { align: AlignmentType.CENTER })] }),
    new TableRow({ children: [cell("Principal fator DRPS", summaryW[0]), cell(drps.dimensions.find((item) => item.code === drps.priority_dimension)?.name ?? drps.priority_dimension, summaryW[1], { align: AlignmentType.CENTER })] }),
    new TableRow({ children: [cell("AEP-PS concluídas", summaryW[0]), cell(`${completed.length} de ${aep.length} GHEs`, summaryW[1], { align: AlignmentType.CENTER })] }),
    new TableRow({ children: [cell("Evidências anexadas", summaryW[0]), cell(String(allEvidence), summaryW[1], { align: AlignmentType.CENTER })] }),
  ], summaryW)
  const riskW = [2800, 4166, 1800, 2000]
  const riskRows = [headerRow(["Fator prioritário", "Recomendação técnica", "Prazo", "Indicador"], riskW), ...(priority.length ? priority.map((item) => new TableRow({ cantSplit: true, children: [cell(item.name, riskW[0], { bold: true }), cell(actions[item.code] ?? "Avaliar medida preventiva compatível com os achados.", riskW[1]), cell(item.status === "Convergência de risco" ? "Até 90 dias" : "Até 180 dias", riskW[2], { align: AlignmentType.CENTER }), cell("Registro e verificação da condição", riskW[3])] })) : [new TableRow({ children: [cell("Manter controles e realizar verificação periódica.", WIDTH)] })])]
  let children: Array<Paragraph | Table> = [...opening]
  if (mode === "rtirp") {
    children = [...children,
      section("1", "CONTROLE DO DOCUMENTO"), controlTable, para("", { after: 100 }),
      section("2", "FLUXO METODOLÓGICO DA AVALIAÇÃO"), para("DRPS (percepção coletiva) → AEP-PS por GHE (avaliação técnica de campo) → análise das evidências → matriz de convergência e divergência → recomendações ao GRO/PGR → emissão do RTIRP.", { before: 130, after: 160 }),
      section("3", "DADOS DA EMPRESA"), meta, para("", { after: 100 }),
      section("4", "RESUMO"), summaryTable, para(`O ciclo apresentou classificação geral ${riskLabel[drps.overall_risk]}, com índice ${drps.general_mean.toFixed(2).replace(".", ",")}. A consolidação integra a percepção dos trabalhadores, as avaliações técnicas dos GHEs e as evidências disponíveis.`, { before: 130 }), statusParagraph,
      section("5", "APRESENTAÇÃO"), para("O presente Relatório Técnico Integrado de Riscos Psicossociais consolida as etapas da metodologia Sealab para identificar, analisar e priorizar fatores psicossociais relacionados à organização do trabalho. O documento fornece subsídios técnicos à empresa contratante para tomada de decisão e integração das medidas pertinentes ao gerenciamento de riscos ocupacionais.", { before: 130, after: 160 }),
      section("6", "OBJETIVO"), para("Identificar o cenário psicossocial organizacional e por GHE, integrar os resultados do DRPS às evidências da AEP-PS, reconhecer convergências e divergências, estabelecer prioridades e propor ações, indicadores e prazos orientativos para avaliação e implementação pela empresa contratante.", { before: 130, after: 160 }),
      section("7", "METODOLOGIA"), para("O DRPS utiliza questionário estruturado em dez dimensões e escala de 1 a 5 para representar a percepção coletiva dos trabalhadores. A AEP-PS avalia tecnicamente, por GHE, a atividade real e a organização do trabalho em escala de 0 a 3. Os instrumentos não são somados por média matemática: a integração classifica convergências e divergências e orienta o aprofundamento técnico antes da avaliação final no PGR.", { before: 130 }), para("A confidencialidade é preservada pelo mínimo de respondentes do ciclo. Resultados abaixo desse limite não são individualizados nem apresentados como recortes coletivos válidos.", { after: 160 }),
      section("8", "REFERÊNCIAS TÉCNICAS E LEGAIS"), para("NR-01 — Gerenciamento de Riscos Ocupacionais e PGR; NR-17 — Ergonomia; Guia de Fatores Psicossociais do MTE; ISO 45003; HSE Management Standards Indicator Tool; metodologia DRPS e AEP-PS Sealab.", { before: 130, after: 160 }),
      section("9", "PERFIL DA AMOSTRA E ABRANGÊNCIA"), para(`A avaliação DRPS contou com ${drps.respondent_count} respostas válidas. A estrutura cadastrada abrange ${structure.sectors.length} setor(es), ${structure.ghes.length} GHE(s) e ${structure.job_roles.length} função(ões). A AEP-PS foi concluída em ${completed.length} GHE(s).`, { before: 130 }), table(aepRows, aepW), para("", { after: 100 }),
      section("10", "RESULTADO GERAL DA EMPRESA"), para(`O resultado geral foi classificado como ${riskLabel[drps.overall_risk]}, com índice ${drps.general_mean.toFixed(2).replace(".", ",")}. O fator prioritário no DRPS foi ${drps.dimensions.find((item) => item.code === drps.priority_dimension)?.name ?? drps.priority_dimension}.`, { before: 130 }), table(intRows, intW), para("A matriz acima deve ser interpretada como relação técnica entre percepção coletiva e avaliação de campo, não como comprovação isolada de causalidade, adoecimento ou conduta individual.", { color: MUTED, size: 16, before: 90, after: 150 }),
      section("11", "MATRIZ DE PRIORIZAÇÃO DE AÇÕES"), table(riskRows, riskW), para("As convergências de risco recebem prioridade. Divergências exigem aprofundamento das evidências, do contexto e dos controles antes da definição no PGR.", { before: 100, after: 150 }),
      section("12", "PLANO DE AÇÃO CONSOLIDADO"), table(recRows, recW), para("As ações possuem caráter recomendativo. A empresa contratante deverá definir os responsáveis internos, os recursos e o cronograma de implementação.", { color: MUTED, size: 16, before: 90, after: 150 }),
      section("13", "CRITÉRIOS RECOMENDADOS DE MONITORAMENTO"), para("Recomenda-se à empresa verificar a implementação por registros documentais, comunicação aos trabalhadores, evidências de treinamento ou revisão de processos, indicadores definidos no plano e percepção dos grupos envolvidos. A Sealab fornece o direcionamento técnico; o acompanhamento operacional e a guarda das evidências cabem à contratante.", { before: 130 }), para("A reavaliação é recomendada em periodicidade definida pela organização, preferencialmente anual, ou antecipadamente diante de mudanças relevantes nos processos, no efetivo, nas atividades, nos GHEs ou na organização do trabalho.", { after: 160 }),
      section("14", "CONCLUSÃO TÉCNICA"), para(`A análise integrada identificou ${integration.filter((item) => item.status === "Convergência de risco").length} convergência(s) de risco e ${integration.filter((item) => item.status === "Divergência").length} divergência(s). As convergências reforçam a prioridade das medidas recomendadas; as divergências requerem análise complementar antes da conclusão no GRO/PGR.`, { before: 130 }), para("Os achados constituem subsídio técnico preventivo e devem ser analisados sem individualização das respostas e sem interpretação clínica. Recomenda-se integrar os fatores e medidas pertinentes ao inventário de riscos e ao plano de ação do PGR, observando a organização real do trabalho, os controles existentes e as evidências registradas.", { after: 160 }),
      section("15", "RESPONSABILIDADES TÉCNICAS E APROVAÇÃO"), table([new TableRow({ children: [cell("ELABORAÇÃO", 5383, { bold: true, fill: LIGHT, align: AlignmentType.CENTER }), cell("REVISÃO / VALIDAÇÃO TÉCNICA", 5383, { bold: true, fill: LIGHT, align: AlignmentType.CENTER })] }), new TableRow({ children: [cell("\n\n\n________________________________\nNome / função / registro\nAssinatura e data", 5383, { align: AlignmentType.CENTER }), cell("\n\n\n________________________________\nNome / função / registro\nAssinatura e data", 5383, { align: AlignmentType.CENTER })] })], [5383, 5383]),
    ]
  } else {
    children = [...children, meta, para("", { after: 100 }), section("1", "RESUMO EXECUTIVO"), para(`O ciclo possui ${drps.respondent_count} respostas válidas, índice geral ${drps.general_mean.toFixed(2).replace(".", ",")} e classificação ${riskLabel[drps.overall_risk]}.`, { before: 130 }), statusParagraph, section("2", "SITUAÇÃO DAS AEP-PS POR GHE"), table(aepRows, aepW), para("", { after: 100 }), section("3", "MATRIZ DRPS × AEP-PS"), table(intRows, intW), para("Não é calculada média matemática entre DRPS e AEP-PS.", { color: MUTED, size: 16, before: 90, after: 150 }), section("4", "ORIENTAÇÕES À EMPRESA CONTRATANTE"), table(recRows, recW)]
  }
  return Packer.toBlob(new Document({ creator: "Sealab", title, styles: { default: { document: { run: { font: "Arial", size: 19, color: INK }, paragraph: { spacing: { after: 110, line: 276 } } } } }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 900, bottom: 900, left: 570, right: 570, header: 450, footer: 450 } } }, headers: { default: header }, footers: { default: footer }, children }] }))
}

export async function generateIntegratedWordReport(input: Omit<Input, "logoData">) {
  const logoData = await fetch("/assets/images/sealab-logo-report.png").then((response) => response.arrayBuffer()).catch(() => undefined)
  const blob = await build({ ...input, logoData })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `${input.mode === "rtirp" ? "RTIRP" : "Integracao-PGR"}-${safe(input.company.trade_name || input.company.legal_name)}-${safe(input.cycle.name)}.docx`
  link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
