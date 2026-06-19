from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import date, datetime


class PettyCashCreate(BaseModel):
    cash_date:    date
    amount:       Decimal
    given_to:     Optional[str] = None
    given_by:     Optional[str] = None
    bank_account: Optional[str] = None
    notes:        Optional[str] = None


class PettyCashSettle(BaseModel):
    settlement_date: date
    refund_to_bank_account: Optional[str] = None  # bank tujuan refund (untuk ledger income)


class PettyCashResponse(BaseModel):
    id:              int
    sub_project_id:  int
    cash_date:       date
    amount:          Decimal
    given_to:        Optional[str] = None
    given_by:        Optional[str] = None
    bank_account:    Optional[str] = None
    notes:           Optional[str] = None
    status:          str = "open"
    settlement_date: Optional[date] = None
    refund_ledger_entry_id: Optional[int] = None
    created_at:      Optional[datetime] = None

    # computed fields — diisi manual di router, bukan dari kolom DB langsung
    total_used:      Optional[Decimal] = Decimal("0")  # sum PO payments yang pakai kas ini
    remaining:       Optional[Decimal] = Decimal("0")  # amount - total_used

    class Config:
        from_attributes = True
