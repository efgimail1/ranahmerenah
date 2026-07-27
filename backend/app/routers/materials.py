from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
import os
import uuid
from anyio import open_file
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from decimal import Decimal
from app.database import get_db
from app.models.material import (
    Material,
    Supplier,
    ItemCatalog,
    PurchaseOrder,
    PurchaseItem,
    SupplierPriceList,
    POPayment,
)
from app.schemas.material import (
    MaterialCreate,
    MaterialResponse,
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
    ItemCatalogCreate,
    ItemCatalogUpdate,
    ItemCatalogResponse,
    PurchaseOrderCreate,
    PurchaseOrderResponse,
    SupplierPriceListCreate,
    SupplierPriceListUpdate,
    SupplierPriceListResponse,
    POPaymentCreate,
    POPaymentResponse,
    POBatchPaymentCreate,
    POBatchPaymentResponse,
)
from app.models.ledger import LedgerEntry, EntryType, PaymentMethod


router = APIRouter(tags=["Materials"])


# ─── Item Catalog ──────────────────────────────────────────
@router.get("/catalog", response_model=List[ItemCatalogResponse])
def get_catalog(db: Session = Depends(get_db)):
    return db.query(ItemCatalog).order_by(ItemCatalog.name).all()


@router.post(
    "/catalog", response_model=ItemCatalogResponse, status_code=status.HTTP_201_CREATED
)
def create_catalog_item(payload: ItemCatalogCreate, db: Session = Depends(get_db)):
    # cek duplikat
    existing = db.query(ItemCatalog).filter(ItemCatalog.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Nama barang sudah ada di katalog")
    item = ItemCatalog(**payload.dict())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/catalog/{item_id}", response_model=ItemCatalogResponse)
def update_catalog_item(
    item_id: int, payload: ItemCatalogUpdate, db: Session = Depends(get_db)
):
    item = db.query(ItemCatalog).filter(ItemCatalog.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for f, v in payload.dict(exclude_unset=True).items():
        setattr(item, f, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/catalog/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_catalog_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(ItemCatalog).filter(ItemCatalog.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()


# ─── Suppliers ─────────────────────────────────────────────
@router.get("/suppliers", response_model=List[SupplierResponse])
def get_suppliers(db: Session = Depends(get_db)):
    return db.query(Supplier).order_by(Supplier.store_name).all()


@router.post(
    "/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED
)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db)):
    supplier = Supplier(**payload.dict())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.put("/suppliers/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: int, payload: SupplierUpdate, db: Session = Depends(get_db)
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for f, v in payload.dict(exclude_unset=True).items():
        setattr(supplier, f, v)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    db.delete(supplier)
    db.commit()


@router.get("/suppliers/{supplier_id}/items")
def get_supplier_items(supplier_id: int, db: Session = Depends(get_db)):
    orders = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.items))
        .filter(PurchaseOrder.supplier_id == supplier_id)
        .all()
    )
    result = []
    for order in orders:
        for item in order.items:
            result.append(
                {
                    "id": item.id,
                    "purchase_date": order.purchase_date,
                    "item_name": item.item_name,
                    "quantity": item.quantity,
                    "unit": item.unit,
                    "unit_price": item.unit_price,
                    "discount_per_unit": item.discount_per_unit,
                    "subtotal_gross": item.subtotal_gross,
                    "subtotal_net": item.subtotal_net,
                }
            )
    return result


# ─── Supplier Price List ───────────────────────────────────


@router.get(
    "/suppliers/{supplier_id}/prices", response_model=List[SupplierPriceListResponse]
)
def get_supplier_prices(supplier_id: int, db: Session = Depends(get_db)):
    return (
        db.query(SupplierPriceList)
        .filter(SupplierPriceList.supplier_id == supplier_id)
        .order_by(SupplierPriceList.item_name)
        .all()
    )


@router.post(
    "/suppliers/{supplier_id}/prices",
    response_model=SupplierPriceListResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_supplier_price(
    supplier_id: int, payload: SupplierPriceListCreate, db: Session = Depends(get_db)
):
    price = SupplierPriceList(**payload.dict(), supplier_id=supplier_id)
    db.add(price)
    db.commit()
    db.refresh(price)
    return price


@router.put("/supplier-prices/{price_id}", response_model=SupplierPriceListResponse)
def update_supplier_price(
    price_id: int, payload: SupplierPriceListUpdate, db: Session = Depends(get_db)
):
    price = db.query(SupplierPriceList).filter(SupplierPriceList.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")
    for f, v in payload.dict(exclude_unset=True).items():
        setattr(price, f, v)
    db.commit()
    db.refresh(price)
    return price


@router.delete("/supplier-prices/{price_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier_price(price_id: int, db: Session = Depends(get_db)):
    price = db.query(SupplierPriceList).filter(SupplierPriceList.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")
    db.delete(price)
    db.commit()


# ─── Price Comparison ─────────────────────────────────────
@router.get("/prices/compare")
def compare_prices(
    item_name: Optional[str] = None,
    catalog_item_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Bandingkan harga barang yang sama antar supplier"""
    query = db.query(SupplierPriceList).options(joinedload(SupplierPriceList.supplier))
    if item_name:
        query = query.filter(SupplierPriceList.item_name.ilike(f"%{item_name}%"))
    if catalog_item_id:
        query = query.filter(SupplierPriceList.catalog_item_id == catalog_item_id)

    prices = query.order_by(SupplierPriceList.price).all()
    return [
        {
            "id": p.id,
            "supplier_id": p.supplier_id,
            "supplier_name": p.supplier.store_name,
            "item_name": p.item_name,
            "unit": p.unit,
            "price": p.price,
            "effective_date": p.effective_date,
            "notes": p.notes,
        }
        for p in prices
    ]
    

# ─── Last Price (autofill harga PO) ────────────────────────
@router.get("/purchase-items/last-price")
def get_last_price(
    catalog_item_id: int,
    supplier_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Ambil harga terakhir item ini pernah dibeli.
    Utamakan dari supplier yang sama; fallback ke supplier manapun
    kalau belum pernah beli item ini dari supplier tsb."""
    base_query = (
        db.query(PurchaseItem)
        .join(PurchaseOrder, PurchaseItem.order_id == PurchaseOrder.id)
        .filter(PurchaseItem.catalog_item_id == catalog_item_id)
    )

    result = None
    is_same_supplier = False

    if supplier_id:
        result = (
            base_query.filter(PurchaseOrder.supplier_id == supplier_id)
            .order_by(PurchaseOrder.purchase_date.desc(), PurchaseItem.id.desc())
            .first()
        )
        is_same_supplier = result is not None

    if not result:
        result = (
            base_query.order_by(PurchaseOrder.purchase_date.desc(), PurchaseItem.id.desc())
            .first()
        )
        is_same_supplier = False

    if not result:
        return None

    return {
        "unit_price": result.unit_price,
        "purchase_date": result.order.purchase_date,
        "supplier_id": result.order.supplier_id,
        "supplier_name": result.order.supplier.store_name if result.order.supplier else None,
        "same_supplier": is_same_supplier,
    }


# ─── Purchase Orders ───────────────────────────────────────
def _calc_item(item_data: dict) -> dict:
    unit_price = Decimal(str(item_data.get("unit_price") or 0))
    discount = Decimal(str(item_data.get("discount_per_unit") or 0))
    qty = Decimal(str(item_data.get("quantity") or 0))
    net_unit = unit_price - discount
    return {
        **item_data,
        "net_unit_price": net_unit,
        "subtotal_gross": qty * unit_price,
        "subtotal_net": qty * net_unit,
        "discount_total": qty * discount,
    }


@router.get("/purchase-orders", response_model=List[PurchaseOrderResponse])
def get_purchase_orders(
    project_id: Optional[int] = None,
    sub_project_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
    is_paid: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    query = db.query(PurchaseOrder).options(
        joinedload(PurchaseOrder.items),
        joinedload(PurchaseOrder.payments),
    )
    if project_id:
        query = query.filter(PurchaseOrder.project_id == project_id)
    if sub_project_id:
        query = query.filter(PurchaseOrder.sub_project_id == sub_project_id)
    if supplier_id:
        query = query.filter(PurchaseOrder.supplier_id == supplier_id)
    if is_paid is not None:
        query = query.filter(PurchaseOrder.is_paid == is_paid)
    orders = query.order_by(PurchaseOrder.purchase_date.desc()).all()
    return [_enrich_order(o) for o in orders]


def _enrich_order(order):
    total_paid = sum(float(p.amount or 0) for p in (order.payments or []))
    total_net = float(order.total_net or 0)
    if total_paid == 0:
        ps = "unpaid"
    elif total_paid >= total_net > 0:
        ps = "paid"
    else:
        ps = "partial"
    return {
        "id": order.id,
        "project_id": order.project_id,
        "sub_project_id": order.sub_project_id,
        "supplier_id": order.supplier_id,
        "purchase_date": order.purchase_date,
        "due_date": order.due_date,
        "is_paid": order.is_paid,
        "ordered_by": order.ordered_by,
        "has_receipt": order.has_receipt,
        "receipt_type": order.receipt_type,
        "receipt_image_url": order.receipt_image_url,
        "notes": order.notes,
        "total_gross": order.total_gross,
        "total_discount": order.total_discount,
        "total_net": order.total_net,
        "items": order.items or [],
        "payments": order.payments or [],
        "total_paid": total_paid,
        "payment_status": ps,
    }


@router.post(
    "/purchase-orders",
    response_model=PurchaseOrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_purchase_order(payload: PurchaseOrderCreate, db: Session = Depends(get_db)):
    items_data = payload.items
    order_data = payload.dict(exclude={"items"})

    order = PurchaseOrder(**order_data)
    db.add(order)
    db.flush()

    total_gross = Decimal("0")
    total_discount = Decimal("0")
    total_net = Decimal("0")

    for item_payload in items_data:
        calc = _calc_item(item_payload.dict())
        item = PurchaseItem(order_id=order.id, **calc)
        db.add(item)
        total_gross += calc["subtotal_gross"] or Decimal("0")
        total_discount += calc["discount_total"] or Decimal("0")
        total_net += calc["subtotal_net"] or Decimal("0")

    order.total_gross = total_gross
    order.total_discount = total_discount
    order.total_net = total_net

    db.commit()
    db.refresh(order)
    return order


@router.get("/purchase-orders/{order_id}", response_model=PurchaseOrderResponse)
def get_purchase_order(order_id: int, db: Session = Depends(get_db)):
    order = (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.items),
            joinedload(PurchaseOrder.payments),
        )
        .filter(PurchaseOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return _enrich_order(order)


@router.put("/purchase-orders/{order_id}", response_model=PurchaseOrderResponse)
def update_purchase_order(
    order_id: int,
    payload: PurchaseOrderCreate,  # pakai Create bukan Update supaya bisa terima items
    db: Session = Depends(get_db),
):
    order = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.items))
        .filter(PurchaseOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # update header
    order.project_id = payload.project_id
    order.sub_project_id = payload.sub_project_id
    order.supplier_id = payload.supplier_id
    order.purchase_date = payload.purchase_date
    order.due_date = payload.due_date
    order.is_paid = payload.is_paid
    order.ordered_by = payload.ordered_by
    order.has_receipt = payload.has_receipt
    order.receipt_type = payload.receipt_type
    order.receipt_image_url = payload.receipt_image_url
    order.notes = payload.notes

    # hapus semua items lama lalu buat ulang
    for old_item in order.items:
        db.delete(old_item)
    db.flush()

    total_gross = Decimal("0")
    total_discount = Decimal("0")
    total_net = Decimal("0")

    for item_payload in payload.items:
        calc = _calc_item(item_payload.dict())
        item = PurchaseItem(order_id=order.id, **calc)
        db.add(item)
        total_gross += calc["subtotal_gross"] or Decimal("0")
        total_discount += calc["discount_total"] or Decimal("0")
        total_net += calc["subtotal_net"] or Decimal("0")

    order.total_gross = total_gross
    order.total_discount = total_discount
    order.total_net = total_net

    db.commit()
    db.refresh(order)
    return order


@router.delete("/purchase-orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    db.delete(order)
    db.commit()


# ─── Legacy Materials (tetap ada) ─────────────────────────
@router.get("/materials", response_model=List[MaterialResponse])
def get_materials(
    project_id: Optional[int] = None,
    is_paid: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Material)
    if project_id:
        query = query.filter(Material.project_id == project_id)
    if is_paid is not None:
        query = query.filter(Material.is_paid == is_paid)
    return query.order_by(Material.purchase_date.desc()).all()


@router.post(
    "/materials", response_model=MaterialResponse, status_code=status.HTTP_201_CREATED
)
def create_material(payload: MaterialCreate, db: Session = Depends(get_db)):
    data = payload.dict()
    unit_price = data.get("unit_price") or Decimal("0")
    discount = data.get("discount_amount") or Decimal("0")
    quantity = data.get("quantity") or Decimal("0")
    data["net_unit_price"] = unit_price - discount
    data["subtotal"] = quantity * unit_price
    data["net_subtotal"] = quantity * (unit_price - discount)
    material = Material(**data)
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


@router.delete("/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(material_id: int, db: Session = Depends(get_db)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    db.delete(material)
    db.commit()


# ─── PO Payments ───────────────────────────────────────────
@router.get(
    "/purchase-orders/{order_id}/payments", response_model=List[POPaymentResponse]
)
def get_po_payments(order_id: int, db: Session = Depends(get_db)):
    return (
        db.query(POPayment)
        .filter(POPayment.order_id == order_id)
        .order_by(POPayment.payment_date)
        .all()
    )


@router.post(
    "/purchase-orders/{order_id}/payments",
    response_model=POPaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_po_payment(
    order_id: int, payload: POPaymentCreate, db: Session = Depends(get_db)
):
    order = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.payments))
        .filter(PurchaseOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    payment = POPayment(order_id=order_id, **payload.dict())
    db.add(payment)
    db.flush()

    # Recompute total_paid and update is_paid on PO
    db.refresh(order)
    total_paid = sum(float(p.amount or 0) for p in order.payments)
    total_net = float(order.total_net or 0)
    order.is_paid = total_net > 0 and total_paid >= total_net
    db.commit()
    db.refresh(payment)
    return payment


@router.delete(
    "/purchase-orders/{order_id}/payments/{payment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_po_payment(order_id: int, payment_id: int, db: Session = Depends(get_db)):
    payment = (
        db.query(POPayment)
        .filter(POPayment.id == payment_id, POPayment.order_id == order_id)
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(payment)
    db.flush()

    # Recompute is_paid
    order = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.payments))
        .filter(PurchaseOrder.id == order_id)
        .first()
    )
    if order:
        remaining_payments = [p for p in order.payments if p.id != payment_id]
        total_paid = sum(float(p.amount or 0) for p in remaining_payments)
        order.is_paid = float(order.total_net or 0) > 0 and total_paid >= float(
            order.total_net or 0
        )
    db.commit()


@router.post(
    "/purchase-orders/batch-payments",
    response_model=POBatchPaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_batch_payment(payload: POBatchPaymentCreate, db: Session = Depends(get_db)):
    order_ids = list(dict.fromkeys(payload.order_ids))
    orders = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.payments), joinedload(PurchaseOrder.supplier))
        .filter(PurchaseOrder.id.in_(order_ids))
        .all()
    )
    if len(orders) != len(order_ids):
        raise HTTPException(status_code=404, detail="Ada PO yang tidak ditemukan")
    supplier_ids = {o.supplier_id for o in orders}
    if len(supplier_ids) > 1:
        raise HTTPException(
            status_code=400,
            detail="Batch payment hanya boleh untuk PO dari 1 supplier yang sama",
        )
    supplier = orders[0].supplier
    total_amount = Decimal("0")
    remaining_by_order = {}
    for o in orders:
        total_paid = sum(Decimal(str(p.amount or 0)) for p in (o.payments or []))
        total_net = Decimal(str(o.total_net or 0))
        sisa = total_net - total_paid
        if sisa <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"PO-{str(o.id).zfill(5)} sudah lunas, tidak bisa dimasukkan ke batch payment",
            )
        remaining_by_order[o.id] = sisa
        total_amount += sisa
    po_labels = ", ".join(f"PO-{str(o.id).zfill(5)}" for o in orders)
    supplier_name = supplier.store_name if supplier else "Supplier"
    description = f"Pembayaran {len(orders)} PO - {supplier_name}"
    auto_note = f"Mencakup: {po_labels}"
    combined_notes = f"{payload.notes}\n{auto_note}" if payload.notes else auto_note

# Kalau semua PO yang dipilih kebetulan 1 project/sub-project yang sama,
    # ikutkan di ledger entry. Kalau campur, biarkan null (lebih jujur
    # daripada asal pilih salah satu dan bikin laporan project salah).
    project_ids = {o.project_id for o in orders if o.project_id}
    sub_project_ids = {o.sub_project_id for o in orders if o.sub_project_id}
    entry_project_id = project_ids.pop() if len(project_ids) == 1 else None
    entry_sub_project_id = sub_project_ids.pop() if len(sub_project_ids) == 1 else None
    
    entry = LedgerEntry(
        entry_date=payload.payment_date,
        entry_type=EntryType.expense,
        description=description,
        paid_to=supplier_name,
        gross_expense=total_amount,
        discount_received=Decimal("0"),
        net_expense=total_amount,
        net_amount=total_amount,
        payment_method=PaymentMethod(payload.payment_method or "transfer"), 
        bank_account=payload.bank_account,
        project_id=entry_project_id,
        sub_project_id=entry_sub_project_id,
        notes=combined_notes,
        source="po_batch_payment",
    )
    db.add(entry)
    db.flush()
    created_payments = []
    for o in orders:
        payment = POPayment(
            order_id=o.id,
            payment_date=payload.payment_date,
            amount=remaining_by_order[o.id],
            paid_by=payload.paid_by,
            bank_account=payload.bank_account,
            payment_method=payload.payment_method,
            notes=payload.notes,
            ledger_entry_id=entry.id,
        )
        db.add(payment)
        created_payments.append(payment)
        o.is_paid = True
        db.commit()
    db.refresh(entry)
    for p in created_payments:
        db.refresh(p)
        return POBatchPaymentResponse(
            ledger_entry_id=entry.id,
            total_amount=total_amount,
            payments=created_payments,
        )


UPLOAD_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "uploads", "receipts"
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/purchase-orders/upload-receipt")
async def upload_receipt(file: UploadFile = File(...)):
    original_name = os.path.splitext(file.filename)[0]
    ext = os.path.splitext(file.filename)[1]

    # Bersihkan nama dari karakter yang tidak aman untuk path file
    safe_name = "".join(
        c for c in original_name if c.isalnum() or c in (" ", "-", "_")
    ).strip()
    safe_name = safe_name.replace(" ", "_")

    unique_suffix = uuid.uuid4().hex[:6]
    final_name = f"{safe_name}_{unique_suffix}{ext}"
    file_path = os.path.join(UPLOAD_DIR, final_name)

    async with open_file(file_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):
            await buffer.write(chunk)

    url = f"/uploads/receipts/{final_name}"
    return {"url": url}
