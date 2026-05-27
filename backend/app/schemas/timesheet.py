from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal

class TimesheetCreate(BaseModel):
    assignment_id:  int
    worker_id:      int
    project_id:     int
    work_date:      date
    regular_hours:  Optional[Decimal] = Decimal("8")
    overtime_hours: Optional[Decimal] = Decimal("0")
    overtime_rate:  Optional[Decimal] = Decimal("1.5")
    notes:          Optional[str]     = None

class TimesheetUpdate(BaseModel):
    regular_hours:  Optional[Decimal] = None
    overtime_hours: Optional[Decimal] = None
    overtime_rate:  Optional[Decimal] = None
    notes:          Optional[str]     = None

class TimesheetResponse(TimesheetCreate):
    id:              int
    is_paid:         bool
    wage_payment_id: Optional[int] = None
    created_at:      Optional[datetime] = None

    class Config:
        from_attributes = True