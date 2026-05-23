from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from decimal import Decimal

class TimesheetCreate(BaseModel):
    assignment_id:   int
    worker_id:       int
    project_id:      int
    work_date:       date
    hours_worked:    Optional[Decimal] = None
    units_completed: Optional[Decimal] = None
    notes:           Optional[str]     = None

class TimesheetResponse(TimesheetCreate):
    id: int
    class Config:
        from_attributes = True

class TimesheetBulkCreate(BaseModel):
    """Untuk input beberapa hari sekaligus"""
    assignment_id: int
    worker_id:     int
    project_id:    int
    work_dates:    List[date]          # bisa pilih beberapa tanggal
    hours_per_day: Optional[Decimal]  = Decimal("8")
    notes:         Optional[str]      = None