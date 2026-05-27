from sqlalchemy import Column, Integer, Numeric, Text, Date, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Timesheet(Base):
    __tablename__ = "timesheets"

    id              = Column(Integer, primary_key=True, index=True)
    assignment_id   = Column(Integer, ForeignKey("worker_assignments.id"), nullable=False)
    worker_id       = Column(Integer, ForeignKey("workers.id"), nullable=False)
    project_id      = Column(Integer, ForeignKey("projects.id"), nullable=False)
    work_date       = Column(Date, nullable=False)
    regular_hours   = Column(Numeric(4, 1), default=8)
    overtime_hours  = Column(Numeric(4, 1), default=0)
    overtime_rate   = Column(Numeric(5, 2), default=1.5)  # multiplier
    notes           = Column(Text)
    is_paid         = Column(Boolean, default=False)
    wage_payment_id = Column(Integer, ForeignKey("wage_payments.id"), nullable=True)
    created_at      = Column(DateTime, server_default=func.now())

    assignment   = relationship("WorkerAssignment")
    worker       = relationship("Worker")