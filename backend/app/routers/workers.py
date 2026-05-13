from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.worker import Worker, WagePayment
from app.schemas.worker import (
    WorkerCreate, WorkerUpdate, WorkerResponse,
    WagePaymentCreate, WagePaymentResponse
)

router = APIRouter(prefix="/workers", tags=["Workers"])


@router.get("/", response_model=List[WorkerResponse])
def get_all_workers(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Worker)
    if is_active is not None:
        query = query.filter(Worker.is_active == is_active)
    return query.order_by(Worker.full_name).all()


@router.post("/", response_model=WorkerResponse, status_code=status.HTTP_201_CREATED)
def create_worker(payload: WorkerCreate, db: Session = Depends(get_db)):
    worker = Worker(**payload.dict())
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return worker


@router.get("/{worker_id}", response_model=WorkerResponse)
def get_worker(worker_id: int, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    return worker


@router.put("/{worker_id}", response_model=WorkerResponse)
def update_worker(
    worker_id: int,
    payload: WorkerUpdate,
    db: Session = Depends(get_db)
):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(worker, field, value)

    db.commit()
    db.refresh(worker)
    return worker


@router.delete("/{worker_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_worker(worker_id: int, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    db.delete(worker)
    db.commit()


# ─── Wage Payments ─────────────────────────────────────────

@router.get("/{worker_id}/wages", response_model=List[WagePaymentResponse])
def get_worker_wages(worker_id: int, db: Session = Depends(get_db)):
    return db.query(WagePayment).filter(
        WagePayment.worker_id == worker_id
    ).order_by(WagePayment.payment_date.desc()).all()


@router.post("/wages", response_model=WagePaymentResponse,
             status_code=status.HTTP_201_CREATED)
def create_wage_payment(payload: WagePaymentCreate, db: Session = Depends(get_db)):
    wage = WagePayment(**payload.dict())
    db.add(wage)
    db.commit()
    db.refresh(wage)
    return wage