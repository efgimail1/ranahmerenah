from sqlalchemy import Column, Integer, String, Numeric, Text, Date, ForeignKey, Enum, Boolean, Index
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class EntryType(str, enum.Enum):
    income = "income"
    expense = "expense"

class PaymentMethod(str, enum.Enum):
    cash = "cash"
    transfer = "transfer"
    qris = "qris"
    other = "other"

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    entry_date = Column(Date, nullable=False)
    entry_type = Column(Enum(EntryType), nullable=False)
    description = Column(String(255), nullable=False)
    bank_account = Column(String(50), nullable=True)
    source = Column(String(30), default="manual", nullable=False)

    # income
    received_from = Column(String(150))
    gross_amount = Column(Numeric(15, 2))
    payment_method = Column(Enum(PaymentMethod))
    is_qris = Column(Boolean, default=False)
    qris_fee_rate = Column(Numeric(5, 4), default=0.003)
    qris_fee_amount = Column(Numeric(15, 2), default=0)
    net_amount = Column(Numeric(15, 2))

    # expense
    paid_to = Column(String(150))
    gross_expense = Column(Numeric(15, 2))
    discount_received = Column(Numeric(15, 2), default=0)
    net_expense = Column(Numeric(15, 2))

    notes = Column(Text)

    # foreign keys
    sub_project_id = Column(Integer, ForeignKey("sub_projects.id"), nullable=True)
    project_payment_id = Column(Integer, ForeignKey("project_payments.id"), nullable=True)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=True)
    wage_payment_id = Column(Integer, ForeignKey("wage_payments.id"), nullable=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=True)
    project_id   = Column(Integer, ForeignKey("projects.id"), nullable=True)
    
    

    # relationships
    project_payment = relationship("ProjectPayment", back_populates="ledger_entries")
    purchase_order = relationship("PurchaseOrder", back_populates="ledger_entry")
    material = relationship("Material", back_populates="ledger_entry")
    wage_payment = relationship("WagePayment", back_populates="ledger_entry")
    
    __table_args__ = (
        Index("idx_ledger_entries_subproject_type_source", "sub_project_id", "entry_type", "source"),
    )