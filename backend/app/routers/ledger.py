from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from decimal import Decimal
from app.database import get_db
from app.models.ledger import LedgerEntry, EntryType
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

    total_income  = sum(float(e.net_amount  or 0) for e in entries if e.entry_type == EntryType.income)
    total_expense = sum(float(e.net_expense or 0) for e in entries if e.entry_type == EntryType.expense)
    total_discount= sum(float(e.discount_received or 0) for e in entries if e.entry_type == EntryType.expense)

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
    gross = payload.gross_amount
    if payload.is_qris:
        fee = (gross * QRIS_FEE_RATE).quantize(Decimal("0.01"))
        data["qris_fee_rate"]   = QRIS_FEE_RATE
        data["qris_fee_amount"] = fee
        data["net_amount"]      = gross - fee
    else:
        data["qris_fee_amount"] = Decimal("0")
        data["net_amount"]      = gross
    entry = LedgerEntry(**data)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/expense", response_model=LedgerEntryResponse,
             status_code=status.HTTP_201_CREATED)
def create_expense(payload: LedgerExpenseCreate, db: Session = Depends(get_db)):
    data     = payload.dict()
    gross    = payload.gross_expense
    discount = payload.discount_received or Decimal("0")
    data["net_expense"] = gross - discount
    data["net_amount"]  = data["net_expense"]
    entry = LedgerEntry(**data)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/{entry_id}", response_model=LedgerEntryResponse)
def update_entry(entry_id: int, payload: LedgerEntryUpdate, db: Session = Depends(get_db)):
    entry = db.query(LedgerEntry).filter(LedgerEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    for f, v in payload.dict(exclude_unset=True).items():
        setattr(entry, f, v)
    # recalculate net jika gross berubah
    if entry.entry_type == EntryType.income and entry.gross_amount:
        if entry.is_qris:
            fee = (entry.gross_amount * QRIS_FEE_RATE).quantize(Decimal("0.01"))
            entry.qris_fee_amount = fee
            entry.net_amount = entry.gross_amount - fee
        else:
            entry.net_amount = entry.gross_amount
    if entry.entry_type == EntryType.expense and entry.gross_expense:
        disc = entry.discount_received or Decimal("0")
        entry.net_expense = entry.gross_expense - disc
        entry.net_amount  = entry.net_expense
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(LedgerEntry).filter(LedgerEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()