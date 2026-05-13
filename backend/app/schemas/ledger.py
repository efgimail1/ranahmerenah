from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from decimal import Decimal
from app.models.ledger import EntryType, PaymentMethod


class LedgerEntryBase(BaseModel):
    entry_date: date
    entry_type: EntryType
    description: str = Field(..., min_length=1, max_length=255)
    payment_method: Optional[PaymentMethod] = None
    notes: Optional[str] = None

class LedgerIncomeCreate(LedgerEntryBase):
    entry_type: EntryType = EntryType.income
    received_from: str
    gross_amount: Decimal
    is_qris: Optional[bool] = False
    project_payment_id: Optional[int] = None

class LedgerExpenseCreate(LedgerEntryBase):
    entry_type: EntryType = EntryType.expense
    paid_to: Optional[str] = None
    gross_expense: Decimal
    discount_received: Optional[Decimal] = Decimal("0")
    material_id: Optional[int] = None
    wage_payment_id: Optional[int] = None

class LedgerEntryResponse(LedgerEntryBase):
    id: int
    received_from: Optional[str] = None
    gross_amount: Optional[Decimal] = None
    is_qris: Optional[bool] = None
    qris_fee_amount: Optional[Decimal] = None
    net_amount: Optional[Decimal] = None
    paid_to: Optional[str] = None
    gross_expense: Optional[Decimal] = None
    discount_received: Optional[Decimal] = None
    net_expense: Optional[Decimal] = None
    project_payment_id: Optional[int] = None
    material_id: Optional[int] = None
    wage_payment_id: Optional[int] = None

    class Config:
        from_attributes = True