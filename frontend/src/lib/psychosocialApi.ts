export type Company = {
  id: string
  legal_name: string
  trade_name: string | null
  cnpj: string
  owner_id: string
  created_at: string
}

export type Unit = { id: string; company_id: string; name: string }
export type Sector = { id: string; unit_id: string; name: string }
export type Ghe = {
  id: string
  sector_id: string
  name: string
  worker_count: number
  work_schedule: string | null
  activity_description: string | null
}
export type JobRole = { id: string; ghe_id: string; name: string; worker_count: number }

export type AssessmentCycle = {
  id: string
  company_id: string
  name: string
  assessment_date: string
  minimum_respondents: number
  status: "draft" | "collecting" | "analysis" | "completed"
  methodology_version: string
}

export type DimensionResult = {
  code: string
  name: string
  mean: number
  probability: number
  severity: number
  risk: "irrelevante" | "baixo" | "médio" | "alto" | "crítico"
}

export type DrpsResult = {
  respondent_count: number
  dimensions: DimensionResult[]
  general_mean: number
  priority_dimension: string
  overall_risk: DimensionResult["risk"]
}

export type CompanyStructure = {
  company: Company
  units: Unit[]
  sectors: Sector[]
  ghes: Ghe[]
  job_roles: JobRole[]
}

export type AepItem = { code: string; dimension_code: string; dimension_name: string; text: string }
export type AepAnswer = { item_code: string; score: number; evidence?: string | null; existing_controls?: string | null; technical_notes?: string | null }
export type AepAssessment = { id: string; cycle_id: string; ghe_id: string; evaluator_id: string; evidence_sources: string[]; notes: string | null; completed_at: string | null; answers: AepAnswer[] }
export type AepEvidence = { id: string; assessment_id: string; item_code: string | null; category: string; description: string | null; filename: string; content_type: string; size_bytes: number; created_at: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("access_token")
  const response = await fetch(`/api/v1/psychosocial${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.detail ?? "Não foi possível concluir a operação.")
  }
  return response.json() as Promise<T>
}

export const psychosocialApi = {
  companies: () => request<{ data: Company[]; count: number }>("/companies"),
  createCompany: (body: { legal_name: string; trade_name?: string; cnpj: string }) =>
    request<Company>("/companies", { method: "POST", body: JSON.stringify(body) }),
  structure: (companyId: string) => request<CompanyStructure>(`/companies/${companyId}/structure`),
  createUnit: (body: { company_id: string; name: string }) =>
    request<Unit>("/units", { method: "POST", body: JSON.stringify(body) }),
  createSector: (body: { unit_id: string; name: string }) =>
    request<Sector>("/sectors", { method: "POST", body: JSON.stringify(body) }),
  updateSector: (sectorId: string, body: { unit_id: string; name: string }) =>
    request<Sector>(`/sectors/${sectorId}`, { method: "PATCH", body: JSON.stringify(body) }),
  createGhe: (body: { sector_id: string; name: string; worker_count: number; work_schedule?: string; activity_description?: string }) =>
    request<Ghe>("/ghes", { method: "POST", body: JSON.stringify(body) }),
  updateGhe: (gheId: string, body: { sector_id: string; name: string; worker_count: number; work_schedule?: string; activity_description?: string }) =>
    request<Ghe>(`/ghes/${gheId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteGhe: (gheId: string) => request<{ message: string }>(`/ghes/${gheId}`, { method: "DELETE" }),
  createJobRole: (body: { ghe_id: string; name: string; worker_count: number }) =>
    request<JobRole>("/job-roles", { method: "POST", body: JSON.stringify(body) }),
  updateJobRole: (roleId: string, body: { ghe_id: string; name: string; worker_count: number }) =>
    request<JobRole>(`/job-roles/${roleId}`, { method: "PATCH", body: JSON.stringify(body) }),
  cycles: (companyId: string) => request<AssessmentCycle[]>(`/companies/${companyId}/assessment-cycles`),
  createCycle: (body: { company_id: string; name: string; assessment_date: string; minimum_respondents: number }) =>
    request<AssessmentCycle>("/assessment-cycles", { method: "POST", body: JSON.stringify(body) }),
  importDrps: (body: { cycle_id: string; responses: Array<{ source_response_id: string; answers: Record<string, number>; sector_id?: string; ghe_id?: string }> }) =>
    request<{ imported: number; replaced: number; result: DrpsResult }>("/drps/import", { method: "POST", body: JSON.stringify(body) }),
  drpsResult: (cycleId: string, filters?: { sector_id?: string; ghe_id?: string }) => {
    const query = new URLSearchParams(Object.entries(filters ?? {}).filter(([, value]) => Boolean(value)) as string[][]).toString()
    return request<DrpsResult>(`/assessment-cycles/${cycleId}/drps-result${query ? `?${query}` : ""}`)
  },
  aepItems: () => request<AepItem[]>("/aep/items"),
  aepAssessment: (cycleId: string, gheId: string) => request<AepAssessment | null>(`/assessment-cycles/${cycleId}/aep-assessments/${gheId}`),
  saveAepAssessment: (cycleId: string, gheId: string, body: { notes?: string; evidence_sources?: string[]; completed: boolean; answers: AepAnswer[] }) =>
    request<AepAssessment>(`/assessment-cycles/${cycleId}/aep-assessments/${gheId}`, { method: "PUT", body: JSON.stringify(body) }),
  aepEvidence: (cycleId: string, gheId: string) => request<AepEvidence[]>(`/assessment-cycles/${cycleId}/aep-assessments/${gheId}/evidence`),
  uploadAepEvidence: (cycleId: string, gheId: string, body: FormData) => request<AepEvidence>(`/assessment-cycles/${cycleId}/aep-assessments/${gheId}/evidence`, { method: "POST", body }),
  deleteAepEvidence: (evidenceId: string) => request<{ message: string }>(`/aep/evidence/${evidenceId}`, { method: "DELETE" }),
  downloadAepEvidence: async (evidence: AepEvidence) => {
    const token = localStorage.getItem("access_token")
    const response = await fetch(`/api/v1/psychosocial/aep/evidence/${evidence.id}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!response.ok) throw new Error("Não foi possível baixar a evidência.")
    const link = document.createElement("a")
    link.href = URL.createObjectURL(await response.blob()); link.download = evidence.filename; link.click(); URL.revokeObjectURL(link.href)
  },
}
