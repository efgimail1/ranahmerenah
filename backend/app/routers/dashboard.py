from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.project import Project, ProjectPayment, PaymentStatus, ProjectStatus
from app.models.material import Material
from app.models.ledger import LedgerEntry, EntryType
from app.models.worker import WagePayment
from decimal import Decimal

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    projects = db.query(Project).all()

    total_rab = sum(p.rab_value or 0 for p in projects)
    total_fee = sum(p.architect_fee or 0 for p in projects)

    total_paid = Decimal("0")
    for p in projects:
        for pay in p.payments:
            if pay.status == PaymentStatus.paid:
                total_paid += pay.amount or 0

    status_count = {
        "pending": 0, "in_progress": 0,
        "completed": 0, "on_hold": 0, "cancelled": 0
    }
    for p in projects:
        status_count[p.status.value] += 1

    # arus kas bulan ini
    from datetime import date
    today = date.today()
    entries = db.query(LedgerEntry).filter(
        LedgerEntry.entry_date >= today.replace(day=1)
    ).all()

    monthly_income = sum(
        e.net_amount or 0 for e in entries
        if e.entry_type == EntryType.income
    )
    monthly_expense = sum(
        e.net_expense or 0 for e in entries
        if e.entry_type == EntryType.expense
    )

    # tagihan jatuh tempo
    overdue_payments = db.query(ProjectPayment).filter(
        ProjectPayment.status != PaymentStatus.paid,
        ProjectPayment.due_date < today
    ).all()

    return {
        "projects": {
            "total": len(projects),
            "by_status": status_count,
        },
        "financials": {
            "total_rab": total_rab,
            "total_architect_fee": total_fee,
            "total_collected": total_paid,
            "total_outstanding": total_fee - total_paid,
        },
        "monthly_cashflow": {
            "income": monthly_income,
            "expense": monthly_expense,
            "net": monthly_income - monthly_expense,
        },
        "overdue_payments_count": len(overdue_payments),
    }