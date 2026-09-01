import uuid
from datetime import UTC, date, datetime
from enum import StrEnum

from pydantic import EmailStr
from sqlalchemy import JSON, DateTime, LargeBinary
from sqlmodel import Field, Relationship, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(SQLModel):
    email: EmailStr | None = Field(default=None, max_length=255)
    is_active: bool | None = None
    is_superuser: bool | None = None
    full_name: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    items: list[Item] = Relationship(back_populates="owner", cascade_delete=True)


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


# Psychosocial assessment domain
class AssessmentStatus(StrEnum):
    draft = "draft"
    collecting = "collecting"
    analysis = "analysis"
    completed = "completed"


class CompanyBase(SQLModel):
    legal_name: str = Field(min_length=1, max_length=255)
    trade_name: str | None = Field(default=None, max_length=255)
    cnpj: str = Field(min_length=14, max_length=18, index=True)


class CompanyCreate(CompanyBase):
    pass


class Company(CompanyBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(foreign_key="user.id", index=True, nullable=False)
    created_at: datetime = Field(
        default_factory=get_datetime_utc, sa_type=DateTime(timezone=True)
    )


class CompanyPublic(CompanyBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime


class CompaniesPublic(SQLModel):
    data: list[CompanyPublic]
    count: int


class UnitBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)


class UnitCreate(UnitBase):
    company_id: uuid.UUID


class Unit(UnitBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    company_id: uuid.UUID = Field(
        foreign_key="company.id", index=True, nullable=False, ondelete="CASCADE"
    )


class SectorBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)


class SectorCreate(SectorBase):
    unit_id: uuid.UUID


class Sector(SectorBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    unit_id: uuid.UUID = Field(
        foreign_key="unit.id", index=True, nullable=False, ondelete="CASCADE"
    )


class GHEBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    worker_count: int = Field(default=0, ge=0)
    work_schedule: str | None = Field(default=None, max_length=255)
    activity_description: str | None = Field(default=None, max_length=2000)


class GHECreate(GHEBase):
    sector_id: uuid.UUID


class GHE(GHEBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    sector_id: uuid.UUID = Field(
        foreign_key="sector.id", index=True, nullable=False, ondelete="CASCADE"
    )


class JobRole(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ghe_id: uuid.UUID = Field(
        foreign_key="ghe.id", index=True, nullable=False, ondelete="CASCADE"
    )
    name: str = Field(min_length=1, max_length=255)
    worker_count: int = Field(default=0, ge=0)


class AssessmentCycle(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    company_id: uuid.UUID = Field(
        foreign_key="company.id", index=True, nullable=False, ondelete="CASCADE"
    )
    name: str = Field(min_length=1, max_length=255)
    assessment_date: date
    minimum_respondents: int = Field(default=5, ge=2)
    status: AssessmentStatus = Field(default=AssessmentStatus.draft)
    methodology_version: str = Field(default="DRPS-1.0", max_length=50)


class AssessmentCycleCreate(SQLModel):
    company_id: uuid.UUID
    name: str = Field(min_length=1, max_length=255)
    assessment_date: date
    minimum_respondents: int = Field(default=5, ge=2)


class DRPSResponse(SQLModel, table=True):
    """An anonymized response. Direct identifiers must not be stored here."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    cycle_id: uuid.UUID = Field(
        foreign_key="assessmentcycle.id", index=True, nullable=False, ondelete="CASCADE"
    )
    sector_id: uuid.UUID | None = Field(default=None, foreign_key="sector.id", index=True)
    ghe_id: uuid.UUID | None = Field(default=None, foreign_key="ghe.id", index=True)
    job_role_id: uuid.UUID | None = Field(
        default=None, foreign_key="jobrole.id", index=True
    )
    source_response_id: str = Field(max_length=255, index=True)
    answers: dict[str, int] = Field(default_factory=dict, sa_type=JSON)
    submitted_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))


class AEPAssessment(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    cycle_id: uuid.UUID = Field(
        foreign_key="assessmentcycle.id", index=True, nullable=False, ondelete="CASCADE"
    )
    ghe_id: uuid.UUID = Field(foreign_key="ghe.id", index=True, nullable=False)
    evaluator_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    evidence_sources: list[str] = Field(default_factory=list, sa_type=JSON)
    notes: str | None = Field(default=None, max_length=4000)
    completed_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))


class AEPAnswer(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    assessment_id: uuid.UUID = Field(
        foreign_key="aepassessment.id", index=True, nullable=False, ondelete="CASCADE"
    )
    item_code: str = Field(min_length=6, max_length=10, index=True)
    score: int = Field(ge=0, le=3)
    evidence: str | None = Field(default=None, max_length=4000)
    existing_controls: str | None = Field(default=None, max_length=4000)
    technical_notes: str | None = Field(default=None, max_length=4000)


class AEPEvidence(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    assessment_id: uuid.UUID = Field(
        foreign_key="aepassessment.id", index=True, nullable=False, ondelete="CASCADE"
    )
    item_code: str | None = Field(default=None, max_length=10, index=True)
    category: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=150)
    size_bytes: int = Field(ge=1)
    content: bytes = Field(sa_type=LargeBinary)
    uploaded_by: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    created_at: datetime = Field(default_factory=get_datetime_utc, sa_type=DateTime(timezone=True))


class ActionItem(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    cycle_id: uuid.UUID = Field(
        foreign_key="assessmentcycle.id", index=True, nullable=False, ondelete="CASCADE"
    )
    ghe_id: uuid.UUID | None = Field(default=None, foreign_key="ghe.id", index=True)
    dimension_code: str = Field(min_length=3, max_length=3)
    action: str = Field(min_length=1, max_length=4000)
    responsible: str | None = Field(default=None, max_length=255)
    due_date: date | None = None
    indicator: str | None = Field(default=None, max_length=1000)
    status: str = Field(default="recommended", max_length=50)
