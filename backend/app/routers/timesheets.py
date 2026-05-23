from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta
from app.database import get_db
from app.models.timesheet import Timesheet
from app.schemas.timesheet import TimesheetCreate, TimesheetResponse, TimesheetBulkCreate

router = APIRouter(prefix="/timesheets", tags=["Timesheets"])


@router.get("/", response_model=List[TimesheetResponse])
def get_timesheets(
    worker_id:  Optional[int]  = None,
    project_id: Optional[int]  = None,
    date_from:  Optional[date] = None,
    date_to:    Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Timesheet)
    if worker_id:  query = query.filter(Timesheet.worker_id  == worker_id)
    if project_id: query = query.filter(Timesheet.project_id == project_id)
    if date_from:  query = query.filter(Timesheet.work_date  >= date_from)
    if date_to:    query = query.filter(Timesheet.work_date  <= date_to)
    return query.order_by(Timesheet.work_date.desc()).all()


@router.post("/", response_model=TimesheetResponse, status_code=201)
def create_timesheet(payload: TimesheetCreate, db: Session = Depends(get_db)):
    # Cek duplikat tanggal + worker
    existing = db.query(Timesheet).filter(
        Timesheet.worker_id  == payload.worker_id,
        Timesheet.project_id == payload.project_id,
        Timesheet.work_date  == payload.work_date,
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Timesheet already exists for this worker on {payload.work_date}"
        )
    ts = Timesheet(**payload.dict())
    db.add(ts)
    db.commit()
    db.refresh(ts)
    return ts


@router.post("/bulk", response_model=List[TimesheetResponse], status_code=201)
def create_bulk_timesheets(payload: TimesheetBulkCreate, db: Session = Depends(get_db)):
    """Input beberapa hari kerja sekaligus — untuk tipe bayar harian bebas"""
    created = []
    for work_date in payload.work_dates:
        # Skip jika sudah ada
        existing = db.query(Timesheet).filter(
            Timesheet.worker_id  == payload.worker_id,
            Timesheet.project_id == payload.project_id,
            Timesheet.work_date  == work_date,
        ).first()
        if existing:
            continue

        ts = Timesheet(
            assignment_id = payload.assignment_id,
            worker_id     = payload.worker_id,
            project_id    = payload.project_id,
            work_date     = work_date,
            hours_worked  = payload.hours_per_day,
            notes         = payload.notes,
        )
        db.add(ts)
        created.append(ts)

    db.commit()
    for ts in created:
        db.refresh(ts)
    return created


@router.delete("/{ts_id}", status_code=204)
def delete_timesheet(ts_id: int, db: Session = Depends(get_db)):
    ts = db.query(Timesheet).filter(Timesheet.id == ts_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    db.delete(ts)
    db.commit()