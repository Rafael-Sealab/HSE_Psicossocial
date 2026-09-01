"""Add psychosocial domain models.

Revision ID: a4c9f2e8b731
Revises: fe56fa70289e
Create Date: 2026-08-26 16:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a4c9f2e8b731"
down_revision = "fe56fa70289e"
branch_labels = None
depends_on = None


assessment_status = postgresql.ENUM(
    "draft",
    "collecting",
    "analysis",
    "completed",
    name="assessmentstatus",
    create_type=False,
)


def upgrade() -> None:
    assessment_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "company",
        sa.Column("legal_name", sa.String(length=255), nullable=False),
        sa.Column("trade_name", sa.String(length=255), nullable=True),
        sa.Column("cnpj", sa.String(length=18), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_company_cnpj"), "company", ["cnpj"], unique=False)
    op.create_index(
        op.f("ix_company_owner_id"), "company", ["owner_id"], unique=False
    )

    op.create_table(
        "unit",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["company_id"], ["company.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_unit_company_id"), "unit", ["company_id"], unique=False)

    op.create_table(
        "sector",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("unit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["unit_id"], ["unit.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sector_unit_id"), "sector", ["unit_id"], unique=False)

    op.create_table(
        "ghe",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("worker_count", sa.Integer(), nullable=False),
        sa.Column("work_schedule", sa.String(length=255), nullable=True),
        sa.Column("activity_description", sa.String(length=2000), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sector_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.CheckConstraint("worker_count >= 0", name="ck_ghe_worker_count_nonnegative"),
        sa.ForeignKeyConstraint(
            ["sector_id"], ["sector.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ghe_sector_id"), "ghe", ["sector_id"], unique=False)

    op.create_table(
        "jobrole",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ghe_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("worker_count", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "worker_count >= 0", name="ck_jobrole_worker_count_nonnegative"
        ),
        sa.ForeignKeyConstraint(["ghe_id"], ["ghe.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_jobrole_ghe_id"), "jobrole", ["ghe_id"], unique=False)

    op.create_table(
        "assessmentcycle",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("assessment_date", sa.Date(), nullable=False),
        sa.Column("minimum_respondents", sa.Integer(), nullable=False),
        sa.Column("status", assessment_status, nullable=False),
        sa.Column("methodology_version", sa.String(length=50), nullable=False),
        sa.CheckConstraint(
            "minimum_respondents >= 2",
            name="ck_assessmentcycle_minimum_respondents",
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["company.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_assessmentcycle_company_id"),
        "assessmentcycle",
        ["company_id"],
        unique=False,
    )

    op.create_table(
        "drpsresponse",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cycle_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sector_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ghe_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("job_role_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_response_id", sa.String(length=255), nullable=False),
        sa.Column("answers", sa.JSON(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["cycle_id"], ["assessmentcycle.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["ghe_id"], ["ghe.id"]),
        sa.ForeignKeyConstraint(["job_role_id"], ["jobrole.id"]),
        sa.ForeignKeyConstraint(["sector_id"], ["sector.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("cycle_id", "sector_id", "ghe_id", "job_role_id", "source_response_id"):
        op.create_index(
            op.f(f"ix_drpsresponse_{column}"),
            "drpsresponse",
            [column],
            unique=False,
        )

    op.create_table(
        "aepassessment",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cycle_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ghe_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("evaluator_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("evidence_sources", sa.JSON(), nullable=False),
        sa.Column("notes", sa.String(length=4000), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["cycle_id"], ["assessmentcycle.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["evaluator_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["ghe_id"], ["ghe.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_aepassessment_cycle_id"),
        "aepassessment",
        ["cycle_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_aepassessment_ghe_id"), "aepassessment", ["ghe_id"], unique=False
    )

    op.create_table(
        "aepanswer",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assessment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_code", sa.String(length=10), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("evidence", sa.String(length=4000), nullable=True),
        sa.Column("existing_controls", sa.String(length=4000), nullable=True),
        sa.Column("technical_notes", sa.String(length=4000), nullable=True),
        sa.CheckConstraint("score >= 0 AND score <= 3", name="ck_aepanswer_score"),
        sa.ForeignKeyConstraint(
            ["assessment_id"], ["aepassessment.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_aepanswer_assessment_id"),
        "aepanswer",
        ["assessment_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_aepanswer_item_code"), "aepanswer", ["item_code"], unique=False
    )

    op.create_table(
        "actionitem",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cycle_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ghe_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("dimension_code", sa.String(length=3), nullable=False),
        sa.Column("action", sa.String(length=4000), nullable=False),
        sa.Column("responsible", sa.String(length=255), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("indicator", sa.String(length=1000), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(
            ["cycle_id"], ["assessmentcycle.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["ghe_id"], ["ghe.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_actionitem_cycle_id"), "actionitem", ["cycle_id"], unique=False
    )
    op.create_index(
        op.f("ix_actionitem_ghe_id"), "actionitem", ["ghe_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_actionitem_ghe_id"), table_name="actionitem")
    op.drop_index(op.f("ix_actionitem_cycle_id"), table_name="actionitem")
    op.drop_table("actionitem")

    op.drop_index(op.f("ix_aepanswer_item_code"), table_name="aepanswer")
    op.drop_index(op.f("ix_aepanswer_assessment_id"), table_name="aepanswer")
    op.drop_table("aepanswer")

    op.drop_index(op.f("ix_aepassessment_ghe_id"), table_name="aepassessment")
    op.drop_index(op.f("ix_aepassessment_cycle_id"), table_name="aepassessment")
    op.drop_table("aepassessment")

    for column in reversed(
        ("cycle_id", "sector_id", "ghe_id", "job_role_id", "source_response_id")
    ):
        op.drop_index(op.f(f"ix_drpsresponse_{column}"), table_name="drpsresponse")
    op.drop_table("drpsresponse")

    op.drop_index(
        op.f("ix_assessmentcycle_company_id"), table_name="assessmentcycle"
    )
    op.drop_table("assessmentcycle")

    op.drop_index(op.f("ix_jobrole_ghe_id"), table_name="jobrole")
    op.drop_table("jobrole")
    op.drop_index(op.f("ix_ghe_sector_id"), table_name="ghe")
    op.drop_table("ghe")
    op.drop_index(op.f("ix_sector_unit_id"), table_name="sector")
    op.drop_table("sector")
    op.drop_index(op.f("ix_unit_company_id"), table_name="unit")
    op.drop_table("unit")
    op.drop_index(op.f("ix_company_owner_id"), table_name="company")
    op.drop_index(op.f("ix_company_cnpj"), table_name="company")
    op.drop_table("company")

    assessment_status.drop(op.get_bind(), checkfirst=True)
