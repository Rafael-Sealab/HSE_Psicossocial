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
import type {
  AssessmentCycle,
  Company,
  DimensionResult,
  DrpsResult,
} from "@/lib/psychosocialApi"

const BLUE = "337DB7"
const LIGHT_BLUE = "D9E8F5"
const PALE_BLUE = "EEF5FB"
const PINK = "F8D7DA"
const WHITE = "FFFFFF"
const INK = "17212B"
const MUTED = "52606D"
const REPORT_WIDTH = 10766
const riskColors: Record<
  DimensionResult["risk"],
  { fill: string; text: string }
> = {
  irrelevante: { fill: "DCEBD2", text: "244B20" },
  baixo: { fill: "548636", text: WHITE },
  médio: { fill: "FFF200", text: INK },
  alto: { fill: "FFC000", text: INK },
  crítico: { fill: "E31B23", text: WHITE },
}
const riskLabels: Record<DimensionResult["risk"], string> = {
  irrelevante: "Irrelevante",
  baixo: "Baixo",
  médio: "Médio",
  alto: "Alto",
  crítico: "Crítico",
}
const sourceLabels: Record<string, string> = {
  DEM: "Sobrecarga, ritmo elevado e pressão",
  CON: "Falta de autonomia e controle",
  APL: "Falta de suporte da chefia",
  APE: "Falta de suporte da equipe",
  REL: "Conflitos e clima organizacional",
  CLA: "Falta de definição de papel",
  MUD: "Mudanças mal geridas",
  REC: "Falta de valorização",
  EQU: "Impacto na vida pessoal",
  ASS: "Assédio, medo e exposição",
}
const actionLabels: Record<DimensionResult["risk"], [string, string]> = {
  irrelevante: ["Aceitável", "Não aplicável"],
  baixo: ["Monitoramento", "Revisão periódica"],
  médio: ["Plano de ação", "Até 180 dias"],
  alto: ["Ação prioritária", "Até 90 dias"],
  crítico: ["Intervenção imediata", "Imediato"],
}
const borders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: BLUE },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE },
  left: { style: BorderStyle.SINGLE, size: 4, color: BLUE },
  right: { style: BorderStyle.SINGLE, size: 4, color: BLUE },
}

export type SectorPriorityResult = {
  sectorId: string
  sectorName: string
  respondentCount: number
  generalMean: number
  criticalFactor: string
  risk: DimensionResult["risk"]
}

type ReportInput = {
  company: Company
  cycle: AssessmentCycle
  result: DrpsResult
  scopeName: string
  scopeType?: "company" | "sector" | "ghe"
  prioritySectors?: SectorPriorityResult[]
  logoData?: ArrayBuffer
}

export function getDrpsTechnicalInterpretation(
  result: DrpsResult,
  scopeName: string,
  scopeType: "company" | "sector" | "ghe" = "company",
) {
  const ordered = [...result.dimensions].sort((left, right) => right.mean - left.mean)
  const [primary, secondary] = ordered
  const action = actionLabels[result.overall_risk]
  const mean = result.general_mean.toFixed(1).replace(".", ",")
  const primaryMean = primary?.mean.toFixed(1).replace(".", ",")
  const secondaryMean = secondary?.mean.toFixed(1).replace(".", ",")
  const context = scopeType === "company"
    ? "Esta leitura consolida a percepção organizacional e pode ocultar diferenças internas; recomenda-se compará-la aos recortes por setor e por GHE sempre que cada grupo atingir o mínimo de anonimização."
    : scopeType === "sector"
      ? "Esta leitura representa especificamente o setor selecionado e não deve ser generalizada para toda a empresa. A comparação com a visão geral e com outros setores ajuda a distinguir fatores locais de fatores organizacionais."
      : "Esta leitura representa o Grupo Homogêneo de Exposição selecionado e deve orientar a análise das condições, tarefas e organização do trabalho compartilhadas por esse grupo, sem extrapolação automática para outros GHEs."
  return [
    `O recorte “${scopeName}” reúne ${result.respondent_count} respostas válidas e apresentou índice geral ${mean}, classificado como risco ${riskLabels[result.overall_risk]}. O resultado expressa a percepção coletiva do grupo avaliado no período e não constitui diagnóstico clínico individual.`,
    `A maior média foi observada em ${primary?.name ?? "dimensão não identificada"} (${primaryMean ?? "-"}), seguida por ${secondary?.name ?? "dimensão não identificada"} (${secondaryMean ?? "-"}). Essas dimensões representam os principais pontos de atenção relativos do cenário, mesmo quando a classificação geral permanece em faixa baixa ou aceitável.`,
    `A prioridade técnica é ${primary?.name ?? "não definida"}. Recomenda-se ${action[0].toLowerCase()}, com horizonte de ${action[1].toLowerCase()}, acompanhando a evolução das médias e verificando evidências complementares na organização real do trabalho.`,
    context,
    "Os achados devem ser interpretados em conjunto com observação das atividades, dados de saúde e segurança, relatos qualificados e demais evidências do gerenciamento de riscos. Diferenças pequenas entre médias não devem ser tratadas isoladamente como prova de causalidade.",
  ]
}

function run(
  text: string,
  options: {
    bold?: boolean
    color?: string
    size?: number
    italics?: boolean
  } = {},
) {
  return new TextRun({
    text,
    font: "Arial",
    size: options.size ?? 19,
    bold: options.bold,
    italics: options.italics,
    color: options.color ?? INK,
  })
}
function para(
  text: string,
  options: {
    bold?: boolean
    color?: string
    size?: number
    align?: (typeof AlignmentType)[keyof typeof AlignmentType]
    before?: number
    after?: number
    italics?: boolean
  } = {},
) {
  return new Paragraph({
    alignment: options.align,
    spacing: {
      before: options.before ?? 0,
      after: options.after ?? 100,
      line: 276,
    },
    children: [run(text, options)],
  })
}
function cell(
  text: string,
  width: number,
  options: {
    bold?: boolean
    fill?: string
    color?: string
    align?: (typeof AlignmentType)[keyof typeof AlignmentType]
    size?: number
  } = {},
) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: options.fill
      ? { type: ShadingType.CLEAR, fill: options.fill }
      : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 110, bottom: 110, left: 120, right: 120 },
    children: [
      para(text, {
        bold: options.bold,
        color: options.color,
        size: options.size ?? 18,
        align: options.align ?? AlignmentType.LEFT,
        after: 0,
      }),
    ],
  })
}
function table(rows: TableRow[], widths: number[]) {
  return new Table({
    rows,
    width: { size: REPORT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: "fixed",
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
  })
}
function sectionTitle(number: string, title: string) {
  return new Table({
    width: { size: REPORT_WIDTH, type: WidthType.DXA },
    columnWidths: [REPORT_WIDTH],
    rows: [
      new TableRow({
        children: [
          cell(`${number} - ${title}`, REPORT_WIDTH, {
            bold: true,
            fill: BLUE,
            color: WHITE,
            size: 23,
          }),
        ],
      }),
    ],
  })
}
function metric(value: string, label: string, fill?: string, color?: string) {
  return new TableCell({
    width: { size: 2153, type: WidthType.DXA },
    borders,
    shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 160, bottom: 160, left: 100, right: 100 },
    children: [
      para(label, {
        bold: true,
        size: 15,
        align: AlignmentType.CENTER,
        color: fill ? color : MUTED,
        after: 80,
      }),
      para(value, {
        bold: true,
        size: 25,
        align: AlignmentType.CENTER,
        color: color ?? INK,
        after: 0,
      }),
    ],
  })
}

export async function buildDrpsWordReport({
  company,
  cycle,
  result,
  scopeName,
  scopeType = "company",
  prioritySectors = [],
  logoData,
}: ReportInput) {
  const priority = result.dimensions.find(
    (item) => item.code === result.priority_dimension,
  )
  const action = actionLabels[result.overall_risk]
  const riskStyle = riskColors[result.overall_risk]
  const logoCell = logoData
    ? new TableCell({
        width: { size: 2800, type: WidthType.DXA },
        borders,
        shading: { type: ShadingType.CLEAR, fill: WHITE },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 35, bottom: 35, left: 80, right: 80 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
              new ImageRun({
                data: logoData,
                type: "png",
                transformation: { width: 190, height: 62 },
                altText: {
                  title: "Sealab Medicina Ocupacional",
                  description: "Logotipo da Sealab Medicina Ocupacional",
                  name: "Sealab",
                },
              }),
            ],
          }),
        ],
      })
    : cell("SEALAB", 2800, {
        bold: true,
        fill: "101820",
        color: WHITE,
        size: 28,
        align: AlignmentType.CENTER,
      })
  const header = new Header({
    children: [
      new Table({
        width: { size: REPORT_WIDTH, type: WidthType.DXA },
        columnWidths: [2800, 7966],
        rows: [
          new TableRow({
            children: [
              logoCell,
              cell("DRPS - DIAGNÓSTICO DE RISCOS PSICOSSOCIAIS", 7966, {
                bold: true,
                fill: BLUE,
                color: WHITE,
                size: 25,
                align: AlignmentType.CENTER,
              }),
            ],
          }),
        ],
      }),
    ],
  })
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          run("Relatório DRPS  |  Página ", { color: MUTED, size: 16 }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: "Arial",
            size: 16,
            color: MUTED,
          }),
        ],
      }),
    ],
  })
  const metadataWidths = [1750, 4100, 1750, 3166]
  const meta = table(
    [
      new TableRow({
        children: [
          cell("EMPRESA", metadataWidths[0], { bold: true, fill: PALE_BLUE }),
          cell(company.legal_name, metadataWidths[1]),
          cell("CNPJ", metadataWidths[2], { bold: true, fill: PALE_BLUE }),
          cell(company.cnpj, metadataWidths[3]),
        ],
      }),
      new TableRow({
        children: [
          cell("ABRANGÊNCIA", metadataWidths[0], {
            bold: true,
            fill: PALE_BLUE,
          }),
          cell(scopeName, metadataWidths[1]),
          cell("DATA", metadataWidths[2], { bold: true, fill: PALE_BLUE }),
          cell(
            new Date(`${cycle.assessment_date}T12:00:00`).toLocaleDateString(
              "pt-BR",
            ),
            metadataWidths[3],
          ),
        ],
      }),
      new TableRow({
        children: [
          cell("CICLO", metadataWidths[0], { bold: true, fill: PALE_BLUE }),
          cell(cycle.name, metadataWidths[1]),
          cell("RESPONDENTES", metadataWidths[2], {
            bold: true,
            fill: PALE_BLUE,
          }),
          cell(String(result.respondent_count), metadataWidths[3]),
        ],
      }),
    ],
    metadataWidths,
  )
  const summary = new Table({
    width: { size: REPORT_WIDTH, type: WidthType.DXA },
    columnWidths: [2153, 2153, 2153, 2153, 2154],
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          metric(
            result.general_mean.toFixed(1).replace(".", ","),
            "ÍNDICE GERAL",
          ),
          metric(priority?.name ?? "-", "FATOR PRIORITÁRIO"),
          metric(
            riskLabels[result.overall_risk],
            "CLASSIFICAÇÃO",
            riskStyle.fill,
            riskStyle.text,
          ),
          metric(action[0], "NÍVEL DE AÇÃO"),
          metric(action[1], "PRAZO"),
        ],
      }),
    ],
  })
  const profileWidths = [4740, 1300, 1355, 1355, 2016]
  const profileRows = [
    new TableRow({
      tableHeader: true,
      children: [
        cell("DIMENSÃO", profileWidths[0], {
          bold: true,
          fill: LIGHT_BLUE,
          align: AlignmentType.CENTER,
        }),
        cell("MÉDIA", profileWidths[1], {
          bold: true,
          fill: LIGHT_BLUE,
          align: AlignmentType.CENTER,
        }),
        cell("P", profileWidths[2], {
          bold: true,
          fill: LIGHT_BLUE,
          align: AlignmentType.CENTER,
        }),
        cell("S", profileWidths[3], {
          bold: true,
          fill: LIGHT_BLUE,
          align: AlignmentType.CENTER,
        }),
        cell("RISCO", profileWidths[4], {
          bold: true,
          fill: LIGHT_BLUE,
          align: AlignmentType.CENTER,
        }),
      ],
    }),
    ...result.dimensions.map(
      (item) =>
        new TableRow({
          cantSplit: true,
          children: [
            cell(item.name, profileWidths[0]),
            cell(item.mean.toFixed(1).replace(".", ","), profileWidths[1], {
              align: AlignmentType.CENTER,
            }),
            cell(String(item.probability), profileWidths[2], {
              align: AlignmentType.CENTER,
            }),
            cell(String(item.severity), profileWidths[3], {
              align: AlignmentType.CENTER,
            }),
            cell(riskLabels[item.risk], profileWidths[4], {
              bold: true,
              fill: riskColors[item.risk].fill,
              color: riskColors[item.risk].text,
              align: AlignmentType.CENTER,
            }),
          ],
        }),
    ),
  ]
  const technicalWidths = [3260, 2740, 1000, 800, 800, 2166]
  const technicalRows = [
    new TableRow({
      tableHeader: true,
      children: [
        "FONTE GERADORA",
        "FATOR",
        "MÉDIA",
        "P",
        "S",
        "CLASSIFICAÇÃO",
      ].map((label, index) =>
        cell(label, technicalWidths[index], {
          bold: true,
          fill: LIGHT_BLUE,
          align: AlignmentType.CENTER,
          size: 15,
        }),
      ),
    }),
    ...result.dimensions.map(
      (item) =>
        new TableRow({
          cantSplit: true,
          children: [
            cell(sourceLabels[item.code] ?? item.code, technicalWidths[0], {
              size: 16,
            }),
            cell(item.name, technicalWidths[1], { size: 16 }),
            cell(item.mean.toFixed(1).replace(".", ","), technicalWidths[2], {
              align: AlignmentType.CENTER,
              size: 16,
            }),
            cell(String(item.probability), technicalWidths[3], {
              align: AlignmentType.CENTER,
              size: 16,
            }),
            cell(String(item.severity), technicalWidths[4], {
              align: AlignmentType.CENTER,
              size: 16,
            }),
            cell(riskLabels[item.risk], technicalWidths[5], {
              bold: true,
              fill: riskColors[item.risk].fill,
              color: riskColors[item.risk].text,
              align: AlignmentType.CENTER,
              size: 16,
            }),
          ],
        }),
    ),
  ]
  const actionWidths = [2330, 1600, 1800, 3200, 1836]
  const actionTable = table(
    [
      new TableRow({
        tableHeader: true,
        children: [
          "FATOR",
          "RISCO",
          "NÍVEL DE AÇÃO",
          "AÇÃO RECOMENDADA",
          "PRAZO",
        ].map((label, index) =>
          cell(label, actionWidths[index], {
            bold: true,
            fill: LIGHT_BLUE,
            align: AlignmentType.CENTER,
            size: 15,
          }),
        ),
      }),
      new TableRow({
        cantSplit: true,
        children: [
          cell(priority?.name ?? "-", actionWidths[0]),
          cell(riskLabels[result.overall_risk], actionWidths[1], {
            bold: true,
            fill: riskStyle.fill,
            color: riskStyle.text,
            align: AlignmentType.CENTER,
          }),
          cell(action[0], actionWidths[2], { align: AlignmentType.CENTER }),
          cell(
            "Manter e aprimorar os controles existentes, monitorar os fatores psicossociais e implementar ajustes conforme a prioridade identificada.",
            actionWidths[3],
          ),
          cell(action[1], actionWidths[4], { align: AlignmentType.CENTER }),
        ],
      }),
    ],
    actionWidths,
  )
  const interpretation = getDrpsTechnicalInterpretation(result, scopeName, scopeType)
  const reportDocument = new Document({
    creator: "Sealab",
    title: `Relatório DRPS - ${company.legal_name}`,
    description: "Diagnóstico de Riscos Psicossociais",
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 19, color: INK },
          paragraph: { spacing: { after: 100, line: 276 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: {
              top: 900,
              bottom: 900,
              left: 570,
              right: 570,
              header: 450,
              footer: 450,
            },
          },
        },
        headers: { default: header, even: header, first: header },
        footers: { default: footer, even: footer, first: footer },
        children: [
          para("", { after: 100 }),
          meta,
          para("", { after: 100 }),
          sectionTitle("1", "RESUMO EXECUTIVO DOS CENÁRIOS"),
          summary,
          new Table({
            width: { size: REPORT_WIDTH, type: WidthType.DXA },
            columnWidths: [REPORT_WIDTH],
            rows: [
              new TableRow({
                children: [
                  cell(
                    "Índice geral calculado a partir da média das dimensões avaliadas.",
                    REPORT_WIDTH,
                    { fill: PINK, size: 16 },
                  ),
                ],
              }),
            ],
          }),
          sectionTitle("2", "PERFIL DO RISCO PSICOSSOCIAL"),
          table(profileRows, profileWidths),
          para("Escala utilizada: 1 (mínimo) a 5 (máximo).", {
            italics: true,
            color: MUTED,
            size: 16,
            before: 80,
          }),
          sectionTitle("3", "ANÁLISE TÉCNICA DOS FATORES DE RISCO"),
          table(technicalRows, technicalWidths),
          sectionTitle("4", "PRIORIZAÇÃO E PLANO DE AÇÃO RECOMENDADO"),
          actionTable,
          para("", { after: 140 }),
          sectionTitle("5", "INTERPRETAÇÃO DO CENÁRIO"),
          ...interpretation.map((paragraph, index) => para(paragraph, { size: 19, before: index === 0 ? 180 : 0, after: 130 })),
          ...(scopeType === "company" ? [
            sectionTitle("6", "SETORES PRIORITÁRIOS PARA INTERVENÇÃO"),
            table([
              new TableRow({ tableHeader: true, children: ["RANK", "SETOR", "ÍNDICE", "FATOR CRÍTICO", "NÍVEL DE RISCO"].map((label, index) => cell(label, [900, 2700, 1400, 3766, 2000][index], { bold: true, fill: LIGHT_BLUE, align: AlignmentType.CENTER, size: 15 })) }),
              ...(prioritySectors.length ? prioritySectors.map((sector, index) => new TableRow({ cantSplit: true, children: [
                cell(String(index + 1), 900, { align: AlignmentType.CENTER }),
                cell(sector.sectorName, 2700),
                cell(sector.generalMean.toFixed(2).replace(".", ","), 1400, { align: AlignmentType.CENTER }),
                cell(sector.criticalFactor, 3766),
                cell(riskLabels[sector.risk], 2000, { bold: true, fill: riskColors[sector.risk].fill, color: riskColors[sector.risk].text, align: AlignmentType.CENTER }),
              ] })) : [new TableRow({ children: [cell("Nenhum setor atingiu o mínimo de respondentes para apresentação.", REPORT_WIDTH)] })]),
            ], [900, 2700, 1400, 3766, 2000]),
            para("O ranking prioriza o nível de risco e, em caso de empate, o maior índice médio. Setores abaixo do mínimo de anonimização não são apresentados.", { italics: true, color: MUTED, size: 16, before: 80, after: 140 }),
          ] : []),
          new Table({
            width: { size: REPORT_WIDTH, type: WidthType.DXA },
            columnWidths: [REPORT_WIDTH],
            rows: [
              new TableRow({
                children: [
                  cell(
                    "Este relatório foi elaborado em conformidade com as diretrizes da NR-01 (Gerenciamento de Riscos Ocupacionais), utilizando metodologia baseada no modelo HSE-IT para avaliação estruturada de riscos psicossociais no ambiente de trabalho.",
                    REPORT_WIDTH,
                    { fill: PINK, size: 16 },
                  ),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  })
  return Packer.toBlob(reportDocument)
}

export async function generateDrpsWordReport(input: ReportInput) {
  const logoData = await fetch("/assets/images/sealab-logo-report.png")
    .then((response) => response.arrayBuffer())
    .catch(() => undefined)
  const blob = await buildDrpsWordReport({ ...input, logoData })
  const { company, scopeName } = input
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `DRPS-${(company.trade_name || company.legal_name).replace(/[^a-z0-9]+/gi, "-")}-${scopeName.replace(/[^a-z0-9]+/gi, "-")}.docx`
  link.click()
  URL.revokeObjectURL(link.href)
}
