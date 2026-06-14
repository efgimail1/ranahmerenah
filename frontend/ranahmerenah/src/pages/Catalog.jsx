import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { materialsApi } from "../api/materials";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import Input, { Select } from "../components/ui/Input";
import { Plus, Pencil, Trash2, Archive, Search, Copy } from "lucide-react";
import toast from "react-hot-toast";

const UNIT_OPTIONS = [
  "pcs",
  "m²",
  "m³",
  "m",
  "sak",
  "btg",
  "lbr",
  "rol",
  "set",
  "unit",
  "kg",
  "ltr",
  "dus",
];

const CATEGORY_OPTIONS = [
  "Timber & Wood",
  "Building Materials",
  "Steel & Metal",
  "Electrical",
  "Plumbing & Drainage",
  "Equipment & Tools",
  "Lainnya",
];

const CATEGORY_PREFIX = {
  "Timber & Wood": "TMB",
  "Building Materials": "BLD",
  "Steel & Metal": "STL",
  Electrical: "ELC",
  "Plumbing & Drainage": "PLB",
  "Equipment & Tools": "EQP",
  Lainnya: "OTH",
};

const CATEGORY_COLOR = {
  "Timber & Wood": "amber",
  "Building Materials": "gray",
  "Steel & Metal": "blue",
  Electrical: "amber",
  "Plumbing & Drainage": "blue",
  "Equipment & Tools": "green",
  Lainnya: "gray",
};

function CatalogForm({
  initial,
  onSubmit,
  loading,
  catalog = [],
  isDuplicate = false,
}) {
  const getAutoCode = (category) => {
    const prefix = CATEGORY_PREFIX[category];
    if (!prefix) return "";
    const existing = catalog
      .map((item) => item.item_code || "")
      .filter((code) => code.startsWith(prefix + "-"))
      .map((code) => parseInt(code.split("-")[1]) || 0)
      .filter((n) => !isNaN(n));
    const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;
    return `${prefix}-${String(nextNum).padStart(3, "0")}`;
  };

  const [form, setForm] = useState(() => {
    if (initial) {
      return {
        item_code: isDuplicate
          ? getAutoCode(initial.category)
          : initial.item_code || "",
        name: isDuplicate ? initial.name.replace(/ \(copy\)+$/i, '').trim() : initial.name || "",
        category: initial.category || "",
        default_unit: initial.default_unit || "",
        description: initial.description || "",
        notes: initial.notes || "",
      };
    }
    return {
      item_code: "",
      name: "",
      category: "",
      default_unit: "",
      description: "",
      notes: "",
    };
  });

  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Item Code"
          value={form.item_code}
          onChange={(e) => set("item_code", e.target.value)}
          placeholder="contoh: MAT-001"
        />
        <Select
          label="Category"
          value={form.category}
          onChange={(e) => {
            const newCategory = e.target.value;
            set("category", newCategory);

            // Auto-generate item_code setiap kali category berubah
            // kecuali sedang mode edit (initial.id ada)
            if (!initial?.id || isDuplicate) {
              const prefix = CATEGORY_PREFIX[newCategory];
              if (prefix) {
                const existing = catalog
                  .map((item) => item.item_code || "")
                  .filter((code) => code.startsWith(prefix + "-"))
                  .map((code) => parseInt(code.split("-")[1]) || 0)
                  .filter((n) => !isNaN(n));
                const nextNum =
                  existing.length > 0 ? Math.max(...existing) + 1 : 1;
                set(
                  "item_code",
                  `${prefix}-${String(nextNum).padStart(3, "0")}`,
                );
              } else {
                set("item_code", "");
              }
            }
          }}
        >
          <option value="">-- Select Category --</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input
          label="Item Name *"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="contoh: Besi Beton 12mm"
          className="col-span-2"
          required
        />
        <Select
          label="Default Unit"
          value={form.default_unit}
          onChange={(e) => set("default_unit", e.target.value)}
        >
          <option value="">-- Pilih Unit --</option>
          {UNIT_OPTIONS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
        <Input
          label="Description"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="spesifikasi detail barang"
        />
        <Input
          label="Notes"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="optional"
          className="col-span-2"
        />
      </div>
      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button type="submit" variant="primary" loading={loading}>
          {initial ? "Save Changes" : "Add Item"}
        </Button>
      </div>
    </form>
  );
}

export default function Catalog() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [duplicateData, setDuplicateData] = useState(null);

  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ["catalog"],
    queryFn: materialsApi.getCatalog,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["catalog"] });

  const createMutation = useMutation({
    mutationFn: materialsApi.createCatalogItem,
    onSuccess: () => {
      invalidate();
      setModalOpen(false);
      toast.success("Item added to catalog!");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => materialsApi.updateCatalogItem(id, data),
    onSuccess: () => {
      invalidate();
      setModalOpen(false);
      setEditData(null);
      toast.success("Catalog updated!");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: materialsApi.deleteCatalogItem,
    onSuccess: () => {
      invalidate();
      toast.success("Item removed from catalog.");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (data) => {
    if (editData) updateMutation.mutate({ id: editData.id, data });
    else createMutation.mutate(data);
  };

  const handleDuplicate = (item) => {
    setEditData(null);
    setModalOpen(true);
    // Pre-fill form dengan data item yang diduplikat, tapi kosongkan item_code
    setDuplicateData({
      ...item,
      item_code: "",
      name: `${item.name} (copy)`,
    });
  };

  const filtered = catalog.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.item_code || "").toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterCategory || c.category === filterCategory;
    return matchSearch && matchCategory;
  });

  // group by category
  const grouped = filtered.reduce((acc, item) => {
    const cat = item.category || "Lainnya";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Item Catalog</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {catalog.length} items registered
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditData(null);
            setModalOpen(true);
          }}
        >
          <Plus size={16} /> Add Item
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name / item code..."
            className="pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-56"
          />
        </div>
        <Select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="w-48"
        >
          <option value="">All Categories</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Archive size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">
              {search || filterCategory
                ? "Item not found."
                : "No items in catalog."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  {category}
                </h3>
                <span className="text-xs text-gray-300">({items.length})</span>
              </div>
              <Card padding={false}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-28">
                        Code
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Name
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Unit
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Description
                      </th>
                      <th className="px-4 py-3 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-5 py-3">
                          {item.item_code ? (
                            <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {item.item_code}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            color={CATEGORY_COLOR[item.category] || "gray"}
                          >
                            {item.default_unit}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {item.description || item.notes || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => {
                                setEditData(item);
                                setModalOpen(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDuplicate(item)}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              title="Duplikat"
                            >
                              <Copy size={14} />
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    "Are you sure you want to remove this item from the catalog?",
                                  )
                                )
                                  deleteMutation.mutate(item.id);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditData(null);
          setDuplicateData(null);
        }}
        title={editData ? "Edit Item" : "Add Item to Catalog"}
      >
        <CatalogForm
          key={editData?.id ?? (duplicateData ? `dup-${duplicateData.id}` : "new")}
          initial={editData || duplicateData}
          onSubmit={handleSubmit}
          loading={createMutation.isPending || updateMutation.isPending}
          catalog={catalog}
          isDuplicate={!!duplicateData}
        />
      </Modal>
    </div>
  );
}
