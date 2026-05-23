from sqlalchemy import Column, Integer, Numeric, Text, Date, ForeignKey, ARRAY
from sqlalchemy.orm import relationship
from app.database import Base

class Timesheet(Base):
    __tablename__ = "timesheets"

    id            = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("worker_assignments.id"), nullable=False)
    worker_id     = Column(Integer, ForeignKey("workers.id"), nullable=False)
    project_id    = Column(Integer, ForeignKey("projects.id"), nullable=False)
    work_date     = Column(Date, nullable=False)
    hours_worked  = Column(Numeric(4, 1))
    units_completed = Column(Numeric(8, 2))
    notes         = Column(Text)

    assignment = relationship("WorkerAssignment")
    worker     = relationship("Worker")