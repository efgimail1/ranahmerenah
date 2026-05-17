from sqlalchemy import Column, Integer, String, Date, Numeric, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class ProjectStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    on_hold = "on_hold"
    cancelled = "cancelled"

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String(150), nullable=False)
    client_phone = Column(String(20))
    project_name = Column(String(200), nullable=False)
    location = Column(String(255))
    received_date = Column(Date, nullable=False)
    start_date = Column(Date)
    end_date = Column(Date)
    rab_value = Column(Numeric(15, 2), default=0)
    architect_fee = Column(Numeric(15, 2), default=0)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.pending)
    notes = Column(Text)

    # relationships
    payments = relationship("ProjectPayment", back_populates="project", cascade="all, delete")
    worker_assignments = relationship("WorkerAssignment", back_populates="project")
    purchase_orders = relationship("PurchaseOrder", back_populates="project")


class PaymentTermType(str, enum.Enum):
    dp = "dp"
    termin = "termin"
    final = "final"

class PaymentStatus(str, enum.Enum):
    unpaid = "unpaid"
    partial = "partial"
    paid = "paid"

class ProjectPayment(Base):
    __tablename__ = "project_payments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    term_type = Column(Enum(PaymentTermType), nullable=False)
    term_label = Column(String(50))        # misal "Termin 1", "Termin 2"
    percentage = Column(Numeric(5, 2))     # persentase dari biaya arsitek
    amount = Column(Numeric(15, 2))        # nominal
    due_date = Column(Date)
    paid_date = Column(Date)
    amount_paid = Column(Numeric(15, 2), default=0)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.unpaid)
    notes = Column(Text)

    project = relationship("Project", back_populates="payments")
    ledger_entries = relationship("LedgerEntry", back_populates="project_payment")