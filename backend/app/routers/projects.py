from sqlalchemy.orm import Session, joinedload
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import func
from typing import List, Optional
from app.database import get_db
from app.models.project import Project, ProjectPayment, PaymentStatus
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectSummary, ProjectPaymentCreate,
    ProjectPaymentUpdate, ProjectPaymentResponse
)

router = APIRouter(prefix="/projects", tags=["Projects"])


# ─── Projects ──────────────────────────────────────────────

@router.get("/", response_model=List[ProjectSummary])
def get_all_projects(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Project).options(joinedload(Project.payments))
    if status:
        query = query.filter(Project.status == status)
    projects = query.order_by(Project.received_date.desc()).all()

    result = []
    for p in projects:
        architect_fee = float(p.architect_fee or 0)

        # total_paid = sum amount_paid dari semua terms (actual yang sudah masuk)
        total_paid = sum(
            float(pay.amount_paid or 0)
            for pay in p.payments
        )

        total_outstanding = max(architect_fee - total_paid, 0)

        # progress = persentase terkumpul dari total architect fee
        progress = (total_paid / architect_fee * 100) if architect_fee > 0 else 0

        result.append(ProjectSummary(
            id=p.id,
            project_name=p.project_name,
            client_name=p.client_name,
            location=p.location,
            status=p.status,
            rab_value=p.rab_value or 0,
            architect_fee=architect_fee,
            total_paid=total_paid,
            total_outstanding=total_outstanding,
            progress_percent=round(min(progress, 100), 1),
            payments=p.payments,
        ))
    return result


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(
        client_name=payload.client_name,
        client_phone=payload.client_phone,
        project_name=payload.project_name,
        location=payload.location,
        received_date=payload.received_date,
        start_date=payload.start_date,
        end_date=payload.end_date,
        rab_value=payload.rab_value,
        architect_fee=payload.architect_fee,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(project)
    db.flush()  # dapat ID sebelum commit

    for p in payload.payments:
        payment = ProjectPayment(project_id=project.id, **p.dict())
        db.add(payment)

    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).options(
        joinedload(Project.payments)
    ).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    architect_fee = float(project.architect_fee or 0)
    total_paid    = sum(float(pay.amount_paid or 0) for pay in project.payments)
    outstanding   = max(architect_fee - total_paid, 0)
    progress      = min((total_paid / architect_fee * 100), 100) if architect_fee > 0 else 0

    # Build response manually
    result = {
        "id":                project.id,
        "client_name":       project.client_name,
        "client_phone":      project.client_phone,
        "project_name":      project.project_name,
        "location":          project.location,
        "received_date":     project.received_date,
        "start_date":        project.start_date,
        "end_date":          project.end_date,
        "rab_value":         project.rab_value,
        "architect_fee":     project.architect_fee,
        "status":            project.status,
        "notes":             project.notes,
        "total_paid":        total_paid,
        "total_outstanding": outstanding,
        "progress_percent":  round(progress, 1),
        "payments": [
            {
                "id":          p.id,
                "project_id":  p.project_id,
                "term_type":   p.term_type,
                "term_label":  p.term_label,
                "percentage":  p.percentage,
                "amount":      p.amount,
                "due_date":    p.due_date,
                "paid_date":   p.paid_date,
                "amount_paid": p.amount_paid,
                "status":      p.status,
                "notes":       p.notes,
            }
            for p in project.payments
        ]
    }
    return result


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()


# ─── Payments ──────────────────────────────────────────────

@router.get("/{project_id}/payments", response_model=List[ProjectPaymentResponse])
def get_payments(project_id: int, db: Session = Depends(get_db)):
    return db.query(ProjectPayment).filter(
        ProjectPayment.project_id == project_id
    ).all()


@router.post("/{project_id}/payments", response_model=ProjectPaymentResponse,
             status_code=status.HTTP_201_CREATED)
def add_payment(
    project_id: int,
    payload: ProjectPaymentCreate,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    payment = ProjectPayment(project_id=project_id, **payload.dict())
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@router.put("/payments/{payment_id}", response_model=ProjectPaymentResponse)
def update_payment(
    payment_id: int,
    payload: ProjectPaymentUpdate,
    db: Session = Depends(get_db)
):
    payment = db.query(ProjectPayment).filter(ProjectPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(payment, field, value)

    db.commit()
    db.refresh(payment)
    return payment

@router.delete("/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(ProjectPayment).filter(ProjectPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(payment)
    db.commit()