from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.database import get_db
from app.models.worker import Worker, WorkerAssignment, WagePayment
from app.schemas.worker import (
    WorkerCreate, WorkerUpdate, WorkerResponse,
    WorkerAssignmentCreate, WorkerAssignmentUpdate, WorkerAssignmentResponse,
    WagePaymentCreate, WagePaymentResponse
)

router = APIRouter(prefix="/workers", tags=["Workers"])


@router.get("/", response_model=List[WorkerResponse])
def get_all_workers(is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    query = db.query(Worker).options(joinedload(Worker.assignments))
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
    worker = db.query(Worker).options(
        joinedload(Worker.assignments)
    ).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    return worker


@router.put("/{worker_id}", response_model=WorkerResponse)
def update_worker(worker_id: int, payload: WorkerUpdate, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    for f, v in payload.dict(exclude_unset=True).items():
        setattr(worker, f, v)
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


# ─── Assignments ───────────────────────────────────────────

@router.get("/{worker_id}/assignments", response_model=List[WorkerAssignmentResponse])
def get_worker_assignments(worker_id: int, db: Session = Depends(get_db)):
    return db.query(WorkerAssignment).filter(
        WorkerAssignment.worker_id == worker_id
    ).all()


@router.post("/assignments", response_model=WorkerAssignmentResponse,
             status_code=status.HTTP_201_CREATED)
def create_assignment(payload: WorkerAssignmentCreate, db: Session = Depends(get_db)):
    assignment = WorkerAssignment(**payload.dict())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.put("/assignments/{assignment_id}", response_model=WorkerAssignmentResponse)
def update_assignment(assignment_id: int, payload: WorkerAssignmentUpdate,
                      db: Session = Depends(get_db)):
    assignment = db.query(WorkerAssignment).filter(
        WorkerAssignment.id == assignment_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    for f, v in payload.dict(exclude_unset=True).items():
        setattr(assignment, f, v)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    assignment = db.query(WorkerAssignment).filter(
        WorkerAssignment.id == assignment_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(assignment)
    db.commit()


# ─── Wages ─────────────────────────────────────────────────

@router.get("/{worker_id}/wages", response_model=List[WagePaymentResponse])
def get_worker_wages(worker_id: int, db: Session = Depends(get_db)):
    return db.query(WagePayment).filter(
        WagePayment.worker_id == worker_id
    ).order_by(WagePayment.payment_date.desc()).all()


@router.get("/wages/all", response_model=List[WagePaymentResponse])
def get_all_wages(project_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(WagePayment)
    if project_id:
        query = query.filter(WagePayment.project_id == project_id)
    return query.order_by(WagePayment.payment_date.desc()).all()


@router.post("/wages", response_model=WagePaymentResponse,
             status_code=status.HTTP_201_CREATED)
def create_wage_payment(payload: WagePaymentCreate, db: Session = Depends(get_db)):
    wage = WagePayment(**payload.dict())
    db.add(wage)
    db.commit()
    db.refresh(wage)
    return wage