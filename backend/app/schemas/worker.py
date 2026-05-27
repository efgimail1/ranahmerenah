from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date
from decimal import Decimal
from app.models.worker import WorkerRole, RateType


class WorkerBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    phone:     Optional[str] = None
    role:      WorkerRole
    rate_type: Optional[RateType] = RateType.daily
    rate_amount: Optional[Decimal] = Decimal('0')
    is_active: Optional[bool] = True
    notes:     Optional[str] = None

class WorkerCreate(WorkerBase):
    pass

class WorkerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone:     Optional[str] = None
    role:      Optional[WorkerRole] = None
    rate_type: Optional[RateType] = None
    rate_amount: Optional[Decimal] = None
    is_active: Optional[bool] = None
    notes:     Optional[str] = None

class WorkerAssignmentBase(BaseModel):
    worker_id:   int
    project_id:  int
    rate_type:   RateType = RateType.daily
    rate_amount: Decimal
    start_date:  Optional[date] = None
    end_date:    Optional[date] = None
    is_active:   Optional[bool] = True
    notes:       Optional[str] = None

class WorkerAssignmentCreate(WorkerAssignmentBase):
    pass

class WorkerAssignmentUpdate(BaseModel):
    rate_type:   Optional[RateType] = None
    rate_amount: Optional[Decimal] = None
    start_date:  Optional[date] = None
    end_date:    Optional[date] = None
    is_active:   Optional[bool] = None
    notes:       Optional[str] = None

class WorkerAssignmentResponse(WorkerAssignmentBase):
    id: int
    class Config:
        from_attributes = True

class WorkerResponse(WorkerBase):
    id: int
    assignments: List[WorkerAssignmentResponse] = []
    class Config:
        from_attributes = True


class WagePaymentBase(BaseModel):
    assignment_id: Optional[int] = None
    worker_id:     int
    project_id:    Optional[int] = None
    payment_date:  date
    period_start:  Optional[date] = None
    period_end:    Optional[date] = None
    days_worked:   Optional[Decimal] = None
    unit_count:    Optional[Decimal] = None
    rate_snapshot: Decimal
    gross_amount:  Decimal
    deduction:     Optional[Decimal] = Decimal("0")
    net_amount:    Decimal
    notes:         Optional[str] = None

class WagePaymentCreate(WagePaymentBase):
    pass

class WagePaymentResponse(WagePaymentBase):
    id: int
    class Config:
        from_attributes = True