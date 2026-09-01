import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx"
import type { AepEvidence, AepItem, AssessmentCycle, Company, DrpsResult, Ghe, JobRole, Sector } from "@/lib/psychosocialApi"

const BLUE = "337DB7"
const LIGHT_BLUE = "D9E8F5"
const PALE_BLUE = "EEF5FB"
const WHITE = "FFFFFF"
const INK = "17212B"
const MUTED = "52606D"
const WIDTH = 10766
const scoreLabels = ["Não aplicável", "Controlado", "Requer atenção", "Requer intervenção"]
const scoreColors = ["E5E7EB", "DCEBD2", "FFF2CC", "F8D7DA"]
const borders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "9CC2E5" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "9CC2E5" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "9CC2E5" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "9CC2E5" },
}

export type AepReportAnswer = { score?: number; evidence: string; existingControls: string }
type AepReportInput = {
  company: Company
  cycle: AssessmentCycle
  sector?: Sector
  ghe: Ghe
  roles: JobRole[]
  items: AepItem[]
  answers: Record<string, AepReportAnswer>
  evidenceSources: string[]
  evidences: AepEvidence[]
  notes: string
  drpsResult?: DrpsResult
  logoData?: ArrayBuffer
}

const recommendations: Record<string, string> = {
  D01: "Revisar volume, ritmo, prioridades, prazos, pausas e distribuição das atividades.",
  D02: "Avaliar possibilidades de participação, autonomia e adequação entre responsabilidade e poder de decisão.",
  D03: "Fortalecer orientação, disponibilidade, feedback e apoio da liderança na priorização das demandas.",
  D04: "Aprimorar cooperação, comunicação, ajuda mútua e distribuição colaborativa das atividades.",
  D05: "Adotar medidas preventivas de comunicação respeitosa, tratamento de conflitos e integração entre áreas.",
  D06: "Formalizar atribuições, prioridades, limites de atuação e expectativas de desempenho.",
  D07: "Planejar e comunicar mudanças, assegurando orientação, preparação e participação quando aplicável.",
  D08: "Estruturar práticas de feedback, valorização, reconhecimento e desenvolvimento profissional.",
  D09: "Revisar jornada, pausas, previsibilidade das escalas e demandas fora do horário habitual.",
  D10: "Fortalecer respeito, segurança psicológica, canais de comunicação e procedimentos próprios de apuração.",
}

function text(value: string, bold = false, color = INK, size = 19) {
  return new TextRun({ text: value, bold, color, size, font: "Arial" })
}
function paragraph(value: string, options: { bold?: boolean; color?: string; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number } = {}) {
  return new Paragraph({
    alignment: options.align,
    spacing: { before: options.before ?? 0, after: options.after ?? 100, line: 276 },
    children: [text(value, options.bold, options.color, options.size)],
  })
}
function cell(value: string, width: number, options: { bold?: boolean; fill?: string; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; size?: number } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA }, borders,
    shading: options.fill ? { type: ShadingType.CLEAR, fill: options.fill } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 110, bottom: 110, left: 130, right: 130 },
    children: [paragraph(value || "—", { bold: options.bold, color: options.color, size: options.size ?? 18, align: options.align, after: 0 })],
  })
}
function table(rows: TableRow[], widths: number[]) {
  return new Table({ rows, width: { size: WIDTH, type: WidthType.DXA }, columnWidths: widths, layout: "fixed" })
}
function sectionTitle(number: string, title: string) {
  return table([new TableRow({ children: [cell(`${number} - ${title}`, WIDTH, { bold: true, fill: BLUE, color: WHITE, size: 22 })] })], [WIDTH])
}
function headerRow(labels: string[], widths: number[]) {
  return new TableRow({ tableHeader: true, children: labels.map((label, index) => cell(label, widths[index], { bold: true, fill: LIGHT_BLUE, align: AlignmentType.CENTER, size: 16 })) })
}
function safeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")
}

function signatureCell(width: number) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    verticalAlign: VerticalAlign.BOTTOM,
    margins: { top: 180, bottom: 180, left: 220, right: 220 },
    children: [
      paragraph("", { after: 720 }),
      paragraph("____________________________________________", { align: AlignmentType.CENTER, after: 120 }),
      paragraph("Nome:", { size: 17, after: 80 }),
      paragraph("Registro profissional:", { size: 17, after: 80 }),
      paragraph("Assinatura:", { size: 17, after: 80 }),
      paragraph("Data: ____/____/________", { size: 17, after: 0 }),
    ],
  })
}

async function buildAepWordReport(input: AepReportInput) {
  const { company, cycle, sector, ghe, roles, items, answers, evidenceSources, evidences, notes, drpsResult, logoData } = input
  const answeredItems = items.filter((item) => answers[item.code]?.score !== undefined)
  const attentionItems = answeredItems.filter((item) => (answers[item.code].score ?? 0) >= 2)
  const dimensions = Array.from(new Map(items.map((item) => [item.dimension_code, item.dimension_name])).entries())
  const header = new Header({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: logoData ? [new ImageRun({ data: logoData, transformation: { width: 168, height: 55 }, type: "png" })] : [text("SEALAB MEDICINA OCUPACIONAL", true, BLUE, 22)],
  })] })
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [text("AEP-PS Sealab  |  ", false, MUTED, 16), new TextRun({ children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], font: "Arial", size: 16, color: MUTED })] })] })
  const metaWidths = [2100, 3283, 2100, 3283]
  const meta = table([
    new TableRow({ children: [cell("EMPRESA", metaWidths[0], { bold: true, fill: LIGHT_BLUE }), cell(company.trade_name || company.legal_name, metaWidths[1]), cell("CNPJ", metaWidths[2], { bold: true, fill: LIGHT_BLUE }), cell(company.cnpj, metaWidths[3])] }),
    new TableRow({ children: [cell("CICLO DRPS", metaWidths[0], { bold: true, fill: LIGHT_BLUE }), cell(cycle.name, metaWidths[1]), cell("DATA", metaWidths[2], { bold: true, fill: LIGHT_BLUE }), cell(new Date(`${cycle.assessment_date}T12:00:00`).toLocaleDateString("pt-BR"), metaWidths[3])] }),
    new TableRow({ children: [cell("SETOR", metaWidths[0], { bold: true, fill: LIGHT_BLUE }), cell(sector?.name ?? "Não informado", metaWidths[1]), cell("GHE", metaWidths[2], { bold: true, fill: LIGHT_BLUE }), cell(ghe.name, metaWidths[3])] }),
    new TableRow({ children: [cell("FUNÇÕES", metaWidths[0], { bold: true, fill: LIGHT_BLUE }), cell(roles.map((role) => role.name).join("; ") || "Não cadastradas", metaWidths[1]), cell("TRABALHADORES", metaWidths[2], { bold: true, fill: LIGHT_BLUE }), cell(String(ghe.worker_count), metaWidths[3])] }),
  ], metaWidths)
  const summaryWidths = [3589, 3588, 3589]
  const summary = table([new TableRow({ children: [
    cell(`${answeredItems.length}/${items.length}\nItens avaliados`, summaryWidths[0], { bold: true, fill: PALE_BLUE, align: AlignmentType.CENTER, size: 20 }),
    cell(`${attentionItems.length}\nItens que requerem atenção/intervenção`, summaryWidths[1], { bold: true, fill: attentionItems.length ? "FFF2CC" : "DCEBD2", align: AlignmentType.CENTER, size: 20 }),
    cell(`${evidences.length}\nArquivos de evidência`, summaryWidths[2], { bold: true, fill: PALE_BLUE, align: AlignmentType.CENTER, size: 20 }),
  ] })], summaryWidths)
  const dimensionWidths = [1550, 5016, 2100, 2100]
  const dimensionRows = [headerRow(["Código", "Dimensão", "Maior nota", "Classificação de campo"], dimensionWidths), ...dimensions.map(([code, name]) => {
    const scored = items.filter((item) => item.dimension_code === code).map((item) => answers[item.code]?.score).filter((score): score is number => score !== undefined)
    const maximum = scored.length ? Math.max(...scored) : undefined
    return new TableRow({ cantSplit: true, children: [cell(code, dimensionWidths[0], { align: AlignmentType.CENTER }), cell(name, dimensionWidths[1]), cell(maximum === undefined ? "—" : String(maximum), dimensionWidths[2], { bold: true, fill: maximum === undefined ? "E5E7EB" : scoreColors[maximum], align: AlignmentType.CENTER }), cell(maximum === undefined ? "Não avaliada" : scoreLabels[maximum], dimensionWidths[3], { align: AlignmentType.CENTER })] })
  })]
  const integrationWidths = [2866, 1700, 1700, 2300, 2200]
  const integrationRows = [headerRow(["Dimensão", "DRPS", "AEP-PS", "Integração", "Encaminhamento"], integrationWidths), ...dimensions.map(([code, name]) => {
    const drps = drpsResult?.dimensions.find((dimension) => dimension.code === code)
    const scores = items.filter((item) => item.dimension_code === code).map((item) => answers[item.code]?.score).filter((score): score is number => score !== undefined)
    const aepMaximum = scores.length ? Math.max(...scores) : undefined
    const drpsUnfavorable = drps ? ["médio", "alto", "crítico"].includes(drps.risk) : undefined
    const aepUnfavorable = aepMaximum === undefined ? undefined : aepMaximum >= 2
    let integration = "Pendente"
    let referral = "Concluir os dados necessários."
    if (drpsUnfavorable !== undefined && aepUnfavorable !== undefined) {
      if (drpsUnfavorable && aepUnfavorable) { integration = "Convergência de risco"; referral = "Priorizar avaliação no PGR e medidas preventivas." }
      else if (!drpsUnfavorable && !aepUnfavorable) { integration = "Convergência favorável"; referral = "Manter controles e recomendar verificação periódica." }
      else { integration = "Divergência"; referral = "Aprofundar evidências e contexto antes de concluir." }
    }
    return new TableRow({ cantSplit: true, children: [
      cell(`${code} ${name}`, integrationWidths[0], { size: 15 }),
      cell(drps ? `${drps.mean.toFixed(2).replace(".", ",")} · ${drps.risk}` : "Sem resultado válido", integrationWidths[1], { align: AlignmentType.CENTER, size: 15 }),
      cell(aepMaximum === undefined ? "Não avaliada" : `${aepMaximum} · ${scoreLabels[aepMaximum]}`, integrationWidths[2], { align: AlignmentType.CENTER, size: 15 }),
      cell(integration, integrationWidths[3], { bold: true, fill: integration.startsWith("Convergência de risco") ? "F8D7DA" : integration === "Divergência" ? "FFF2CC" : PALE_BLUE, align: AlignmentType.CENTER, size: 15 }),
      cell(referral, integrationWidths[4], { size: 15 }),
    ] })
  })]
  const detailWidths = [1250, 4450, 1050, 4016]
  const detailRows = [headerRow(["Item", "Condição avaliada", "Nota", "Evidência, justificativa e controle existente"], detailWidths), ...items.map((item) => {
    const answer = answers[item.code]
    const details = [answer?.evidence && `Evidência: ${answer.evidence}`, answer?.existingControls && `Controle existente: ${answer.existingControls}`].filter(Boolean).join("\n")
    return new TableRow({ cantSplit: true, children: [cell(item.code, detailWidths[0], { align: AlignmentType.CENTER, size: 16 }), cell(item.text, detailWidths[1], { size: 16 }), cell(answer?.score === undefined ? "—" : `${answer.score} - ${scoreLabels[answer.score]}`, detailWidths[2], { bold: true, fill: answer?.score === undefined ? "E5E7EB" : scoreColors[answer.score], align: AlignmentType.CENTER, size: 15 }), cell(details || "Sem registro complementar", detailWidths[3], { size: 16 })] })
  })]
  const evidenceWidths = [2700, 1700, 3166, 3200]
  const evidenceRows = [headerRow(["Fonte/categoria", "Vinculação", "Descrição", "Arquivo"], evidenceWidths), ...(evidences.length ? evidences.map((evidence) => new TableRow({ cantSplit: true, children: [cell(evidence.category, evidenceWidths[0], { size: 16 }), cell(evidence.item_code ? `Item ${evidence.item_code}` : "GHE", evidenceWidths[1], { align: AlignmentType.CENTER, size: 16 }), cell(evidence.description || "Sem descrição", evidenceWidths[2], { size: 16 }), cell(evidence.filename, evidenceWidths[3], { size: 16 })] })) : [new TableRow({ children: [cell("Nenhum arquivo anexado à avaliação.", WIDTH, { color: MUTED })] })])]
  const actionWidths = [2200, 4266, 1500, 1400, 1400]
  const priorityDimensions = dimensions.flatMap(([code, name]) => {
    const dimensionItems = items.filter((item) => item.dimension_code === code)
    const maximum = Math.max(-1, ...dimensionItems.map((item) => answers[item.code]?.score ?? -1))
    if (maximum < 2) return []
    return [{ code, name, maximum }]
  })
  const actionRows = [headerRow(["Dimensão", "Ação recomendada", "Responsável sugerido", "Prazo orientativo", "Indicador sugerido"], actionWidths), ...(priorityDimensions.length ? priorityDimensions.map(({ code, name, maximum }) => new TableRow({ cantSplit: true, children: [
    cell(`${code} ${name}`, actionWidths[0], { bold: true, fill: scoreColors[maximum], size: 15 }),
    cell(recommendations[code] ?? "Avaliar e implementar medida preventiva compatível com a condição observada.", actionWidths[1], { size: 15 }),
    cell("Gestão / área responsável", actionWidths[2], { align: AlignmentType.CENTER, size: 15 }),
    cell(maximum === 3 ? "Até 90 dias" : "Até 180 dias", actionWidths[3], { align: AlignmentType.CENTER, size: 15 }),
    cell("Registro de implementação e verificação da condição", actionWidths[4], { size: 15 }),
  ] })) : [new TableRow({ children: [cell("Não foram identificados itens com notas 2 ou 3 nesta avaliação.", WIDTH, { color: MUTED })] })])]
  const interventionDimensions = priorityDimensions.filter((item) => item.maximum === 3)
  const attentionDimensions = priorityDimensions.filter((item) => item.maximum === 2)
  const controlsCount = answeredItems.filter((item) => answers[item.code]?.existingControls.trim()).length
  const integrationStatus = dimensions.map(([code]) => {
    const drps = drpsResult?.dimensions.find((dimension) => dimension.code === code)
    const scores = items.filter((item) => item.dimension_code === code).map((item) => answers[item.code]?.score).filter((score): score is number => score !== undefined)
    if (!drps || !scores.length) return "pendente"
    const drpsUnfavorable = ["médio", "alto", "crítico"].includes(drps.risk)
    const aepUnfavorable = Math.max(...scores) >= 2
    if (drpsUnfavorable === aepUnfavorable) return drpsUnfavorable ? "risco" : "favorável"
    return "divergência"
  })
  const riskConvergences = integrationStatus.filter((status) => status === "risco").length
  const favorableConvergences = integrationStatus.filter((status) => status === "favorável").length
  const divergences = integrationStatus.filter((status) => status === "divergência").length
  const conclusion = [
    `A AEP-PS do GHE “${ghe.name}”, pertencente ao setor “${sector?.name ?? "não informado"}”, contemplou ${answeredItems.length} dos ${items.length} itens previstos (${items.length ? (answeredItems.length / items.length * 100).toFixed(0) : "0"}% de preenchimento). A análise foi realizada a partir das condições registradas para a atividade real, das fontes declaradas e das evidências anexadas, devendo avaliações incompletas permanecer identificadas como rascunho até a conclusão de todos os itens obrigatórios.`,
    interventionDimensions.length
      ? `Foram identificadas condições que requerem intervenção nas dimensões ${interventionDimensions.map((item) => item.name).join(", ")}. Também requerem atenção as dimensões ${attentionDimensions.map((item) => item.name).join(", ") || "não identificadas nesta avaliação"}. Esses achados indicam a necessidade de análise prioritária das situações observadas, considerando exposição, controles existentes, organização real do trabalho e evidências disponíveis.`
      : attentionDimensions.length
        ? `Foram identificadas condições que requerem atenção nas dimensões ${attentionDimensions.map((item) => item.name).join(", ")}, sem registro de dimensão com nota máxima 3. O resultado recomenda aprofundamento preventivo e avaliação da suficiência dos controles existentes antes da definição das medidas aplicáveis.`
        : "Os registros preenchidos apresentam predomínio de condições não aplicáveis ou controladas, sem itens classificados como requer atenção ou intervenção. Esse resultado não elimina a necessidade de manter os controles existentes e revisar a avaliação quando houver mudanças relevantes na organização do trabalho.",
    drpsResult
      ? `Na integração com o DRPS do mesmo GHE foram observadas ${riskConvergences} convergência(s) de risco, ${favorableConvergences} convergência(s) favorável(is) e ${divergences} divergência(s). As convergências de risco reforçam a prioridade de aprofundamento; as divergências exigem verificação do contexto, da qualidade das evidências, do período de coleta e dos controles existentes, sem utilização de média matemática entre os dois instrumentos.`
      : "A integração com o DRPS permanece pendente porque não foi obtido resultado válido do mesmo GHE no momento da emissão. A conclusão integrada deverá ser atualizada quando o grupo atingir o mínimo de anonimização e houver resultado DRPS disponível.",
    `Foram registradas ${evidences.length} evidência(s) anexada(s), ${evidenceSources.length} fonte(s) consultada(s) e controles existentes em ${controlsCount} item(ns). A consistência do parecer depende da pertinência, atualidade e suficiência desses registros; ausência de evidência não deve ser interpretada automaticamente como ausência de exposição ou de controle.`,
    "Conclui-se que os achados desta AEP-PS constituem subsídio técnico para a avaliação dos fatores psicossociais relacionados ao trabalho no GHE, devendo ser considerados em conjunto com o DRPS, as demais evidências organizacionais e os critérios do GRO/PGR. As ações apresentadas possuem caráter recomendativo para análise e implementação pela empresa contratante, que definirá responsáveis internos, recursos, prazos de execução e formas de verificação. O resultado integrará o RTIRP e deverá ser revisto quando houver mudanças relevantes nos processos, no efetivo, nas atividades, nos GHEs ou nas condições de organização do trabalho.",
  ]
  if (priorityDimensions.some((item) => item.code === "D10")) conclusion.splice(3, 0, "Os achados relacionados a assédio e segurança psicológica representam indicadores de condições psicossociais e não comprovam, isoladamente, a ocorrência de conduta individual específica. Situações concretas devem ser encaminhadas aos procedimentos próprios e confidenciais de acolhimento, apuração e tratamento adotados pela organização.")
  const doc = new Document({
    creator: "Sealab", title: `AEP-PS - ${company.legal_name} - ${ghe.name}`,
    styles: { default: { document: { run: { font: "Arial", size: 19, color: INK }, paragraph: { spacing: { after: 100, line: 276 } } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 900, bottom: 900, left: 570, right: 570, header: 450, footer: 450 } } },
      headers: { default: header }, footers: { default: footer },
      children: [
        paragraph("AVALIAÇÃO ERGONÔMICA PRELIMINAR - PSICOSSOCIAL", { bold: true, color: BLUE, size: 28, align: AlignmentType.CENTER, after: 60 }),
        paragraph("Relatório técnico da avaliação de campo por Grupo Homogêneo de Exposição", { color: MUTED, size: 18, align: AlignmentType.CENTER, after: 220 }),
        meta, paragraph("", { after: 100 }),
        sectionTitle("1", "IDENTIFICAÇÃO E CARACTERIZAÇÃO DA AVALIAÇÃO"), summary,
        paragraph(`Jornada / turno: ${ghe.work_schedule || "Não informado"}`, { before: 120 }),
        paragraph(`Descrição resumida da atividade: ${ghe.activity_description || "Não informada"}`, { after: 160 }),
        paragraph("Escala utilizada: 0 Não aplicável; 1 Controlado; 2 Requer atenção; 3 Requer intervenção. Este documento registra os achados da AEP-PS e será integrado aos resultados do DRPS e às demais evidências na elaboração do RTIRP.", { color: MUTED, size: 16, before: 100, after: 150 }),
        sectionTitle("2", "FONTES DE EVIDÊNCIA UTILIZADAS"),
        ...(evidenceSources.length ? evidenceSources.map((source) => paragraph(`• ${source}`, { size: 18 })) : [paragraph("Nenhuma fonte de evidência foi marcada.", { color: MUTED })]),
        sectionTitle("3", "ESCALA E REGRAS DE PREENCHIMENTO"),
        paragraph("0 - Não aplicável: fator não aplicável à atividade ou ao GHE. 1 - Controlado: condição adequada ou satisfatoriamente controlada. 2 - Requer atenção: evidência de condição que pode contribuir para exposição psicossocial. 3 - Requer intervenção: evidência relevante de condição desfavorável que necessita medida preventiva."),
        paragraph("A avaliação considera a atividade real, exige justificativa para notas 2 e 3 e não utiliza sintomas individuais como fatores de exposição. A classificação da AEP-PS subsidia, mas não substitui, a avaliação de risco do PGR.", { after: 150 }),
        sectionTitle("4", "RESULTADO CONSOLIDADO POR DIMENSÃO"), table(dimensionRows, dimensionWidths),
        paragraph("", { after: 100 }), sectionTitle("5", "REGISTRO DETALHADO DOS ITENS"), table(detailRows, detailWidths),
        paragraph("", { after: 100 }), sectionTitle("6", "EVIDÊNCIAS ANEXADAS"), table(evidenceRows, evidenceWidths),
        paragraph("", { after: 100 }), sectionTitle("7", "MATRIZ DE INTEGRAÇÃO DRPS × AEP-PS"), table(integrationRows, integrationWidths),
        paragraph("Não é calculada média matemática entre DRPS e AEP-PS. A matriz indica convergência ou divergência; a classificação final do risco ocupacional permanece na metodologia do PGR, considerando Probabilidade, Severidade, nível de risco e critério de ação.", { color: MUTED, size: 16, before: 100, after: 150 }),
        sectionTitle("8", "SÍNTESE TÉCNICA DA AEP-PS"),
        paragraph(`Principais fatores identificados: ${priorityDimensions.map((item) => item.name).join("; ") || "não foram identificados itens classificados como requer atenção ou intervenção"}.`, { before: 120 }),
        paragraph(`Evidências relevantes: ${evidences.length} arquivo(s) anexado(s) e ${evidenceSources.length} fonte(s) de evidência registrada(s).`),
        paragraph(`Controles existentes registrados em ${controlsCount} item(ns).`),
        paragraph(notes ? `Observações técnicas: ${notes}` : "Não foram registradas observações técnicas adicionais.", { after: 160 }),
        sectionTitle("9", "PLANO DE AÇÃO PRELIMINAR RECOMENDADO"), table(actionRows, actionWidths),
        paragraph("As ações, responsáveis, indicadores e prazos são recomendações técnicas para análise e implementação pela empresa contratante; não representam acompanhamento operacional pela Sealab.", { color: MUTED, size: 16, before: 100, after: 150 }),
        sectionTitle("10", "CONCLUSÃO E ENCAMINHAMENTO AO PGR/RTIRP"),
        ...conclusion.map((content, index) => paragraph(content, { before: index === 0 ? 140 : 0, after: 130 })),
        sectionTitle("11", "RESPONSABILIDADES TÉCNICAS E ASSINATURAS"),
        table([new TableRow({ children: [cell("RESPONSÁVEL PELA ELABORAÇÃO", 5383, { bold: true, fill: LIGHT_BLUE, align: AlignmentType.CENTER }), cell("RESPONSÁVEL PELA VALIDAÇÃO TÉCNICA", 5383, { bold: true, fill: LIGHT_BLUE, align: AlignmentType.CENTER })] }), new TableRow({ cantSplit: true, children: [signatureCell(5383), signatureCell(5383)] })], [5383, 5383]),
      ],
    }],
  })
  return Packer.toBlob(doc)
}

export async function generateAepWordReport(input: AepReportInput) {
  const logoData = await fetch("/assets/images/sealab-logo-report.png").then((response) => response.arrayBuffer()).catch(() => undefined)
  const blob = await buildAepWordReport({ ...input, logoData })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `AEP-PS-${safeName(input.company.trade_name || input.company.legal_name)}-${safeName(input.ghe.name)}.docx`
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
