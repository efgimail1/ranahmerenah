from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date
from decimal import Decimal
from app.database import get_db
from app.models.ledger import LedgerEntry, EntryType
from app.models.project import ProjectPayment, PaymentStatus
from app.schemas.ledger import (
    LedgerIncomeCreate, LedgerExpenseCreate,
    LedgerEntryUpdate, LedgerEntryResponse
)

router = APIRouter(prefix="/ledger", tags=["Ledger"])
QRIS_FEE_RATE = Decimal("0.003")


@router.get("/", response_model=List[LedgerEntryResponse])
def get_entries(
    entry_type:  Optional[str]  = None,
    project_id:  Optional[int]  = None,
    date_from:   Optional[date] = None,
    date_to:     Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(LedgerEntry)
    if entry_type:  query = query.filter(LedgerEntry.entry_type == entry_type)
    if project_id:  query = query.filter(LedgerEntry.project_id == project_id)
    if date_from:   query = query.filter(LedgerEntry.entry_date >= date_from)
    if date_to:     query = query.filter(LedgerEntry.entry_date <= date_to)
    return query.order_by(LedgerEntry.entry_date.desc()).all()


@router.get("/summary")
def get_summary(
    project_id: Optional[int]  = None,
    date_from:  Optional[date] = None,
    date_to:    Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(LedgerEntry)
    if project_id: query = query.filter(LedgerEntry.project_id == project_id)
    if date_from:  query = query.filter(LedgerEntry.entry_date >= date_from)
    if date_to:    query = query.filter(LedgerEntry.entry_date <= date_to)
    entries = query.all()

    total_income   = sum(float(e.net_amount  or 0) for e in entries if e.entry_type == EntryType.income)
    total_expense  = sum(float(e.net_expense or 0) for e in entries if e.entry_type == EntryType.expense)
    total_discount = sum(float(e.discount_received or 0) for e in entries if e.entry_type == EntryType.expense)

    return {
        "total_income":            total_income,
        "total_expense":           total_expense,
        "net_balance":             total_income - total_expense,
        "total_discount_received": total_discount,
    }


@router.post("/income", response_model=LedgerEntryResponse,
             status_code=status.HTTP_201_CREATED)
def create_income(payload: LedgerIncomeCreate, db: Session = Depends(get_db)):
    data  = payload.dict()
    gross = Decimal(str(payload.gross_amount))

    # Hitung net amount
    if payload.is_qris:
        fee = (gross * QRIS_FEE_RATE).quantize(Decimal("0.01"))
        data["qris_fee_rate"]   = QRIS_FEE_RATE
        data["qris_fee_amount"] = fee
        data["net_amount"]      = gross - fee
    else:
        data["qris_fee_amount"] = Decimal("0")
        data["net_amount"]      = gross

    # Simpan entry dulu
    entry = LedgerEntry(**data)
    db.add(entry)
    db.flush()  # dapat ID tanpa commit

    # ── Auto update payment term amount_paid & status ──
    if payload.project_payment_id:
        payment = db.query(ProjectPayment).filter(
            ProjectPayment.id == payload.project_payment_id
        ).first()

        if payment:
            # Hitung total semua pembayaran sebelumnya untuk term ini
            prev_total = db.query(
                func.coalesce(func.sum(LedgerEntry.net_amount), 0)
            ).filter(
                LedgerEntry.project_payment_id == payment.id,
                LedgerEntry.entry_type == EntryType.income,
                LedgerEntry.id != entry.id  # exclude entry yang baru saja dibuat
            ).scalar()

            new_total   = Decimal(str(prev_total)) + data["net_amount"]
            term_amount = Decimal(str(payment.amount or 0))

            # Update amount_paid
            payment.amount_paid = new_total
            payment.paid_date   = payload.entry_date

            # Update status otomatis
            if term_amount > 0:
                if new_total >= term_amount:
                    payment.status = PaymentStatus.paid
                elif new_total > 0:
                    payment.status = PaymentStatus.partial
                else:
                    payment.status = PaymentStatus.unpaid

            db.add(payment)

    db.commit()
    db.refresh(entry)
    return entry


@router.post("/expense", response_model=LedgerEntryResponse,
             status_code=status.HTTP_201_CREATED)
def create_expense(payload: LedgerExpenseCreate, db: Session = Depends(get_db)):
    data     = payload.dict()
    gross    = Decimal(str(payload.gross_expense))
    discount = Decimal(str(payload.discount_received or 0))
    data["net_expense"] = gross - discount
    data["net_amount"]  = data["net_expense"]
    entry = LedgerEntry(**data)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/{entry_id}", response_model=LedgerEntryResponse)
def update_entry(entry_id: int, payload: LedgerEntryUpdate,
                 db: Session = Depends(get_db)):
    entry = db.query(LedgerEntry).filter(LedgerEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    for f, v in payload.dict(exclude_unset=True).items():
        setattr(entry, f, v)
    # Recalculate net
    if entry.entry_type == EntryType.income and entry.gross_amount:
        if entry.is_qris:
            fee = (Decimal(str(entry.gross_amount)) * QRIS_FEE_RATE).quantize(Decimal("0.01"))
            entry.qris_fee_amount = fee
            entry.net_amount = Decimal(str(entry.gross_amount)) - fee
        else:
            entry.net_amount = Decimal(str(entry.gross_amount))
    if entry.entry_type == EntryType.expense and entry.gross_expense:
        disc = Decimal(str(entry.discount_received or 0))
        entry.net_expense = Decimal(str(entry.gross_expense)) - disc
        entry.net_amount  = entry.net_expense
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(LedgerEntry).filter(LedgerEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    payment_id = entry.project_payment_id

    db.delete(entry)
    db.flush()

    # Recalculate amount_paid jika linked ke payment term
    if payment_id:
        payment = db.query(ProjectPayment).filter(
            ProjectPayment.id == payment_id
        ).first()
        if payment:
            new_total = db.query(
                func.coalesce(func.sum(LedgerEntry.net_amount), 0)
            ).filter(
                LedgerEntry.project_payment_id == payment_id,
                LedgerEntry.entry_type == EntryType.income,
            ).scalar()

            new_total   = Decimal(str(new_total))
            term_amount = Decimal(str(payment.amount or 0))
            payment.amount_paid = new_total

            if term_amount > 0:
                if new_total >= term_amount:
                    payment.status = PaymentStatus.paid
                elif new_total > 0:
                    payment.status = PaymentStatus.partial
                else:
                    payment.status = PaymentStatus.unpaid
                    payment.paid_date = None

            db.add(payment)

    db.commit()