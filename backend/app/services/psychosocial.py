from collections import defaultdict
from statistics import fmean

from pydantic import BaseModel, Field, model_validator

from app.domain.psychosocial_rules import (
    DIMENSIONS as METHODOLOGY_DIMENSIONS,
    DRPS_ITEMS_BY_CODE,
    IntegrationKind,
    RiskLevel,
    classify_risk,
    probability_from_mean,
    score_drps_item,
)

DIMENSIONS = {
    dimension.code: (dimension.name, dimension.severity)
    for dimension in METHODOLOGY_DIMENSIONS
}


class DimensionResult(BaseModel):
    code: str
    name: str
    mean: float
    probability: int
    severity: int
    risk: RiskLevel


class DRPSResult(BaseModel):
    respondent_count: int
    dimensions: list[DimensionResult]
    general_mean: float
    priority_dimension: str
    overall_risk: RiskLevel


class AEPDimensionResult(BaseModel):
    code: str
    applicable_items: int
    maximum_score: int
    requires_attention: bool


class IntegrationResult(BaseModel):
    dimension_code: str
    kind: IntegrationKind
    referral: str


class DRPSRequest(BaseModel):
    responses: list[dict[str, int]]
    minimum_respondents: int = Field(default=5, ge=2)


class AEPItemInput(BaseModel):
    item_code: str
    score: int = Field(ge=0, le=3)
    evidence: str | None = None

    @model_validator(mode="after")
    def require_evidence_for_attention(self) -> "AEPItemInput":
        if self.score >= 2 and not (self.evidence and self.evidence.strip()):
            raise ValueError("evidence is required when score is 2 or 3")
        return self


def probability_for_mean(mean: float) -> int:
    return probability_from_mean(mean)


RISK_ORDER = list(RiskLevel)


def score_response(response: dict[str, int]) -> dict[str, float]:
    grouped: dict[str, list[int]] = defaultdict(list)
    for code, raw in response.items():
        if code not in DRPS_ITEMS_BY_CODE:
            continue
        normalized = score_drps_item(code, raw)
        grouped[code[:3]].append(normalized)
    missing = set(DIMENSIONS) - grouped.keys()
    if missing:
        raise ValueError(f"missing dimensions: {', '.join(sorted(missing))}")
    return {code: fmean(scores) for code, scores in grouped.items()}


def calculate_drps(
    responses: list[dict[str, int]], minimum_respondents: int = 5
) -> DRPSResult:
    if len(responses) < minimum_respondents:
        raise ValueError("insufficient respondents for anonymous aggregation")
    individual = [score_response(response) for response in responses]
    results = []
    for code, (name, severity) in DIMENSIONS.items():
        mean = fmean(row[code] for row in individual)
        probability = probability_for_mean(mean)
        results.append(DimensionResult(
            code=code, name=name, mean=round(mean, 2), probability=probability,
            severity=severity, risk=classify_risk(probability, severity)
        ))
    priority = max(results, key=lambda item: item.mean)
    overall = max(results, key=lambda item: RISK_ORDER.index(item.risk)).risk
    return DRPSResult(
        respondent_count=len(responses), dimensions=results,
        general_mean=round(fmean(item.mean for item in results), 2),
        priority_dimension=priority.code, overall_risk=overall,
    )


def calculate_aep(items: list[AEPItemInput]) -> list[AEPDimensionResult]:
    grouped: dict[str, list[AEPItemInput]] = defaultdict(list)
    for item in items:
        code = item.item_code.split(".", 1)[0]
        if code not in {f"D{i:02}" for i in range(1, 11)}:
            raise ValueError(f"invalid AEP item code: {item.item_code}")
        grouped[code].append(item)
    return [
        AEPDimensionResult(
            code=code,
            applicable_items=sum(item.score > 0 for item in grouped.get(code, [])),
            maximum_score=max((item.score for item in grouped.get(code, [])), default=0),
            requires_attention=any(item.score >= 2 for item in grouped.get(code, [])),
        )
        for code in (f"D{i:02}" for i in range(1, 11))
    ]


def integrate_dimension(
    dimension_code: str, drps_risk: RiskLevel, aep_maximum_score: int
) -> IntegrationResult:
    drps_unfavorable = drps_risk in {RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL}
    aep_unfavorable = aep_maximum_score >= 2
    if drps_unfavorable and aep_unfavorable:
        return IntegrationResult(dimension_code=dimension_code, kind=IntegrationKind.RISK_CONVERGENCE,
            referral="Priorizar avaliação no PGR e medidas preventivas.")
    if not drps_unfavorable and not aep_unfavorable:
        return IntegrationResult(dimension_code=dimension_code, kind=IntegrationKind.FAVORABLE_CONVERGENCE,
            referral="Manter controles e monitorar.")
    return IntegrationResult(dimension_code=dimension_code, kind=IntegrationKind.DIVERGENCE,
        referral="Aprofundar a análise das evidências, do contexto e dos controles.")
