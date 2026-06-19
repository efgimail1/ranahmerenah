from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from decimal import Decimal

from app.database import get_db
from app.models.sub_project import SubProject
from app.models.petty_cash import PettyCash
from app.models.material import POPayment
from app.models.ledger import LedgerEntry, EntryType, PaymentMethod
from app.schemas.petty_cash import (
    PettyCashCreate,
    PettyCashResponse,
    PettyCashSettle,
)

router = APIRouter(prefix="/sub-projects", tags=["Petty Cash"])


def pc_to_response(pc: PettyCash, db: Session) -> PettyCashResponse:
    total_used = (
        db.query(func.coalesce(func.sum(POPayment.amount), 0))
        .filter(POPayment.petty_cash_id == pc.id)
        .scalar()
    )
    total_used = Decimal(str(total_used or 0))
    remaining = Decimal(str(pc.amount or 0)) - total_used

    data = PettyCashResponse.model_validate(pc)
    data.total_used = total_used
    data.remaining = remaining
    return data


@router.get("/{sp_id}/petty-cash", response_model=List[PettyCashResponse])
def get_petty_cash(
    sp_id: int,
    pc_status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(PettyCash).filter(PettyCash.sub_project_id == sp_id)
    if pc_status:
        q = q.filter(PettyCash.status == pc_status)
    records = q.order_by(PettyCash.cash_date.desc()).all()
    return [pc_to_response(r, db) for r in records]


@router.post(
    "/{sp_id}/petty-cash",
    response_model=PettyCashResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_petty_cash(
    sp_id: int, payload: PettyCashCreate, db: Session = Depends(get_db)
):
    sp = db.query(SubProject).filter(SubProject.id == sp_id).first()
    if not sp:
        raise HTTPException(status_code=404, detail="Sub project not found")

    pc = PettyCash(sub_project_id=sp_id, **payload.dict())
    db.add(pc)
    db.commit()
    db.refresh(pc)
    return pc_to_response(pc, db)


@router.delete("/{sp_id}/petty-cash/{pc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_petty_cash(sp_id: int, pc_id: int, db: Session = Depends(get_db)):
    pc = (
        db.query(PettyCash)
        .filter(PettyCash.id == pc_id, PettyCash.sub_project_id == sp_id)
        .first()
    )
    if not pc:
        raise HTTPException(status_code=404, detail="Petty cash not found")

    used_count = (
        db.query(POPayment).filter(POPayment.petty_cash_id == pc_id).count()
    )
    if used_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Tidak bisa hapus — kas ini sudah dipakai untuk {used_count} pembayaran PO",
        )
    db.delete(pc)
    db.commit()


@router.post("/{sp_id}/petty-cash/{pc_id}/settle", response_model=PettyCashResponse)
def settle_petty_cash(
    sp_id: int,
    pc_id: int,
    payload: PettyCashSettle,
    db: Session = Depends(get_db),
):
    pc = (
        db.query(PettyCash)
        .filter(PettyCash.id == pc_id, PettyCash.sub_project_id == sp_id)
        .first()
    )
    if not pc:
        raise HTTPException(status_code=404, detail="Petty cash not found")
    if pc.status == "settled":
        raise HTTPException(status_code=400, detail="Kas ini sudah di-settle")

    total_used = (
        db.query(func.coalesce(func.sum(POPayment.amount), 0))
        .filter(POPayment.petty_cash_id == pc.id)
        .scalar()
    )
    total_used = Decimal(str(total_used or 0))
    remaining = Decimal(str(pc.amount or 0)) - total_used

    sp = db.query(SubProject).filter(SubProject.id == sp_id).first()

    # Kalau ada sisa yang belum terpakai, refund ke ledger sebagai income
    if remaining > 0:
        refund_entry = LedgerEntry(
            entry_date=payload.settlement_date,
            entry_type=EntryType.income,
            description=f"Refund Kas Tukang · {sp.name if sp else ''}",
            received_from=pc.given_to or "",
            gross_amount=remaining,
            net_amount=remaining,
            payment_method=PaymentMethod.cash,
            bank_account=payload.refund_to_bank_account or pc.bank_account,
            project_id=sp.project_id if sp else None,
            sub_project_id=sp_id,
            source="petty_cash_refund",
            notes=f"Sisa kas tukang dari pencairan {pc.cash_date}",
        )
        db.add(refund_entry)
        db.commit()
        db.refresh(refund_entry)
        pc.refund_ledger_entry_id = refund_entry.id

    pc.status = "settled"
    pc.settlement_date = payload.settlement_date
    db.commit()
    db.refresh(pc)
    return pc_to_response(pc, db)
