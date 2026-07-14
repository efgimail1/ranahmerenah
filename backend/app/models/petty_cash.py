from sqlalchemy import Column, Integer, String, Numeric, Text, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class PettyCash(Base):
    """
    Kas tukang (petty cash) — uang tunai yang dicairkan ke tukang/penerima
    untuk keperluan belanja operasional proyek (galon, token listrik, dll
    atau belanja material ke supplier yang nanti dicatat sebagai PO Payment).

    Pencairan TIDAK langsung masuk ledger — uang ini dianggap masih
    "di tangan" penerima sampai benar-benar dipakai untuk membayar PO
    (lihat POPayment.petty_cash_id) atau dikembalikan sisanya saat settlement.
    """
    __tablename__ = "petty_cash"

    id             = Column(Integer, primary_key=True, index=True)
    sub_project_id = Column(Integer, ForeignKey("sub_projects.id"), nullable=False)
    cash_date      = Column(Date, nullable=False)
    amount         = Column(Numeric(15, 2), nullable=False)
    given_to       = Column(String(150))
    given_by       = Column(String(150))
    bank_account   = Column(String(50))          # asal kas (opsional)
    notes          = Column(Text)
    status         = Column(String(20), default="open")  # open | settled
    settlement_date = Column(Date, nullable=True)
    refund_ledger_entry_id = Column(Integer, ForeignKey("ledger_entries.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    created_at     = Column(DateTime, server_default=func.now())

    sub_project = relationship("SubProject", back_populates="petty_cash_records")
    po_payments = relationship("POPayment", back_populates="petty_cash")
