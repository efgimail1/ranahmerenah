from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from decimal import Decimal

from app.database import get_db
from app.models.sub_project import SubProject, SubProjectBilling
from app.schemas.sub_project import (
    SubProjectCreate, SubProjectUpdate, SubProjectResponse,
    SubProjectBillingCreate, SubProjectBillingResponse,
    SubProjectSummary,
)

router = APIRouter(prefix="/sub-projects", tags=["Sub Projects"])


def calc_summary(sp: SubProject, db: Session) -> SubProjectSummary:
    rab = float(sp.rab_value or 0)

    # Total billings
    total_billings = sum(float(b.amount or 0) for b in sp.billings)

    # Total workers
    try:
        from app.models.worker import WagePayment
        if hasattr(WagePayment, "sub_project_id"):
            wage_result = db.query(
                func.coalesce(func.sum(WagePayment.net_amount), 0)
            ).filter(WagePayment.sub_project_id == sp.id).scalar()
        else:
            wage_result = 0
        total_workers = float(wage_result or 0)
    except Exception:
        total_workers = 0.0

    # Total PO
    try:
        from app.models.material import PurchaseOrder
        if hasattr(PurchaseOrder, "sub_project_id"):
            po_result = db.query(
                func.coalesce(func.sum(PurchaseOrder.total_amount), 0)
            ).filter(
                PurchaseOrder.sub_project_id == sp.id,
                PurchaseOrder.status.in_(["received", "confirmed", "partial"])
            ).scalar()
        else:
            po_result = 0
        total_po = float(po_result or 0)
    except Exception:
        total_po = 0.0

    total_spent      = total_workers + total_po
    remaining_budget = rab - total_spent
    outstanding      = rab - total_billings
    cash_available   = total_billings - total_spent

    return SubProjectSummary(
        total_billings   = round(total_billings, 2),
        total_workers    = round(total_workers, 2),
        total_po         = round(total_po, 2),
        total_spent      = round(total_spent, 2),
        remaining_budget = round(remaining_budget, 2),
        outstanding      = round(outstanding, 2),
        cash_available   = round(cash_available, 2),
    )


def sp_to_response(sp: SubProject, db: Session) -> SubProjectResponse:
    """Convert SubProject ORM to response with summary"""
    data = SubProjectResponse(
        id          = sp.id,
        project_id  = sp.project_id,
        name        = sp.name,
        description = sp.description,
        rab_value   = sp.rab_value or Decimal("0"),
        status      = sp.status or "active",
        sort_order  = sp.sort_order or 0,
        start_date  = sp.start_date,
        end_date    = sp.end_date,
        created_at  = sp.created_at,
        billings    = [
            SubProjectBillingResponse(
                id             = b.id,
                sub_project_id = b.sub_project_id,
                billing_date   = b.billing_date,
                amount         = b.amount,
                received_from  = b.received_from,
                bank_account   = b.bank_account,
                payment_method = b.payment_method,
                notes          = b.notes,
                created_at     = b.created_at,
            )
            for b in sp.billings
        ],
    )
    data.summary = calc_summary(sp, db)
    return data


# ── Sub Projects CRUD ──────────────────────────────────────────

@router.get("/project/{project_id}", response_model=List[SubProjectResponse])
def get_sub_projects(project_id: int, db: Session = Depends(get_db)):
    sps = db.query(SubProject).options(
        joinedload(SubProject.billings)
    ).filter(
        SubProject.project_id == project_id
    ).order_by(SubProject.sort_order, SubProject.id).all()
    return [sp_to_response(sp, db) for sp in sps]


@router.get("/{sp_id}", response_model=SubProjectResponse)
def get_sub_project(sp_id: int, db: Session = Depends(get_db)):
    sp = db.query(SubProject).options(
        joinedload(SubProject.billings)
    ).filter(SubProject.id == sp_id).first()
    if not sp:
        raise HTTPException(status_code=404, detail="Sub project not found")
    return sp_to_response(sp, db)


@router.post("/", response_model=SubProjectResponse,
             status_code=status.HTTP_201_CREATED)
def create_sub_project(payload: SubProjectCreate, db: Session = Depends(get_db)):
    sp = SubProject(**payload.dict())
    db.add(sp)
    db.commit()
    sp = db.query(SubProject).options(
        joinedload(SubProject.billings)
    ).filter(SubProject.id == sp.id).first()
    return sp_to_response(sp, db)


@router.put("/{sp_id}", response_model=SubProjectResponse)
def update_sub_project(sp_id: int, payload: SubProjectUpdate,
                       db: Session = Depends(get_db)):
    sp = db.query(SubProject).filter(SubProject.id == sp_id).first()
    if not sp:
        raise HTTPException(status_code=404, detail="Sub project not found")
    for f, v in payload.dict(exclude_unset=True).items():
        setattr(sp, f, v)
    db.commit()
    sp = db.query(SubProject).options(
        joinedload(SubProject.billings)
    ).filter(SubProject.id == sp_id).first()
    return sp_to_response(sp, db)


@router.delete("/{sp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sub_project(sp_id: int, db: Session = Depends(get_db)):
    sp = db.query(SubProject).filter(SubProject.id == sp_id).first()
    if not sp:
        raise HTTPException(status_code=404, detail="Sub project not found")
    try:
        from app.models.worker import WagePayment
        if hasattr(WagePayment, "sub_project_id"):
            wage_count = db.query(WagePayment).filter(
                WagePayment.sub_project_id == sp_id
            ).count()
            if wage_count > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Tidak bisa hapus — ada {wage_count} pembayaran upah"
                )
    except HTTPException:
        raise
    except Exception:
        pass
    db.delete(sp)
    db.commit()


# ── Billings ───────────────────────────────────────────────────

@router.get("/{sp_id}/billings",
            response_model=List[SubProjectBillingResponse])
def get_billings(sp_id: int, db: Session = Depends(get_db)):
    return db.query(SubProjectBilling).filter(
        SubProjectBilling.sub_project_id == sp_id
    ).order_by(SubProjectBilling.billing_date.desc()).all()


@router.post("/{sp_id}/billings",
             response_model=SubProjectBillingResponse,
             status_code=status.HTTP_201_CREATED)
def create_billing(sp_id: int, payload: SubProjectBillingCreate,
                   db: Session = Depends(get_db)):
    sp = db.query(SubProject).filter(SubProject.id == sp_id).first()
    if not sp:
        raise HTTPException(status_code=404, detail="Sub project not found")
    billing = SubProjectBilling(sub_project_id=sp_id, **payload.dict())
    db.add(billing)
    db.commit()
    db.refresh(billing)
    return billing


@router.delete("/{sp_id}/billings/{billing_id}",
               status_code=status.HTTP_204_NO_CONTENT)
def delete_billing(sp_id: int, billing_id: int,
                   db: Session = Depends(get_db)):
    billing = db.query(SubProjectBilling).filter(
        SubProjectBilling.id == billing_id,
        SubProjectBilling.sub_project_id == sp_id,
    ).first()
    if not billing:
        raise HTTPException(status_code=404, detail="Billing not found")
    db.delete(billing)
    db.commit()