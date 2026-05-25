from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.database import get_db
from pydantic import BaseModel
from app.models.timesheet import Timesheet
from app.schemas.timesheet import TimesheetCreate, TimesheetUpdate, TimesheetResponse

router = APIRouter(prefix="/timesheets", tags=["Timesheets"])


@router.get("/", response_model=List[TimesheetResponse])
def get_timesheets(
    worker_id:  Optional[int]  = None,
    project_id: Optional[int]  = None,
    assignment_id: Optional[int] = None,
    is_paid:    Optional[bool] = None,
    date_from:  Optional[date] = None,
    date_to:    Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Timesheet)
    if worker_id:     query = query.filter(Timesheet.worker_id     == worker_id)
    if project_id:    query = query.filter(Timesheet.project_id    == project_id)
    if assignment_id: query = query.filter(Timesheet.assignment_id == assignment_id)
    if is_paid is not None: query = query.filter(Timesheet.is_paid == is_paid)
    if date_from:     query = query.filter(Timesheet.work_date     >= date_from)
    if date_to:       query = query.filter(Timesheet.work_date     <= date_to)
    return query.order_by(Timesheet.work_date.asc()).all()


@router.post("/", response_model=TimesheetResponse, status_code=201)
def create_timesheet(payload: TimesheetCreate, db: Session = Depends(get_db)):
    # Cek duplikat
    existing = db.query(Timesheet).filter(
        Timesheet.worker_id  == payload.worker_id,
        Timesheet.project_id == payload.project_id,
        Timesheet.work_date  == payload.work_date,
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Timesheet sudah ada untuk tanggal {payload.work_date}"
        )
    ts = Timesheet(**payload.dict())
    db.add(ts)
    db.commit()
    db.refresh(ts)
    return ts


@router.put("/{ts_id}", response_model=TimesheetResponse)
def update_timesheet(ts_id: int, payload: TimesheetUpdate, db: Session = Depends(get_db)):
    ts = db.query(Timesheet).filter(Timesheet.id == ts_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    if ts.is_paid:
        raise HTTPException(status_code=400, detail="Cannot edit paid timesheet")
    for f, v in payload.dict(exclude_unset=True).items():
        setattr(ts, f, v)
    db.commit()
    db.refresh(ts)
    return ts


@router.delete("/{ts_id}", status_code=204)
def delete_timesheet(ts_id: int, db: Session = Depends(get_db)):
    ts = db.query(Timesheet).filter(Timesheet.id == ts_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    if ts.is_paid:
        raise HTTPException(status_code=400, detail="Cannot delete paid timesheet")
    db.delete(ts)
    db.commit()


class MarkPaidRequest(BaseModel):
    timesheet_ids:  List[int]
    wage_payment_id: int

@router.post("/mark-paid", status_code=200)
def mark_timesheets_paid(
    payload: MarkPaidRequest,
    db: Session = Depends(get_db)
):
    db.query(Timesheet).filter(
        Timesheet.id.in_(payload.timesheet_ids)
    ).update(
        {"is_paid": True, "wage_payment_id": payload.wage_payment_id},
        synchronize_session=False
    )
    db.commit()
    return {"updated": len(payload.timesheet_ids)}