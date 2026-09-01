import pytest

from app.services.psychosocial import (
    AEPItemInput,
    IntegrationKind,
    RiskLevel,
    calculate_aep,
    calculate_drps,
    integrate_dimension,
    probability_for_mean,
    score_response,
)


def complete_response(value: int = 3) -> dict[str, int]:
    prefixes = {"DEM": 4, "CON": 4, "APL": 3, "APE": 3, "REL": 4,
                "CLA": 3, "MUD": 3, "REC": 3, "EQU": 3, "ASS": 3}
    return {f"{prefix}_{index:02}": value
            for prefix, count in prefixes.items() for index in range(1, count + 1)}


@pytest.mark.parametrize(("mean", "expected"), [
    (1.0, 1), (1.75, 1), (1.76, 2), (2.50, 2),
    (2.51, 3), (3.50, 3), (3.51, 4), (5.0, 4),
])
def test_probability_boundaries(mean: float, expected: int) -> None:
    assert probability_for_mean(mean) == expected


def test_favorable_questions_are_reversed() -> None:
    response = complete_response(3)
    response["DEM_01"] = 5
    response["CON_01"] = 5
    scores = score_response(response)
    assert scores["DEM"] == 3.5
    assert scores["CON"] == 2.5


def test_drps_uses_worst_risk_not_general_mean() -> None:
    result = calculate_drps([complete_response()] * 5)
    assert result.respondent_count == 5
    assert result.overall_risk == RiskLevel.HIGH
    assert result.priority_dimension == "DEM"


def test_drps_suppresses_small_groups() -> None:
    with pytest.raises(ValueError, match="insufficient respondents"):
        calculate_drps([complete_response()] * 4)


def test_aep_requires_evidence_for_scores_two_and_three() -> None:
    with pytest.raises(ValueError, match="evidence is required"):
        AEPItemInput(item_code="D01.01", score=2)


def test_aep_aggregation_uses_maximum_without_averaging() -> None:
    result = calculate_aep([
        AEPItemInput(item_code="D01.01", score=1),
        AEPItemInput(item_code="D01.02", score=3, evidence="Prazo incompatível"),
    ])
    assert result[0].maximum_score == 3
    assert result[0].requires_attention is True


@pytest.mark.parametrize(("risk", "aep", "kind"), [
    (RiskLevel.LOW, 1, IntegrationKind.FAVORABLE_CONVERGENCE),
    (RiskLevel.HIGH, 3, IntegrationKind.RISK_CONVERGENCE),
    (RiskLevel.HIGH, 1, IntegrationKind.DIVERGENCE),
    (RiskLevel.LOW, 2, IntegrationKind.DIVERGENCE),
])
def test_integration_matrix(risk: RiskLevel, aep: int, kind: IntegrationKind) -> None:
    assert integrate_dimension("D01", risk, aep).kind == kind
