from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import date, datetime


class SubProjectBillingCreate(BaseModel):
    billing_date:   date
    amount:         Decimal                  # gross transfer dari owner
    qris_fee:       Optional[Decimal] = Decimal("0")
    net_amount:     Optional[Decimal] = None # otomatis diisi backend
    received_from:  Optional[str] = None
    bank_account:   Optional[str] = None
    payment_method: Optional[str] = "transfer"
    notes:          Optional[str] = None


class SubProjectBillingResponse(BaseModel):
    id:             int
    sub_project_id: int
    billing_date:   date
    amount:         Decimal
    qris_fee:       Optional[Decimal]  = Decimal("0")
    net_amount:     Optional[Decimal]  = None
    received_from:  Optional[str]      = None
    bank_account:   Optional[str]      = None
    payment_method: Optional[str]      = None
    notes:          Optional[str]      = None
    created_at:     Optional[datetime] = None

    class Config:
        from_attributes = True


class SubProjectCreate(BaseModel):
    project_id:  int
    name:        str
    description: Optional[str]    = None
    rab_value:   Optional[Decimal] = Decimal("0")
    status:      Optional[str]     = "active"
    sort_order:  Optional[int]     = 0
    start_date:  Optional[date]    = None
    end_date:    Optional[date]    = None


class SubProjectUpdate(BaseModel):
    name:        Optional[str]     = None
    description: Optional[str]     = None
    rab_value:   Optional[Decimal] = None
    status:      Optional[str]     = None
    sort_order:  Optional[int]     = None
    start_date:  Optional[date]    = None
    end_date:    Optional[date]    = None


class SubProjectSummary(BaseModel):
    total_billings:   float = 0
    total_workers:    float = 0
    total_po:         float = 0
    total_spent:      float = 0
    remaining_budget: float = 0
    outstanding:      float = 0
    cash_available:   float = 0


class SubProjectResponse(SubProjectCreate):
    id:         int
    created_at: Optional[datetime] = None
    billings:   List[SubProjectBillingResponse] = []
    summary:    Optional[SubProjectSummary]     = None

    class Config:
        from_attributes = True
        

class KasbonCreate(BaseModel):
    week_start: date
    week_end:   date
    amount:     Decimal
    notes:      Optional[str] = None

class KasbonResponse(BaseModel):
    id:             int
    sub_project_id: int
    week_start:     date
    week_end:       date
    amount:         Decimal
    notes:          Optional[str] = None
    created_at:     Optional[datetime] = None
    class Config:
        from_attributes = True

class ContractorKasbonCreate(BaseModel):
    kasbon_date: date
    amount:      Decimal
    notes:       Optional[str] = None

class ContractorKasbonResponse(BaseModel):
    id:             int
    sub_project_id: int
    kasbon_date:    date
    amount:         Decimal
    notes:          Optional[str] = None
    created_at:     Optional[datetime] = None
    class Config:
        from_attributes = True
        
class WorkerKasbonCreate(BaseModel):
    kasbon_date:    date
    amount:         Decimal
    transferred_by: Optional[str] = None
    transferred_to: Optional[str] = None
    bank_account:   Optional[str] = None
    notes:          Optional[str] = None

class WorkerKasbonUpdate(BaseModel):
    status:      Optional[str] = None
    payroll_ref: Optional[str] = None

class WorkerKasbonResponse(BaseModel):
    id:             int
    sub_project_id: int
    kasbon_date:    date
    amount:         Decimal
    transferred_by: Optional[str] = None
    transferred_to: Optional[str] = None
    bank_account:   Optional[str] = None
    notes:          Optional[str] = None
    status:         Optional[str] = "pending"
    payroll_ref:    Optional[str] = None
    created_at:     Optional[datetime] = None

    class Config:
        from_attributes = True        