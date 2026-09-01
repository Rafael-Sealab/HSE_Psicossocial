"""add AEP evidence attachments

Revision ID: b65d9f921e30
Revises: a4c9f2e8b731
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b65d9f921e30"
down_revision: str | None = "a4c9f2e8b731"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "aepevidence",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assessment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_code", sa.String(length=10), nullable=True),
        sa.Column("category", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=150), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["assessment_id"], ["aepassessment.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_aepevidence_assessment_id"), "aepevidence", ["assessment_id"])
    op.create_index(op.f("ix_aepevidence_item_code"), "aepevidence", ["item_code"])


def downgrade() -> None:
    op.drop_index(op.f("ix_aepevidence_item_code"), table_name="aepevidence")
    op.drop_index(op.f("ix_aepevidence_assessment_id"), table_name="aepevidence")
    op.drop_table("aepevidence")
