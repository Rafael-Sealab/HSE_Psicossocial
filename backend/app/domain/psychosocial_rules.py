"""Canonical DRPS and AEP-PS methodology rules.

These constants reproduce the approved spreadsheet and AEP-PS template.  The
module deliberately does not invent rules that the source material leaves
undefined, such as a minimum sample size or an aggregate AEP-PS score.
"""

from dataclasses import dataclass
from enum import Enum, IntEnum


class ItemPolarity(str, Enum):
    """How a raw Likert response is converted to an adverse-exposure score."""

    FAVORABLE = "favorable"
    ADVERSE = "adverse"


class RiskLevel(str, Enum):
    IRRELEVANT = "irrelevante"
    LOW = "baixo"
    MEDIUM = "médio"
    HIGH = "alto"
    CRITICAL = "crítico"


class DrpsCondition(str, Enum):
    """Explicit input to integration; no threshold is prescribed by the source."""

    FAVORABLE = "favorável"
    UNFAVORABLE = "desfavorável"


class AepRating(IntEnum):
    NOT_APPLICABLE = 0
    CONTROLLED = 1
    REQUIRES_ATTENTION = 2
    REQUIRES_INTERVENTION = 3


class IntegrationKind(str, Enum):
    NOT_APPLICABLE = "não aplicável"
    FAVORABLE_CONVERGENCE = "convergência favorável"
    RISK_CONVERGENCE = "convergência de risco"
    DIVERGENCE = "divergência"


@dataclass(frozen=True)
class DrpsItem:
    code: str
    text: str
    polarity: ItemPolarity


@dataclass(frozen=True)
class AepItem:
    code: str
    text: str


@dataclass(frozen=True)
class Dimension:
    code: str
    name: str
    severity: int
    drps_items: tuple[DrpsItem, ...]
    aep_items: tuple[AepItem, ...]


@dataclass(frozen=True)
class RiskDisposition:
    action_level: str
    deadline: str
    description: str


@dataclass(frozen=True)
class IntegrationResult:
    kind: IntegrationKind
    referral: str


def _drps(code: str, text: str, polarity: ItemPolarity) -> DrpsItem:
    return DrpsItem(code, text, polarity)


def _aep(code: str, text: str) -> AepItem:
    return AepItem(code, text)


F = ItemPolarity.FAVORABLE
A = ItemPolarity.ADVERSE

DIMENSIONS: tuple[Dimension, ...] = (
    Dimension("DEM", "Demandas", 2, (
        _drps("DEM_01", "Meu trabalho exige que eu trabalhe muito rapidamente", A),
        _drps("DEM_02", "Tenho pressão para cumprir prazos apertados", A),
        _drps("DEM_03", "Minha carga de trabalho é excessiva", A),
        _drps("DEM_04", "Preciso trabalhar além do meu horário com frequência", A),
    ), tuple(_aep(f"D01.{i:02d}", text) for i, text in enumerate((
        "Volume de trabalho incompatível com o tempo disponível",
        "Ritmo de trabalho elevado ou imposto",
        "Prazos excessivamente curtos ou urgências frequentes",
        "Interrupções frequentes durante as atividades",
        "Acúmulo ou simultaneidade de tarefas",
        "Exigência elevada de atenção, concentração ou carga emocional",
    ), 1))),
    Dimension("CON", "Controle e Autonomia", 2, (
        _drps("CON_01", "Tenho autonomia para decidir como realizar meu trabalho", F),
        _drps("CON_02", "Posso organizar meu ritmo de trabalho", F),
        _drps("CON_03", "Tenho liberdade para tomar decisões dentro da minha função", F),
        _drps("CON_04", "Tenho influência sobre as decisões que afetam meu trabalho", F),
    ), tuple(_aep(f"D02.{i:02d}", text) for i, text in enumerate((
        "Baixa participação nas decisões relacionadas ao próprio trabalho",
        "Pouca liberdade para organizar sequência, ritmo ou execução das tarefas",
        "Controle ou fiscalização excessivos da execução",
        "Responsabilidade atribuída sem autonomia correspondente",
        "Dificuldade para propor melhorias ou ajustar a forma de trabalho",
        "Baixa possibilidade de escolha diante de imprevistos da atividade",
    ), 1))),
    Dimension("APL", "Apoio da Liderança", 2, (
        _drps("APL_01", "Recebo apoio do meu superior quando necessário", F),
        _drps("APL_02", "Meu superior trata os colaboradores com respeito", F),
        _drps("APL_03", "Recebo orientações claras do meu gestor", F),
    ), tuple(_aep(f"D03.{i:02d}", text) for i, text in enumerate((
        "Orientações insuficientes para execução do trabalho", "Baixa disponibilidade da liderança para apoio diante de dificuldades", "Feedback insuficiente ou pouco claro", "Tratamento inconsistente ou pouco respeitoso pela liderança", "Falta de apoio na priorização de demandas conflitantes"), 1))),
    Dimension("APE", "Apoio da Equipe", 2, (
        _drps("APE_01", "Posso contar com meus colegas de trabalho", F),
        _drps("APE_02", "Existe colaboração entre a equipe", F),
        _drps("APE_03", "Existe um bom relacionamento entre colegas", F),
    ), tuple(_aep(f"D04.{i:02d}", text) for i, text in enumerate((
        "Baixa cooperação entre colegas", "Dificuldade de obter ajuda quando necessária", "Comunicação insuficiente entre membros da equipe", "Isolamento profissional ou social durante o trabalho", "Distribuição de atividades percebida como pouco colaborativa"), 1))),
    Dimension("REL", "Relacionamentos e Conflitos", 3, (
        _drps("REL_01", "Existem conflitos frequentes no ambiente de trabalho", A),
        _drps("REL_02", "Existem comportamentos desrespeitosos entre colegas", A),
        _drps("REL_03", "Existem comportamentos desrespeitosos por parte da liderança", A),
        _drps("REL_04", "Sinto que sou tratado com justiça no trabalho", F),
    ), tuple(_aep(f"D05.{i:02d}", text) for i, text in enumerate((
        "Conflitos interpessoais recorrentes", "Comunicação agressiva, desrespeitosa ou inadequada", "Dificuldade de tratamento e resolução de conflitos", "Tensões entre áreas, equipes ou funções", "Situações de exposição pública, constrangimento ou hostilidade"), 1))),
    Dimension("CLA", "Clareza de Papel e Função", 2, (
        _drps("CLA_01", "Sei exatamente quais são as minhas responsabilidades", F),
        _drps("CLA_02", "Recebo instruções claras sobre meu trabalho", F),
        _drps("CLA_03", "Não recebo demandas conflitantes", F),
    ), tuple(_aep(f"D06.{i:02d}", text) for i, text in enumerate((
        "Atribuições e responsabilidades pouco definidas", "Prioridades de trabalho pouco claras", "Ordens ou orientações contraditórias", "Limites de atuação da função pouco definidos", "Expectativas de desempenho não comunicadas de forma clara"), 1))),
    Dimension("MUD", "Mudanças Organizacionais", 2, (
        _drps("MUD_01", "Sou informado sobre mudanças que afetam meu trabalho", F),
        _drps("MUD_02", "As mudanças são bem comunicadas pela empresa", F),
        _drps("MUD_03", "Tenho tempo para me adaptar às mudanças", F),
    ), tuple(_aep(f"D07.{i:02d}", text) for i, text in enumerate((
        "Mudanças implementadas sem comunicação adequada", "Informações insuficientes sobre alterações que afetam o trabalho", "Baixa participação dos trabalhadores em mudanças relevantes", "Preparação ou treinamento insuficiente para novas demandas", "Incerteza operacional gerada por mudanças frequentes"), 1))),
    Dimension("REC", "Reconhecimento", 2, (
        _drps("REC_01", "Meu trabalho é reconhecido pela empresa", F),
        _drps("REC_02", "Recebo feedback sobre meu desempenho", F),
        _drps("REC_03", "Sinto que meu esforço é valorizado", F),
    ), tuple(_aep(f"D08.{i:02d}", text) for i, text in enumerate((
        "Esforço ou contribuição pouco reconhecidos", "Feedback positivo insuficiente", "Critérios de reconhecimento pouco claros ou inconsistentes", "Oportunidades de desenvolvimento percebidas como insuficientes", "Trabalho percebido como pouco valorizado pela organização"), 1))),
    Dimension("EQU", "Equilíbrio Trabalho x Vida", 3, (
        _drps("EQU_01", "Meu trabalho interfere na minha vida pessoal", A),
        _drps("EQU_02", "Tenho tempo suficiente para descanso", F),
        _drps("EQU_03", "Consigo equilibrar trabalho e vida pessoal", F),
    ), tuple(_aep(f"D09.{i:02d}", text) for i, text in enumerate((
        "Jornada ou extensão de jornada interferindo na recuperação", "Demandas fora do horário habitual de trabalho", "Pausas ou intervalos insuficientes", "Escalas/horários com baixa previsibilidade", "Dificuldade de conciliar demandas profissionais e vida pessoal"), 1))),
    Dimension("ASS", "Assédio e Segurança Psicológica", 3, (
        _drps("ASS_01", "Já me senti constrangido em meu ambiente de trabalho", A),
        _drps("ASS_02", "Já presenciei situações de desrespeito", A),
        _drps("ASS_03", "Sinto que posso relatar problemas sem medo de represálias", F),
    ), tuple(_aep(f"D10.{i:02d}", text) for i, text in enumerate((
        "Receio de expressar dúvidas, opiniões ou erros", "Ameaças, intimidações ou comportamentos hostis", "Situações percebidas como humilhantes ou constrangedoras", "Indícios de discriminação ou tratamento desigual inadequado", "Indícios de assédio moral ou sexual que exijam apuração própria", "Ausência ou desconhecimento de canais seguros para comunicação"), 1))),
)

DIMENSIONS_BY_CODE = {dimension.code: dimension for dimension in DIMENSIONS}
DRPS_ITEMS_BY_CODE = {
    item.code: item for dimension in DIMENSIONS for item in dimension.drps_items
}

LIKERT_VALUES = {"Nunca": 1, "Raramente": 2, "Às vezes": 3, "Frequentemente": 4, "Sempre": 5}

# Spreadsheet matrix, including S=1 and S=4 for compatibility with the PGR.
RISK_MATRIX: dict[tuple[int, int], RiskLevel] = {
    (1, 1): RiskLevel.IRRELEVANT, (1, 2): RiskLevel.LOW, (1, 3): RiskLevel.LOW, (1, 4): RiskLevel.MEDIUM,
    (2, 1): RiskLevel.LOW, (2, 2): RiskLevel.LOW, (2, 3): RiskLevel.MEDIUM, (2, 4): RiskLevel.HIGH,
    (3, 1): RiskLevel.LOW, (3, 2): RiskLevel.MEDIUM, (3, 3): RiskLevel.HIGH, (3, 4): RiskLevel.HIGH,
    (4, 1): RiskLevel.MEDIUM, (4, 2): RiskLevel.HIGH, (4, 3): RiskLevel.HIGH, (4, 4): RiskLevel.CRITICAL,
}

RISK_DISPOSITIONS = {
    RiskLevel.CRITICAL: RiskDisposition("Intervenção imediata", "Imediato", "Ação urgente, risco inaceitável"),
    RiskLevel.HIGH: RiskDisposition("Ação prioritária", "Até 90 dias", "Implementar medidas corretivas"),
    RiskLevel.MEDIUM: RiskDisposition("Plano de ação", "Até 180 dias", "Melhorias programadas"),
    RiskLevel.LOW: RiskDisposition("Monitoramento", "Revisão periódica", "Manter controle"),
    RiskLevel.IRRELEVANT: RiskDisposition("Aceitável", "Não aplicável", "Sem ação necessária"),
}


def score_drps_item(item_code: str, response: str | int) -> int:
    """Convert a response to 1..5, where a larger score is always worse."""
    try:
        raw = LIKERT_VALUES[response] if isinstance(response, str) else response
        item = DRPS_ITEMS_BY_CODE[item_code]
    except KeyError as exc:
        raise ValueError(f"Unknown DRPS item or response: {exc.args[0]}") from exc
    if isinstance(raw, bool) or not isinstance(raw, int) or not 1 <= raw <= 5:
        raise ValueError("DRPS response must be an integer from 1 to 5")
    return 6 - raw if item.polarity is ItemPolarity.FAVORABLE else raw


def probability_from_mean(mean: float) -> int:
    """Map an adverse DRPS mean to probability P, following spreadsheet cutoffs."""
    if not 1 <= mean <= 5:
        raise ValueError("DRPS mean must be between 1 and 5")
    if mean < 1.76:
        return 1
    if mean < 2.51:
        return 2
    if mean < 3.51:
        return 3
    return 4


def classify_risk(probability: int, severity: int) -> RiskLevel:
    try:
        return RISK_MATRIX[(probability, severity)]
    except KeyError as exc:
        raise ValueError("Probability and severity must be integers from 1 to 4") from exc


def classify_dimension(dimension_code: str, mean: float) -> RiskLevel:
    try:
        severity = DIMENSIONS_BY_CODE[dimension_code].severity
    except KeyError as exc:
        raise ValueError(f"Unknown dimension: {dimension_code}") from exc
    return classify_risk(probability_from_mean(mean), severity)


def integrate_drps_aep(
    drps: DrpsCondition, aep: AepRating
) -> IntegrationResult:
    """Apply the qualitative matrix; DRPS and AEP-PS are never averaged."""
    if aep is AepRating.NOT_APPLICABLE:
        return IntegrationResult(IntegrationKind.NOT_APPLICABLE, "Registrar justificativa e não integrar esta dimensão")
    if drps is DrpsCondition.FAVORABLE and aep is AepRating.CONTROLLED:
        return IntegrationResult(IntegrationKind.FAVORABLE_CONVERGENCE, "Manter controles e monitorar")
    if drps is DrpsCondition.UNFAVORABLE and aep in (AepRating.REQUIRES_ATTENTION, AepRating.REQUIRES_INTERVENTION):
        return IntegrationResult(IntegrationKind.RISK_CONVERGENCE, "Priorizar avaliação no PGR e medidas preventivas")
    if drps is DrpsCondition.UNFAVORABLE:
        return IntegrationResult(IntegrationKind.DIVERGENCE, "Aprofundar análise antes de concluir")
    return IntegrationResult(IntegrationKind.DIVERGENCE, "Verificar evidências, contexto e controles")
