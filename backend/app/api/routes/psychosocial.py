import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    AEPAnswer,
    AEPAssessment,
    AEPEvidence,
    AssessmentCycle,
    AssessmentCycleCreate,
    AssessmentStatus,
    CompaniesPublic,
    Company,
    CompanyCreate,
    CompanyPublic,
    DRPSResponse,
    GHE,
    GHECreate,
    JobRole,
    Sector,
    SectorCreate,
    Unit,
    UnitCreate,
)
from app.domain.psychosocial_rules import DIMENSIONS
from app.services.psychosocial import (
    AEPDimensionResult,
    AEPItemInput,
    DRPSRequest,
    DRPSResult,
    IntegrationResult,
    RiskLevel,
    calculate_aep,
    calculate_drps,
    integrate_dimension,
)

router = APIRouter(prefix="/psychosocial", tags=["psychosocial"])


class CompanyStructure(BaseModel):
    company: CompanyPublic
    units: list[Unit]
    sectors: list[Sector]
    ghes: list[GHE]
    job_roles: list[JobRole]


class JobRoleCreate(BaseModel):
    ghe_id: uuid.UUID
    name: str = Field(min_length=1, max_length=255)
    worker_count: int = Field(default=0, ge=0)


class JobRoleUpdate(BaseModel):
    ghe_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    worker_count: int | None = Field(default=None, ge=0)


class SectorUpdate(BaseModel):
    unit_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)


class DRPSResponseInput(BaseModel):
    source_response_id: str = Field(min_length=1, max_length=255)
    answers: dict[str, int]
    sector_id: uuid.UUID | None = None
    ghe_id: uuid.UUID | None = None
    submitted_at: datetime | None = None


class DRPSImportRequest(BaseModel):
    cycle_id: uuid.UUID
    responses: list[DRPSResponseInput] = Field(min_length=1)


class DRPSImportResult(BaseModel):
    imported: int
    replaced: int
    result: DRPSResult


class GHEUpdate(BaseModel):
    sector_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    worker_count: int | None = Field(default=None, ge=0)
    work_schedule: str | None = Field(default=None, max_length=255)
    activity_description: str | None = Field(default=None, max_length=2000)


class AEPItemPublic(BaseModel):
    code: str
    dimension_code: str
    dimension_name: str
    text: str


class AEPAnswerPayload(BaseModel):
    item_code: str = Field(min_length=6, max_length=10)
    score: int = Field(ge=0, le=3)
    evidence: str | None = Field(default=None, max_length=4000)
    existing_controls: str | None = Field(default=None, max_length=4000)
    technical_notes: str | None = Field(default=None, max_length=4000)


class AEPAssessmentPayload(BaseModel):
    notes: str | None = Field(default=None, max_length=4000)
    evidence_sources: list[str] = Field(default_factory=list)
    completed: bool = False
    answers: list[AEPAnswerPayload]


class AEPAssessmentPublic(BaseModel):
    id: uuid.UUID
    cycle_id: uuid.UUID
    ghe_id: uuid.UUID
    evaluator_id: uuid.UUID
    evidence_sources: list[str]
    notes: str | None
    completed_at: datetime | None
    answers: list[AEPAnswerPayload]


class AEPEvidencePublic(BaseModel):
    id: uuid.UUID
    assessment_id: uuid.UUID
    item_code: str | None
    category: str
    description: str | None
    filename: str
    content_type: str
    size_bytes: int
    created_at: datetime


def owned_company(
    session: SessionDep, current_user: CurrentUser, company_id: uuid.UUID
) -> Company:
    company = session.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if not current_user.is_superuser and company.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return company


@router.post("/companies", response_model=CompanyPublic)
def create_company(*, session: SessionDep, current_user: CurrentUser,
                   company_in: CompanyCreate) -> Any:
    company = Company.model_validate(company_in, update={"owner_id": current_user.id})
    session.add(company)
    session.commit()
    session.refresh(company)
    return company


@router.get("/companies", response_model=CompaniesPublic)
def list_companies(session: SessionDep, current_user: CurrentUser) -> Any:
    condition = True if current_user.is_superuser else Company.owner_id == current_user.id
    data = session.exec(select(Company).where(condition)).all()
    count = session.exec(select(func.count()).select_from(Company).where(condition)).one()
    return CompaniesPublic(data=[CompanyPublic.model_validate(row) for row in data], count=count)


@router.get("/companies/{company_id}/structure", response_model=CompanyStructure)
def get_company_structure(company_id: uuid.UUID, session: SessionDep,
                          current_user: CurrentUser) -> Any:
    company = owned_company(session, current_user, company_id)
    units = session.exec(select(Unit).where(Unit.company_id == company_id)).all()
    unit_ids = [item.id for item in units]
    sectors = session.exec(select(Sector).where(Sector.unit_id.in_(unit_ids))).all() if unit_ids else []
    sector_ids = [item.id for item in sectors]
    ghes = session.exec(select(GHE).where(GHE.sector_id.in_(sector_ids))).all() if sector_ids else []
    ghe_ids = [item.id for item in ghes]
    job_roles = session.exec(select(JobRole).where(JobRole.ghe_id.in_(ghe_ids))).all() if ghe_ids else []
    return CompanyStructure(
        company=CompanyPublic.model_validate(company),
        units=list(units), sectors=list(sectors), ghes=list(ghes), job_roles=list(job_roles),
    )


@router.post("/job-roles", response_model=JobRole)
def create_job_role(*, session: SessionDep, current_user: CurrentUser,
                    payload: JobRoleCreate) -> Any:
    ghe = owned_ghe(session, current_user, payload.ghe_id)
    role = JobRole.model_validate(payload, update={"ghe_id": ghe.id})
    session.add(role)
    session.commit()
    session.refresh(role)
    return role


@router.patch("/job-roles/{role_id}", response_model=JobRole)
def update_job_role(role_id: uuid.UUID, payload: JobRoleUpdate,
                    session: SessionDep, current_user: CurrentUser) -> Any:
    role = session.get(JobRole, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Job role not found")
    owned_ghe(session, current_user, role.ghe_id)
    values = payload.model_dump(exclude_unset=True)
    if ghe_id := values.get("ghe_id"):
        owned_ghe(session, current_user, ghe_id)
    role.sqlmodel_update(values)
    session.add(role)
    session.commit()
    session.refresh(role)
    return role


@router.post("/units", response_model=Unit)
def create_unit(*, session: SessionDep, current_user: CurrentUser,
                unit_in: UnitCreate) -> Any:
    owned_company(session, current_user, unit_in.company_id)
    unit = Unit.model_validate(unit_in)
    session.add(unit)
    session.commit()
    session.refresh(unit)
    return unit


@router.post("/sectors", response_model=Sector)
def create_sector(*, session: SessionDep, current_user: CurrentUser,
                  sector_in: SectorCreate) -> Any:
    unit = session.get(Unit, sector_in.unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    owned_company(session, current_user, unit.company_id)
    sector = Sector.model_validate(sector_in)
    session.add(sector)
    session.commit()
    session.refresh(sector)
    return sector


@router.patch("/sectors/{sector_id}", response_model=Sector)
def update_sector(sector_id: uuid.UUID, payload: SectorUpdate,
                  session: SessionDep, current_user: CurrentUser) -> Any:
    sector = session.get(Sector, sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail="Sector not found")
    current_unit = session.get(Unit, sector.unit_id)
    if not current_unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    owned_company(session, current_user, current_unit.company_id)
    values = payload.model_dump(exclude_unset=True)
    if unit_id := values.get("unit_id"):
        unit = session.get(Unit, unit_id)
        if not unit:
            raise HTTPException(status_code=404, detail="Unit not found")
        owned_company(session, current_user, unit.company_id)
    sector.sqlmodel_update(values)
    session.add(sector)
    session.commit()
    session.refresh(sector)
    return sector


@router.post("/ghes", response_model=GHE)
def create_ghe(*, session: SessionDep, current_user: CurrentUser,
               ghe_in: GHECreate) -> Any:
    sector = session.get(Sector, ghe_in.sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail="Sector not found")
    unit = session.get(Unit, sector.unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    owned_company(session, current_user, unit.company_id)
    ghe = GHE.model_validate(ghe_in)
    session.add(ghe)
    session.commit()
    session.refresh(ghe)
    return ghe


def owned_ghe(session: SessionDep, current_user: CurrentUser, ghe_id: uuid.UUID) -> GHE:
    ghe = session.get(GHE, ghe_id)
    if not ghe:
        raise HTTPException(status_code=404, detail="GHE not found")
    sector = session.get(Sector, ghe.sector_id)
    unit = session.get(Unit, sector.unit_id) if sector else None
    if not sector or not unit:
        raise HTTPException(status_code=404, detail="GHE structure not found")
    owned_company(session, current_user, unit.company_id)
    return ghe


@router.patch("/ghes/{ghe_id}", response_model=GHE)
def update_ghe(ghe_id: uuid.UUID, payload: GHEUpdate, session: SessionDep,
               current_user: CurrentUser) -> Any:
    ghe = owned_ghe(session, current_user, ghe_id)
    values = payload.model_dump(exclude_unset=True)
    if sector_id := values.get("sector_id"):
        sector = session.get(Sector, sector_id)
        unit = session.get(Unit, sector.unit_id) if sector else None
        if not sector or not unit:
            raise HTTPException(status_code=404, detail="Sector not found")
        owned_company(session, current_user, unit.company_id)
    ghe.sqlmodel_update(values)
    session.add(ghe)
    session.commit()
    session.refresh(ghe)
    return ghe


@router.delete("/ghes/{ghe_id}")
def delete_ghe(ghe_id: uuid.UUID, session: SessionDep,
               current_user: CurrentUser) -> dict[str, str]:
    ghe = owned_ghe(session, current_user, ghe_id)
    linked_response = session.exec(
        select(DRPSResponse).where(DRPSResponse.ghe_id == ghe_id)
    ).first()
    if linked_response:
        raise HTTPException(
            status_code=409,
            detail="Este GHE já possui respostas vinculadas e não pode ser excluído.",
        )
    session.delete(ghe)
    session.commit()
    return {"message": "GHE deleted successfully"}


@router.get("/companies/{company_id}/assessment-cycles",
            response_model=list[AssessmentCycle])
def list_assessment_cycles(company_id: uuid.UUID, session: SessionDep,
                           current_user: CurrentUser) -> Any:
    owned_company(session, current_user, company_id)
    return session.exec(
        select(AssessmentCycle).where(AssessmentCycle.company_id == company_id)
    ).all()


@router.post("/assessment-cycles", response_model=AssessmentCycle)
def create_assessment_cycle(*, session: SessionDep, current_user: CurrentUser,
                            cycle_in: AssessmentCycleCreate) -> Any:
    owned_company(session, current_user, cycle_in.company_id)
    cycle = AssessmentCycle.model_validate(cycle_in)
    session.add(cycle)
    session.commit()
    session.refresh(cycle)
    return cycle


def owned_cycle(session: SessionDep, current_user: CurrentUser,
                cycle_id: uuid.UUID) -> AssessmentCycle:
    cycle = session.get(AssessmentCycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Assessment cycle not found")
    owned_company(session, current_user, cycle.company_id)
    return cycle


def calculate_cycle_result(session: SessionDep, cycle: AssessmentCycle) -> DRPSResult:
    saved = session.exec(
        select(DRPSResponse).where(DRPSResponse.cycle_id == cycle.id)
    ).all()
    try:
        return calculate_drps(
            [item.answers for item in saved], cycle.minimum_respondents
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/drps/import", response_model=DRPSImportResult)
def import_drps_responses(*, session: SessionDep, current_user: CurrentUser,
                          payload: DRPSImportRequest) -> Any:
    cycle = owned_cycle(session, current_user, payload.cycle_id)
    existing = session.exec(
        select(DRPSResponse).where(DRPSResponse.cycle_id == cycle.id)
    ).all()
    by_source = {item.source_response_id: item for item in existing}
    merged_answers = {item.source_response_id: item.answers for item in existing}
    for row in payload.responses:
        merged_answers[row.source_response_id] = row.answers
    try:
        result = calculate_drps(
            list(merged_answers.values()), cycle.minimum_respondents
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    replaced = 0
    for row in payload.responses:
        saved = by_source.get(row.source_response_id)
        values = row.model_dump()
        values["cycle_id"] = cycle.id
        if saved:
            saved.sqlmodel_update(values)
            session.add(saved)
            replaced += 1
        else:
            session.add(DRPSResponse.model_validate(values))
    cycle.status = AssessmentStatus.analysis
    session.add(cycle)
    session.commit()
    return DRPSImportResult(
        imported=len(payload.responses), replaced=replaced, result=result
    )


@router.get("/assessment-cycles/{cycle_id}/drps-result", response_model=DRPSResult)
def get_drps_result(cycle_id: uuid.UUID, session: SessionDep,
                    current_user: CurrentUser, sector_id: uuid.UUID | None = None,
                    ghe_id: uuid.UUID | None = None) -> Any:
    cycle = owned_cycle(session, current_user, cycle_id)
    query = select(DRPSResponse).where(DRPSResponse.cycle_id == cycle.id)
    if sector_id:
        query = query.where(DRPSResponse.sector_id == sector_id)
    if ghe_id:
        query = query.where(DRPSResponse.ghe_id == ghe_id)
    saved = session.exec(query).all()
    try:
        return calculate_drps([item.answers for item in saved], cycle.minimum_respondents)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/drps/calculate", response_model=DRPSResult)
def calculate_drps_endpoint(payload: DRPSRequest, current_user: CurrentUser) -> Any:
    del current_user
    try:
        return calculate_drps(payload.responses, payload.minimum_respondents)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/aep/calculate", response_model=list[AEPDimensionResult])
def calculate_aep_endpoint(items: list[AEPItemInput], current_user: CurrentUser) -> Any:
    del current_user
    try:
        return calculate_aep(items)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/aep/items", response_model=list[AEPItemPublic])
def list_aep_items(current_user: CurrentUser) -> list[AEPItemPublic]:
    del current_user
    return [
        AEPItemPublic(code=item.code, dimension_code=dimension.code,
                      dimension_name=dimension.name, text=item.text)
        for dimension in DIMENSIONS for item in dimension.aep_items
    ]


def aep_assessment_public(session: SessionDep,
                          assessment: AEPAssessment) -> AEPAssessmentPublic:
    answers = session.exec(
        select(AEPAnswer).where(AEPAnswer.assessment_id == assessment.id)
    ).all()
    return AEPAssessmentPublic(
        id=assessment.id, cycle_id=assessment.cycle_id, ghe_id=assessment.ghe_id,
        evaluator_id=assessment.evaluator_id,
        evidence_sources=assessment.evidence_sources, notes=assessment.notes,
        completed_at=assessment.completed_at,
        answers=[AEPAnswerPayload(
            item_code=answer.item_code, score=answer.score,
            evidence=answer.evidence, existing_controls=answer.existing_controls,
            technical_notes=answer.technical_notes,
        ) for answer in answers],
    )


@router.get("/assessment-cycles/{cycle_id}/aep-assessments/{ghe_id}",
            response_model=AEPAssessmentPublic | None)
def get_aep_assessment(cycle_id: uuid.UUID, ghe_id: uuid.UUID,
                       session: SessionDep, current_user: CurrentUser) -> Any:
    cycle = owned_cycle(session, current_user, cycle_id)
    ghe = owned_ghe(session, current_user, ghe_id)
    sector = session.get(Sector, ghe.sector_id)
    unit = session.get(Unit, sector.unit_id) if sector else None
    if not unit or unit.company_id != cycle.company_id:
        raise HTTPException(status_code=422, detail="O GHE não pertence à empresa deste ciclo.")
    assessment = session.exec(select(AEPAssessment).where(
        AEPAssessment.cycle_id == cycle_id, AEPAssessment.ghe_id == ghe_id,
    )).first()
    return aep_assessment_public(session, assessment) if assessment else None


@router.put("/assessment-cycles/{cycle_id}/aep-assessments/{ghe_id}",
            response_model=AEPAssessmentPublic)
def save_aep_assessment(cycle_id: uuid.UUID, ghe_id: uuid.UUID,
                        payload: AEPAssessmentPayload, session: SessionDep,
                        current_user: CurrentUser) -> Any:
    cycle = owned_cycle(session, current_user, cycle_id)
    ghe = owned_ghe(session, current_user, ghe_id)
    sector = session.get(Sector, ghe.sector_id)
    unit = session.get(Unit, sector.unit_id) if sector else None
    if not unit or unit.company_id != cycle.company_id:
        raise HTTPException(status_code=422, detail="O GHE não pertence à empresa deste ciclo.")
    valid_codes = {item.code for dimension in DIMENSIONS for item in dimension.aep_items}
    if len({answer.item_code for answer in payload.answers}) != len(payload.answers):
        raise HTTPException(status_code=422, detail="Existem itens AEP-PS duplicados.")
    for answer in payload.answers:
        if answer.item_code not in valid_codes:
            raise HTTPException(status_code=422, detail=f"Item AEP-PS inválido: {answer.item_code}")
        if payload.completed and answer.score >= 2 and not (answer.evidence or "").strip():
            raise HTTPException(status_code=422, detail=f"Informe a evidência para {answer.item_code}.")
    if payload.completed and {answer.item_code for answer in payload.answers} != valid_codes:
        raise HTTPException(status_code=422, detail="Responda todos os itens antes de concluir a AEP-PS.")
    assessment = session.exec(select(AEPAssessment).where(
        AEPAssessment.cycle_id == cycle_id, AEPAssessment.ghe_id == ghe_id,
    )).first()
    if not assessment:
        assessment = AEPAssessment(cycle_id=cycle_id, ghe_id=ghe_id,
                                   evaluator_id=current_user.id)
    assessment.notes = payload.notes
    assessment.evidence_sources = payload.evidence_sources
    if payload.completed:
        assessment.completed_at = datetime.now(UTC)
    session.add(assessment)
    session.flush()
    for answer in session.exec(select(AEPAnswer).where(
        AEPAnswer.assessment_id == assessment.id
    )).all():
        session.delete(answer)
    for answer in payload.answers:
        session.add(AEPAnswer(assessment_id=assessment.id, **answer.model_dump()))
    session.commit()
    session.refresh(assessment)
    return aep_assessment_public(session, assessment)


def owned_aep_assessment(session: SessionDep, current_user: CurrentUser,
                         assessment_id: uuid.UUID) -> AEPAssessment:
    assessment = session.get(AEPAssessment, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Avaliação AEP-PS não encontrada.")
    owned_cycle(session, current_user, assessment.cycle_id)
    return assessment


@router.get("/assessment-cycles/{cycle_id}/aep-assessments/{ghe_id}/evidence",
            response_model=list[AEPEvidencePublic])
def list_aep_evidence(cycle_id: uuid.UUID, ghe_id: uuid.UUID,
                      session: SessionDep, current_user: CurrentUser) -> Any:
    cycle = owned_cycle(session, current_user, cycle_id)
    owned_ghe(session, current_user, ghe_id)
    assessment = session.exec(select(AEPAssessment).where(
        AEPAssessment.cycle_id == cycle.id, AEPAssessment.ghe_id == ghe_id,
    )).first()
    if not assessment:
        return []
    return session.exec(select(AEPEvidence).where(
        AEPEvidence.assessment_id == assessment.id
    ).order_by(AEPEvidence.created_at.desc())).all()


@router.post("/assessment-cycles/{cycle_id}/aep-assessments/{ghe_id}/evidence",
             response_model=AEPEvidencePublic)
async def upload_aep_evidence(
    cycle_id: uuid.UUID, ghe_id: uuid.UUID, session: SessionDep,
    current_user: CurrentUser, category: str = Form(...),
    description: str | None = Form(None), item_code: str | None = Form(None),
    file: UploadFile = File(...),
) -> Any:
    cycle = owned_cycle(session, current_user, cycle_id)
    ghe = owned_ghe(session, current_user, ghe_id)
    sector = session.get(Sector, ghe.sector_id)
    unit = session.get(Unit, sector.unit_id) if sector else None
    if not unit or unit.company_id != cycle.company_id:
        raise HTTPException(status_code=422, detail="O GHE não pertence à empresa deste ciclo.")
    valid_codes = {item.code for dimension in DIMENSIONS for item in dimension.aep_items}
    if item_code and item_code not in valid_codes:
        raise HTTPException(status_code=422, detail="Item AEP-PS inválido.")
    allowed = {
        "application/pdf", "image/jpeg", "image/png",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    if file.content_type not in allowed:
        raise HTTPException(status_code=422, detail="Formato permitido: PDF, JPG, PNG, DOCX ou XLSX.")
    content = await file.read(10 * 1024 * 1024 + 1)
    if not content or len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="O arquivo deve ter no máximo 10 MB.")
    assessment = session.exec(select(AEPAssessment).where(
        AEPAssessment.cycle_id == cycle_id, AEPAssessment.ghe_id == ghe_id,
    )).first()
    if not assessment:
        assessment = AEPAssessment(cycle_id=cycle_id, ghe_id=ghe_id,
                                   evaluator_id=current_user.id)
        session.add(assessment)
        session.flush()
    evidence = AEPEvidence(
        assessment_id=assessment.id, item_code=item_code or None,
        category=category.strip(), description=(description or "").strip() or None,
        filename=Path(file.filename or "evidencia").name[:255],
        content_type=file.content_type, size_bytes=len(content), content=content,
        uploaded_by=current_user.id,
    )
    session.add(evidence)
    session.commit()
    session.refresh(evidence)
    return evidence


@router.get("/aep/evidence/{evidence_id}/download")
def download_aep_evidence(evidence_id: uuid.UUID, session: SessionDep,
                          current_user: CurrentUser) -> Response:
    evidence = session.get(AEPEvidence, evidence_id)
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidência não encontrada.")
    owned_aep_assessment(session, current_user, evidence.assessment_id)
    return Response(
        content=evidence.content, media_type=evidence.content_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(evidence.filename)}"},
    )


@router.delete("/aep/evidence/{evidence_id}")
def delete_aep_evidence(evidence_id: uuid.UUID, session: SessionDep,
                        current_user: CurrentUser) -> dict[str, str]:
    evidence = session.get(AEPEvidence, evidence_id)
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidência não encontrada.")
    owned_aep_assessment(session, current_user, evidence.assessment_id)
    session.delete(evidence)
    session.commit()
    return {"message": "Evidência excluída."}


@router.get("/integration/{dimension_code}", response_model=IntegrationResult)
def integrate_endpoint(dimension_code: str, drps_risk: RiskLevel,
                       aep_maximum_score: int, current_user: CurrentUser) -> Any:
    del current_user
    if not 0 <= aep_maximum_score <= 3:
        raise HTTPException(status_code=422, detail="AEP score must be between 0 and 3")
    return integrate_dimension(dimension_code, drps_risk, aep_maximum_score)
