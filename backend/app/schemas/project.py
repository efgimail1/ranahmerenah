from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date
from decimal import Decimal
from app.models.project import ProjectStatus, PaymentTermType, PaymentStatus


# ─── Project Payment ───────────────────────────────────────

class ProjectPaymentBase(BaseModel):
    term_type: PaymentTermType
    term_label: Optional[str] = None
    percentage: Optional[Decimal] = None
    amount: Optional[Decimal] = None
    due_date: Optional[date] = None
    paid_date: Optional[date] = None
    status: Optional[PaymentStatus] = None
    notes: Optional[str] = None
    amount_paid: Optional[Decimal] = None

class ProjectPaymentCreate(ProjectPaymentBase):
    pass

class ProjectPaymentUpdate(BaseModel):
    term_label: Optional[str] = None
    percentage: Optional[Decimal] = None
    amount: Optional[Decimal] = None
    due_date: Optional[date] = None
    paid_date: Optional[date] = None
    status: Optional[PaymentStatus] = None
    notes: Optional[str] = None
    amount_paid: Optional[Decimal] = None
class ProjectPaymentResponse(ProjectPaymentBase):
    id: int
    project_id: int
    paid_date: Optional[date] = None
    status: PaymentStatus
    amount_paid: Optional[Decimal] = Decimal("0") 

    class Config:
        from_attributes = True


# ─── Project ───────────────────────────────────────────────

class ProjectBase(BaseModel):
    client_name: str = Field(..., min_length=2, max_length=150)
    client_phone: Optional[str] = None
    project_name: str = Field(..., min_length=2, max_length=200)
    location: Optional[str] = None
    received_date: date
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    rab_value: Optional[Decimal] = Decimal("0")
    architect_fee: Optional[Decimal] = Decimal("0")
    status: Optional[ProjectStatus] = ProjectStatus.pending
    notes: Optional[str] = None

class ProjectCreate(ProjectBase):
    payments: Optional[List[ProjectPaymentCreate]] = []

class ProjectUpdate(BaseModel):
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    project_name: Optional[str] = None
    location: Optional[str] = None
    received_date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    rab_value: Optional[Decimal] = None
    architect_fee: Optional[Decimal] = None
    status: Optional[ProjectStatus] = None
    notes: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: int
    payments: List[ProjectPaymentResponse] = []
    total_paid:        Optional[Decimal] = Decimal("0")
    total_outstanding: Optional[Decimal] = Decimal("0")
    progress_percent:  Optional[float]   = 0.0

    class Config:
        from_attributes = True

class ProjectSummary(BaseModel):
    id: int
    project_name: str
    client_name: str
    location: Optional[str] = None
    status: ProjectStatus
    rab_value: Decimal
    architect_fee: Decimal
    total_paid: Decimal
    total_outstanding: Decimal
    progress_percent: float
    payments: List[ProjectPaymentResponse] = []   # ← tambah ini

    class Config:
        from_attributes = True