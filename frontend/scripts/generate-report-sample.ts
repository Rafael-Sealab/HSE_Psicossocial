import { buildDrpsWordReport } from "../src/lib/drpsWordReport"

const company = { id: "sample", legal_name: "EXPRESSO MILITAR UNIFORMES E ACESSORIOS LTDA", trade_name: "EXPRESSO MILITAR", cnpj: "28.689.606/0001-03", owner_id: "sample", created_at: "2026-08-10" }
const cycle = { id: "sample", company_id: "sample", name: "AVALIAÇÃO _OUT26", assessment_date: "2026-08-27", minimum_respondents: 3, status: "analysis" as const, methodology_version: "DRPS-1.0" }
const values: Array<[string, string, number, number, number]> = [["DEM", "Demandas", 1.3, 1, 2], ["CON", "Controle e Autonomia", 2.2, 2, 2], ["APL", "Apoio da Liderança", 1, 1, 2], ["APE", "Apoio da Equipe", 1, 1, 2], ["REL", "Relacionamentos e Conflitos", 1.3, 1, 3], ["CLA", "Clareza de Papel e Função", 2.3, 2, 2], ["MUD", "Mudanças Organizacionais", 1, 1, 2], ["REC", "Reconhecimento", 1.4, 1, 2], ["EQU", "Equilíbrio Trabalho x Vida", 1, 1, 3], ["ASS", "Assédio e Segurança Psicológica", 1, 1, 3]]
const result = { respondent_count: 3, general_mean: 1.4, priority_dimension: "CLA", overall_risk: "baixo" as const, dimensions: values.map(([code, name, mean, probability, severity]) => ({ code, name, mean, probability, severity, risk: "baixo" as const })) }
const logoData = await Bun.file("public/assets/images/sealab-logo-report.png").arrayBuffer()
const blob = await buildDrpsWordReport({ company, cycle, result, scopeName: "Gerencial / Administrativo", scopeType: "ghe", logoData })
await Bun.write("/tmp/DRPS-formatado-amostra.docx", blob)
