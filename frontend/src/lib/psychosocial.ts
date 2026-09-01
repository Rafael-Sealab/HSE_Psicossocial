export type Risk = "Irrelevante" | "Baixo" | "Médio" | "Alto" | "Crítico"

export type Dimension = {
  code: string
  name: string
  score: number
  risk: Risk
  aep: 0 | 1 | 2 | 3
}

export const dimensions: Dimension[] = [
  { code: "D01", name: "Demandas", score: 2.83, risk: "Médio", aep: 2 },
  { code: "D02", name: "Controle e Autonomia", score: 2.85, risk: "Médio", aep: 2 },
  { code: "D03", name: "Apoio da Liderança", score: 1.53, risk: "Baixo", aep: 1 },
  { code: "D04", name: "Apoio da Equipe", score: 1.93, risk: "Baixo", aep: 1 },
  { code: "D05", name: "Relacionamentos e Conflitos", score: 2.1, risk: "Médio", aep: 2 },
  { code: "D06", name: "Clareza de Papel e Função", score: 2.47, risk: "Baixo", aep: 1 },
  { code: "D07", name: "Mudanças Organizacionais", score: 2.93, risk: "Médio", aep: 3 },
  { code: "D08", name: "Reconhecimento", score: 3.07, risk: "Médio", aep: 3 },
  { code: "D09", name: "Equilíbrio Trabalho × Vida", score: 1.7, risk: "Baixo", aep: 1 },
  { code: "D10", name: "Assédio e Segurança Psicológica", score: 2.17, risk: "Médio", aep: 2 },
]

export const riskClass: Record<Risk, string> = {
  Irrelevante: "risk-neutral",
  Baixo: "risk-low",
  Médio: "risk-medium",
  Alto: "risk-high",
  Crítico: "risk-critical",
}

export const actions = [
  { dimension: "Reconhecimento", action: "Implantar rotina estruturada de feedback e reconhecimento", owner: "RH", due: "15 out. 2026", status: "Em andamento", risk: "Médio" as Risk },
  { dimension: "Mudanças Organizacionais", action: "Comunicar mudanças com antecedência e plano de transição", owner: "Diretoria", due: "30 set. 2026", status: "Atrasada", risk: "Alto" as Risk },
  { dimension: "Demandas", action: "Revisar distribuição de tarefas, prazos e volume", owner: "Gestores", due: "20 nov. 2026", status: "Planejada", risk: "Médio" as Risk },
]
