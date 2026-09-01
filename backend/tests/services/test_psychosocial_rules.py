import pytest

from app.domain.psychosocial_rules import (
    AepRating,
    DIMENSIONS,
    DIMENSIONS_BY_CODE,
    DrpsCondition,
    IntegrationKind,
    RiskLevel,
    classify_dimension,
    classify_risk,
    integrate_drps_aep,
    probability_from_mean,
    score_drps_item,
)


def test_methodology_has_all_dimensions_and_items() -> None:
    assert [dimension.code for dimension in DIMENSIONS] == [
        "DEM", "CON", "APL", "APE", "REL", "CLA", "MUD", "REC", "EQU", "ASS"
    ]
    assert sum(len(dimension.drps_items) for dimension in DIMENSIONS) == 33
    assert sum(len(dimension.aep_items) for dimension in DIMENSIONS) == 53
    assert [DIMENSIONS_BY_CODE[code].severity for code in ("REL", "EQU", "ASS")] == [3, 3, 3]


@pytest.mark.parametrize(
    ("code", "response", "expected"),
    [("DEM_01", "Sempre", 5), ("DEM_01", "Nunca", 1), ("CON_01", "Sempre", 1), ("CON_01", "Nunca", 5), ("ASS_03", 4, 2)],
)
def test_drps_scoring_normalizes_to_adverse_direction(code: str, response: str | int, expected: int) -> None:
    assert score_drps_item(code, response) == expected


@pytest.mark.parametrize("mean,expected", [(1.0, 1), (1.75, 1), (1.76, 2), (2.5, 2), (2.51, 3), (3.5, 3), (3.51, 4), (5.0, 4)])
def test_probability_cutoffs(mean: float, expected: int) -> None:
    assert probability_from_mean(mean) == expected


def test_risk_matrix_and_dimension_severity() -> None:
    assert classify_risk(1, 1) is RiskLevel.IRRELEVANT
    assert classify_risk(4, 4) is RiskLevel.CRITICAL
    assert classify_dimension("DEM", 3.0) is RiskLevel.MEDIUM
    assert classify_dimension("REL", 3.0) is RiskLevel.HIGH


@pytest.mark.parametrize(
    ("drps", "aep", "kind"),
    [
        (DrpsCondition.FAVORABLE, AepRating.CONTROLLED, IntegrationKind.FAVORABLE_CONVERGENCE),
        (DrpsCondition.UNFAVORABLE, AepRating.REQUIRES_ATTENTION, IntegrationKind.RISK_CONVERGENCE),
        (DrpsCondition.UNFAVORABLE, AepRating.REQUIRES_INTERVENTION, IntegrationKind.RISK_CONVERGENCE),
        (DrpsCondition.UNFAVORABLE, AepRating.CONTROLLED, IntegrationKind.DIVERGENCE),
        (DrpsCondition.FAVORABLE, AepRating.REQUIRES_ATTENTION, IntegrationKind.DIVERGENCE),
        (DrpsCondition.FAVORABLE, AepRating.NOT_APPLICABLE, IntegrationKind.NOT_APPLICABLE),
    ],
)
def test_drps_aep_integration(drps: DrpsCondition, aep: AepRating, kind: IntegrationKind) -> None:
    assert integrate_drps_aep(drps, aep).kind is kind


@pytest.mark.parametrize("mean", [0.99, 5.01])
def test_invalid_mean_is_rejected(mean: float) -> None:
    with pytest.raises(ValueError):
        probability_from_mean(mean)
