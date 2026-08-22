'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  CreditCard,
  History,
  X,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

import { useApp, fetchJson } from '@/lib/app-store'

type Vendor = {
  id: string
  name: string
  code?: string | null
}
type Company = {
  id: string
  name: string
  code: string
  type: string
  parentId?: string | null
}

type Payment = {
  id: string
  paymentDate: string
  amount: number
  paymentMethod: string
  referenceNumber?: string | null
  notes?: string | null
  status: string
}

type Bill = {
  id: string
  companyId: string
  vendorId: string
  company?: {
    id: string
    name: string
    code: string
  }
  billNumber: string
  billDate: string
  dueDate?: string | null
  subtotal?: number | null
  taxAmount?: number | null
  totalAmount: number
  description?: string | null
  status: string
  source?: string | null
  documentUrl?: string | null
  documentName?: string | null
  vendor?: Vendor
  payments?: Payment[]
  createdAt: string
  updatedAt: string
}

type BillForm = {
  companyId: string
  vendorId: string
  billNumber: string
  billDate: string
  dueDate: string
  subtotal: string
  taxAmount: string
  totalAmount: string
  description: string
  documentUrl: string
  documentName: string
}

type PaymentForm = {
  amount: string
  paymentDate: string
  paymentMethod: string
  referenceNumber: string
  notes: string
}

const emptyBillForm: BillForm = {
  companyId: '',
  vendorId: '',
  billNumber: '',
  billDate: '',
  dueDate: '',
  subtotal: '',
  taxAmount: '',
  totalAmount: '',
  description: '',
  documentUrl: '',
  documentName: '',
}

const emptyPaymentForm: PaymentForm = {
  amount: '',
  paymentDate: '',
  paymentMethod: 'BANK_TRANSFER',
  referenceNumber: '',
  notes: '',
}

function formatINR(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDate(value?: string | null) {
  if (!value) return '—'

  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getPaidAmount(bill: Bill) {
  return (bill.payments || [])
    .filter((payment) => payment.status === 'ACTIVE')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
}

function getOutstandingAmount(bill: Bill) {
  return Math.max(Number(bill.totalAmount || 0) - getPaidAmount(bill), 0)
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ')
}

function statusClass(status: string) {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'PARTIAL':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'OVERDUE':
      return 'bg-red-50 text-red-700 border-red-200'
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200'
  }
}

export function BillsModule() {
  const { user } = useApp()

  const [bills, setBills] = useState<Bill[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [companies, setCompanies] = useState<Company[]>([])

  const [loading, setLoading] = useState(true)
  const [loadingVendors, setLoadingVendors] = useState(true)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [vendorFilter, setVendorFilter] = useState('ALL')

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const [selectedBill, setSelectedBill] = useState<Bill | null>(null)

  const [billForm, setBillForm] = useState<BillForm>(emptyBillForm)
  const [paymentForm, setPaymentForm] =
    useState<PaymentForm>(emptyPaymentForm)

  const [submitting, setSubmitting] = useState(false)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
  const [paymentDocument, setPaymentDocument] = useState<File | null>(null)
  const [paymentDocumentPreview, setPaymentDocumentPreview] = useState<string | null>(null)

  /*
   * GROUP_ADMIN is the application-level parent administrator.
   * The backend must also enforce this restriction.
   */
  const canEditDelete = user?.role === 'GROUP_ADMIN'

  async function loadBills() {
    setLoading(true)

    try {
      const data = await fetchJson<{ bills: Bill[] }>('/api/bills')
      setBills(data.bills || [])
    } catch (error: any) {
      toast.error(error.message || 'Failed to load bills')
    } finally {
      setLoading(false)
    }
  }

  async function loadVendors(companyId?: string) {
    if (!companyId) {
      setVendors([])
      return
    }

    setLoadingVendors(true)

    try {
      const data = await fetchJson<{ vendors: Vendor[] }>(
        `/api/vendors?companyId=${encodeURIComponent(companyId)}`
      )

      setVendors(data.vendors || [])
    } catch (error: any) {
      toast.error(error.message || 'Failed to load vendors')
      setVendors([])
    } finally {
      setLoadingVendors(false)
    }
  }

  useEffect(() => {
    if (!user) return

    async function initialize() {
      try {
        const companiesData = await fetchJson<{ companies: Company[] }>(
          '/api/companies'
        )

        setCompanies(companiesData.companies || [])

        if (
          user?.role !== 'GROUP_ADMIN' &&
          user?.companyId
        ) {
          const companyId = user.companyId

          setBillForm((prev) => ({
            ...prev,
            companyId,
          }))

          await loadVendors(companyId)
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to initialize bill form')
      }

      await loadBills()
    }

    void initialize()
  }, [user])

  const filteredBills = useMemo(() => {
    const query = search.trim().toLowerCase()

    return bills.filter((bill) => {
      const matchesSearch =
        !query ||
        bill.billNumber.toLowerCase().includes(query) ||
        bill.vendor?.name?.toLowerCase().includes(query) ||
        bill.vendor?.code?.toLowerCase().includes(query) ||
        bill.description?.toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === 'ALL' || bill.status === statusFilter

      const matchesVendor =
        vendorFilter === 'ALL' || bill.vendorId === vendorFilter

      return matchesSearch && matchesStatus && matchesVendor
    })
  }, [bills, search, statusFilter, vendorFilter])

  const totals = useMemo(() => {
    const totalAmount = bills.reduce(
      (sum, bill) => sum + Number(bill.totalAmount || 0),
      0
    )

    const paidAmount = bills.reduce(
      (sum, bill) => sum + getPaidAmount(bill),
      0
    )

    const outstanding = bills.reduce(
      (sum, bill) => sum + getOutstandingAmount(bill),
      0
    )

    const overdue = bills
      .filter((bill) => bill.status === 'OVERDUE')
      .reduce((sum, bill) => sum + getOutstandingAmount(bill), 0)

    return {
      count: bills.length,
      totalAmount,
      paidAmount,
      outstanding,
      overdue,
    }
  }, [bills])

  function openCreate() {
    const companyId =
      user?.role === 'GROUP_ADMIN'
        ? ''
        : user?.companyId || ''

    setBillForm({
      ...emptyBillForm,
      companyId,
      billDate: new Date().toISOString().slice(0, 10),
    })

    setVendors([])

    if (companyId) {
      void loadVendors(companyId)
    }

    setSelectedBill(null)
    setCreateOpen(true)
  }

  function openView(bill: Bill) {
    setSelectedBill(bill)
    setViewOpen(true)
  }

  function openEdit(bill: Bill) {
    if (!canEditDelete) {
      toast.error('Only Drona Enterprises can edit bills')
      return
    }

    setSelectedBill(bill)

    setBillForm({
      companyId: bill.companyId,
      vendorId: bill.vendorId,
      billNumber: bill.billNumber,
      billDate: bill.billDate?.slice(0, 10) || '',
      dueDate: bill.dueDate?.slice(0, 10) || '',
      subtotal: bill.subtotal?.toString() || '',
      taxAmount: bill.taxAmount?.toString() || '',
      totalAmount: bill.totalAmount?.toString() || '',
      description: bill.description || '',
      documentUrl: bill.documentUrl || '',
      documentName: bill.documentName || '',
    })

    setEditOpen(true)
  }

  function openPayment(bill: Bill) {
    setSelectedBill(bill)

    setPaymentForm({
      ...emptyPaymentForm,
      amount: getOutstandingAmount(bill).toString(),
      paymentDate: new Date().toISOString().slice(0, 10),
    })

    setPaymentOpen(true)
  }

  async function handleCreateBill() {
    if (!billForm.vendorId) {
      toast.error('Please select a vendor')
      return
    }

    if (!billForm.billNumber.trim()) {
      toast.error('Bill number is required')
      return
    }

    if (!billForm.totalAmount || Number(billForm.totalAmount) <= 0) {
      toast.error('Please enter a valid total amount')
      return
    }

    setSubmitting(true)

    try {
      const companyId =
        user?.company?.id ||
        user?.companyId

      await fetchJson('/api/bills', {
        method: 'POST',
        body: JSON.stringify({
          companyId,
          vendorId: billForm.vendorId,
          billNumber: billForm.billNumber.trim(),
          billDate: billForm.billDate,
          dueDate: billForm.dueDate || null,
          subtotal: billForm.subtotal
            ? Number(billForm.subtotal)
            : null,
          taxAmount: billForm.taxAmount
            ? Number(billForm.taxAmount)
            : null,
          totalAmount: Number(billForm.totalAmount),
          description: billForm.description || null,
          documentUrl: billForm.documentUrl || null,
          documentName: billForm.documentName || null,
        }),
      })

      toast.success('Bill created successfully')
      setCreateOpen(false)
      setBillForm(emptyBillForm)

      await loadBills()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create bill')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdateBill() {
    if (!selectedBill) return

    if (!canEditDelete) {
      toast.error('Only Drona Enterprises can edit bills')
      return
    }

    setSubmitting(true)

    try {
      await fetchJson(`/api/bills/${selectedBill.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: billForm.vendorId,
          billNumber: billForm.billNumber.trim(),
          billDate: billForm.billDate,
          dueDate: billForm.dueDate || null,
          subtotal: billForm.subtotal
            ? Number(billForm.subtotal)
            : null,
          taxAmount: billForm.taxAmount
            ? Number(billForm.taxAmount)
            : null,
          totalAmount: Number(billForm.totalAmount),
          description: billForm.description || null,
          documentUrl: billForm.documentUrl || null,
          documentName: billForm.documentName || null,
        }),
      })

      toast.success('Bill updated successfully')
      setEditOpen(false)
      setSelectedBill(null)

      await loadBills()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update bill')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteBill(bill: Bill) {
    if (!canEditDelete) {
      toast.error('Only Drona Enterprises can delete bills')
      return
    }

    const paid = getPaidAmount(bill)

    if (paid > 0) {
      toast.error(
        'This bill has payments. Reverse the payments before deleting it.'
      )
      return
    }

    const confirmed = window.confirm(
      `Delete bill ${bill.billNumber}? This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      await fetchJson(`/api/bills/${bill.id}`, {
        method: 'DELETE',
      })

      toast.success('Bill deleted successfully')
      await loadBills()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete bill')
    }
  }

  async function handleRecordPayment() {
    if (!selectedBill) return

    const amount = Number(paymentForm.amount)

    if (!amount || amount <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }

    const outstanding = getOutstandingAmount(selectedBill)

    if (amount > outstanding) {
      toast.error(
        `Payment cannot exceed outstanding amount of ${formatINR(outstanding)}`
      )
      return
    }

    setPaymentSubmitting(true)

    try {
      const formData = new FormData()

        formData.append(
        'companyId',
        user?.company?.id || user?.companyId || ''
        )

        formData.append('billId', selectedBill.id)

        formData.append(
        'paymentDate',
        paymentForm.paymentDate
        )

        formData.append(
        'amount',
        String(amount)
        )

        formData.append(
        'paymentMethod',
        paymentForm.paymentMethod
        )

        if (paymentForm.referenceNumber) {
        formData.append(
            'referenceNumber',
            paymentForm.referenceNumber
        )
        }

        if (paymentForm.notes) {
        formData.append(
            'notes',
            paymentForm.notes
        )
        }

        if (paymentDocument) {
        formData.append(
            'file',
            paymentDocument
        )
        }

        const response = await fetch(
        '/api/payments/vendor',
        {
            method: 'POST',
            credentials: 'include',
            body: formData,
        }
        )

        if (!response.ok) {
        const errorData = await response
            .json()
            .catch(() => ({}))

        throw new Error(
            errorData.error ||
            `Request failed: ${response.status}`
        )
        }

        await response.json()

      toast.success('Vendor payment recorded')

        if (paymentDocumentPreview) {
        URL.revokeObjectURL(paymentDocumentPreview)
        }

        setPaymentDocument(null)
        setPaymentDocumentPreview(null)

        setPaymentOpen(false)

        await loadBills()
    } catch (error: any) {
      toast.error(error.message || 'Failed to record payment')
    } finally {
      setPaymentSubmitting(false)
    }
  }

  async function openPaymentHistory(bill: Bill) {
    setSelectedBill(bill)
    setHistoryOpen(true)

    try {
      const data = await fetchJson<{ payments: Payment[] }>(
        `/api/payments/vendor?billId=${bill.id}`
      )

      setSelectedBill({
        ...bill,
        payments: data.payments || [],
      })
    } catch (error: any) {
      toast.error(error.message || 'Failed to load payment history')
    }
  }

  function renderBillForm(isEdit: boolean) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Company */}
          <div className="space-y-2 min-w-0">
            <Label>Company *</Label>

            {user?.role === 'GROUP_ADMIN' ? (
              <Select
                value={billForm.companyId}
                onValueChange={(value) => {
                  setBillForm((prev) => ({
                    ...prev,
                    companyId: value,
                    vendorId: '',
                  }))

                  void loadVendors(value)
                }}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>

                <SelectContent>
                  {companies
                    .filter((company) => company.type === 'TENANT')
                    .map((company) => (
                      <SelectItem
                        key={company.id}
                        value={company.id}
                      >
                        {company.name}
                        {company.code
                          ? ` (${company.code})`
                          : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={user?.company?.name || ''}
                disabled
              />
            )}
          </div>

          {/* Vendor */}
          <div className="space-y-2 min-w-0">
            <Label>Vendor *</Label>

            <Select
              value={billForm.vendorId}
              onValueChange={(value) =>
                setBillForm((prev) => ({
                  ...prev,
                  vendorId: value,
                }))
              }
              disabled={
                loadingVendors ||
                !billForm.companyId
              }
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue
                  placeholder={
                    !billForm.companyId
                      ? 'Select company first'
                      : loadingVendors
                        ? 'Loading vendors...'
                        : 'Select vendor'
                  }
                />
              </SelectTrigger>

              <SelectContent>
                {vendors.map((vendor) => (
                  <SelectItem
                    key={vendor.id}
                    value={vendor.id}
                  >
                    {vendor.name}
                    {vendor.code
                      ? ` (${vendor.code})`
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 min-w-0">
            <Label>Bill Number *</Label>
            <Input
              value={billForm.billNumber}
              onChange={(e) =>
                setBillForm((prev) => ({
                  ...prev,
                  billNumber: e.target.value,
                }))
              }
              placeholder="e.g. BILL-1001"
            />
          </div>

          <div className="space-y-2">
            <Label>Bill Date *</Label>
            <Input
              type="date"
              value={billForm.billDate}
              onChange={(e) =>
                setBillForm((prev) => ({
                  ...prev,
                  billDate: e.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input
              type="date"
              value={billForm.dueDate}
              onChange={(e) =>
                setBillForm((prev) => ({
                  ...prev,
                  dueDate: e.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Subtotal</Label>
            <Input
              type="number"
              min="0"
              value={billForm.subtotal}
              onChange={(e) =>
                setBillForm((prev) => ({
                  ...prev,
                  subtotal: e.target.value,
                }))
              }
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label>Tax Amount</Label>
            <Input
              type="number"
              min="0"
              value={billForm.taxAmount}
              onChange={(e) =>
                setBillForm((prev) => ({
                  ...prev,
                  taxAmount: e.target.value,
                }))
              }
              placeholder="0"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Total Amount *</Label>
            <Input
              type="number"
              min="0"
              value={billForm.totalAmount}
              onChange={(e) =>
                setBillForm((prev) => ({
                  ...prev,
                  totalAmount: e.target.value,
                }))
              }
              placeholder="0"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Input
              value={billForm.description}
              onChange={(e) =>
                setBillForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Bill description"
            />
          </div>

          <div className="space-y-2">
            <Label>Document Name</Label>
            <Input
              value={billForm.documentName}
              onChange={(e) =>
                setBillForm((prev) => ({
                  ...prev,
                  documentName: e.target.value,
                }))
              }
              placeholder="invoice.pdf"
            />
          </div>

          <div className="space-y-2">
            <Label>Document URL</Label>
            <Input
              value={billForm.documentUrl}
              onChange={(e) =>
                setBillForm((prev) => ({
                  ...prev,
                  documentUrl: e.target.value,
                }))
              }
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button
            variant="outline"
            onClick={() =>
              isEdit
                ? setEditOpen(false)
                : setCreateOpen(false)
            }
          >
            Cancel
          </Button>

          <Button
            onClick={
              isEdit
                ? handleUpdateBill
                : handleCreateBill
            }
            disabled={submitting}
          >
            {submitting
              ? 'Saving...'
              : isEdit
                ? 'Save Changes'
                : 'Create Bill'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2148]">
            Bills & Payables
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Manage vendor bills, payments and outstanding payables.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => void loadBills()}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${
                loading ? 'animate-spin' : ''
              }`}
            />
            Refresh
          </Button>

          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Bill
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard
          label="Total Bills"
          value={totals.count.toString()}
        />

        <SummaryCard
          label="Total Amount"
          value={formatINR(totals.totalAmount)}
        />

        <SummaryCard
          label="Paid"
          value={formatINR(totals.paidAmount)}
        />

        <SummaryCard
          label="Outstanding"
          value={formatINR(totals.outstanding)}
        />

        <SummaryCard
          label="Overdue"
          value={formatINR(totals.overdue)}
        />
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

            <Input
              className="pl-9"
              placeholder="Search bill, vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select
            value={vendorFilter}
            onValueChange={setVendorFilter}
          >
            <SelectTrigger>
              <SelectValue placeholder="All vendors" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="ALL">
                All Vendors
              </SelectItem>

              {vendors.map((vendor) => (
                <SelectItem
                  key={vendor.id}
                  value={vendor.id}
                >
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="ALL">
                All Statuses
              </SelectItem>
              <SelectItem value="UNPAID">
                Unpaid
              </SelectItem>
              <SelectItem value="PARTIAL">
                Partial
              </SelectItem>
              <SelectItem value="PAID">
                Paid
              </SelectItem>
              <SelectItem value="OVERDUE">
                Overdue
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                {user?.role === 'GROUP_ADMIN' && (
                  <th className="text-left px-4 py-3 font-semibold">
                    Company
                  </th>
                )}

                <th className="text-left px-4 py-3 font-semibold">
                  Bill
                </th>

                <th className="text-left px-4 py-3 font-semibold">
                  Vendor
                </th>
                <th className="text-left px-4 py-3 font-semibold">
                  Bill Date
                </th>
                <th className="text-left px-4 py-3 font-semibold">
                  Due Date
                </th>
                <th className="text-right px-4 py-3 font-semibold">
                  Amount
                </th>
                <th className="text-right px-4 py-3 font-semibold">
                  Outstanding
                </th>
                <th className="text-left px-4 py-3 font-semibold">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-semibold">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-12 text-slate-500"
                  >
                    Loading bills...
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-12 text-slate-500"
                  >
                    No bills found.
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr
                    key={bill.id}
                    className="hover:bg-slate-50/70"
                  >
                    {user?.role === 'GROUP_ADMIN' && (
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {bill.company?.name || '—'}
                        </div>

                        {bill.company?.code && (
                          <div className="text-xs text-slate-500">
                            {bill.company.code}
                          </div>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="font-semibold text-[#0B2148]">
                        {bill.billNumber}
                      </div>

                      {bill.description && (
                        <div className="text-xs text-slate-400 truncate max-w-[180px]">
                          {bill.description}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium">
                        {bill.vendor?.name || 'Unknown Vendor'}
                      </div>

                      {bill.vendor?.code && (
                        <div className="text-xs text-slate-400">
                          {bill.vendor.code}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {formatDate(bill.billDate)}
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {formatDate(bill.dueDate)}
                    </td>

                    <td className="px-4 py-4 text-right font-semibold">
                      {formatINR(Number(bill.totalAmount))}
                    </td>

                    <td className="px-4 py-4 text-right font-semibold">
                      {formatINR(getOutstandingAmount(bill))}
                    </td>

                    <td className="px-4 py-4">
                      <Badge
                        variant="outline"
                        className={statusClass(bill.status)}
                      >
                        {statusLabel(bill.status)}
                      </Badge>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View"
                          onClick={() => openView(bill)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          title="Record Payment"
                          disabled={
                            getOutstandingAmount(bill) <= 0
                          }
                          onClick={() => openPayment(bill)}
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          title="Payment History"
                          onClick={() =>
                            void openPaymentHistory(bill)
                          }
                        >
                          <History className="h-4 w-4" />
                        </Button>

                        {canEditDelete && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit"
                              onClick={() => openEdit(bill)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete"
                              className="text-red-600 hover:text-red-700"
                              onClick={() =>
                                void handleDeleteBill(bill)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create */}
      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Bill</DialogTitle>
          </DialogHeader>

          {renderBillForm(false)}
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog
        open={editOpen}
        onOpenChange={setEditOpen}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Bill</DialogTitle>
          </DialogHeader>

          {renderBillForm(true)}
        </DialogContent>
      </Dialog>

      {/* View */}
      <Dialog
        open={viewOpen}
        onOpenChange={setViewOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Bill Details
            </DialogTitle>
          </DialogHeader>

          {selectedBill && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Detail
                  label="Bill Number"
                  value={selectedBill.billNumber}
                />

                <Detail
                  label="Vendor"
                  value={
                    selectedBill.vendor?.name ||
                    'Unknown Vendor'
                  }
                />

                <Detail
                  label="Bill Date"
                  value={formatDate(selectedBill.billDate)}
                />

                <Detail
                  label="Due Date"
                  value={formatDate(selectedBill.dueDate)}
                />

                <Detail
                  label="Total Amount"
                  value={formatINR(
                    Number(selectedBill.totalAmount)
                  )}
                />

                <Detail
                  label="Paid"
                  value={formatINR(
                    getPaidAmount(selectedBill)
                  )}
                />

                <Detail
                  label="Outstanding"
                  value={formatINR(
                    getOutstandingAmount(selectedBill)
                  )}
                />

                <Detail
                  label="Status"
                  value={statusLabel(selectedBill.status)}
                />
              </div>

              {selectedBill.description && (
                <div>
                  <div className="text-xs font-semibold text-slate-500">
                    Description
                  </div>

                  <div className="mt-1 text-sm">
                    {selectedBill.description}
                  </div>
                </div>
              )}

              {selectedBill.documentUrl && (
                <a
                  href={selectedBill.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-[#0891B2] hover:underline"
                >
                  Open {selectedBill.documentName || 'document'}
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment */}
      <Dialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Record Vendor Payment
            </DialogTitle>
          </DialogHeader>

          {selectedBill && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 border p-4">
                <div className="text-xs text-slate-500">
                  Bill
                </div>

                <div className="font-semibold">
                  {selectedBill.billNumber}
                </div>

                <div className="text-sm text-slate-600 mt-1">
                  Outstanding:{' '}
                  <strong>
                    {formatINR(
                      getOutstandingAmount(selectedBill)
                    )}
                  </strong>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Amount *</Label>

                <Input
                  type="number"
                  min="0"
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Date *</Label>

                <Input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      paymentDate: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>

                <Select
                  value={paymentForm.paymentMethod}
                  onValueChange={(value) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      paymentMethod: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="BANK_TRANSFER">
                      Bank Transfer
                    </SelectItem>
                    <SelectItem value="UPI">
                      UPI
                    </SelectItem>
                    <SelectItem value="CHEQUE">
                      Cheque
                    </SelectItem>
                    <SelectItem value="CASH">
                      Cash
                    </SelectItem>
                    <SelectItem value="CARD">
                      Card
                    </SelectItem>
                    <SelectItem value="OTHER">
                      Other
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reference Number</Label>

                <Input
                  value={paymentForm.referenceNumber}
                  onChange={(e) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      referenceNumber: e.target.value,
                    }))
                  }
                  placeholder="UTR / cheque number"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>

                <Input
                  value={paymentForm.notes}
                  onChange={(e) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Supporting Document</Label>

                <input
                    id="vendor-payment-document"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => {
                    const file = e.target.files?.[0]

                    if (!file) return

                    const allowedTypes = [
                        'application/pdf',
                        'image/jpeg',
                        'image/png',
                        'image/webp',
                    ]

                    const maxSize = 10 * 1024 * 1024

                    if (!allowedTypes.includes(file.type)) {
                        toast.error(
                        'Only PDF, JPG, PNG and WEBP files are allowed'
                        )
                        e.target.value = ''
                        return
                    }

                    if (file.size > maxSize) {
                        toast.error(
                        'Supporting document cannot exceed 10 MB'
                        )
                        e.target.value = ''
                        return
                    }

                    if (paymentDocumentPreview) {
                        URL.revokeObjectURL(paymentDocumentPreview)
                    }

                    setPaymentDocument(file)

                    setPaymentDocumentPreview(
                        URL.createObjectURL(file)
                    )
                    }}
                />

                <label
                    htmlFor="vendor-payment-document"
                    className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-slate-300 rounded-xl px-4 py-4 cursor-pointer hover:border-[#08B6D8] hover:bg-slate-50 transition"
                >
                    <Plus className="h-4 w-4" />

                    <span className="text-sm font-medium text-slate-700">
                    {paymentDocument
                        ? 'Change Supporting Document'
                        : 'Upload Supporting Document'}
                    </span>
                </label>

                {paymentDocument && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">
                            {paymentDocument.name}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                            {(paymentDocument.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                        {paymentDocumentPreview && (
                            <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                window.open(
                                paymentDocumentPreview,
                                '_blank'
                                )
                            }}
                            >
                            Preview
                            </Button>
                        )}

                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                            if (paymentDocumentPreview) {
                                URL.revokeObjectURL(
                                paymentDocumentPreview
                                )
                            }

                            setPaymentDocument(null)
                            setPaymentDocumentPreview(null)

                            const input =
                                document.getElementById(
                                'vendor-payment-document'
                                ) as HTMLInputElement | null

                            if (input) {
                                input.value = ''
                            }
                            }}
                        >
                            Remove
                        </Button>
                        </div>
                    </div>

                    {paymentDocument.type.startsWith('image/') &&
                        paymentDocumentPreview && (
                        <div className="mt-3 rounded-lg overflow-hidden border bg-white">
                            <img
                            src={paymentDocumentPreview}
                            alt="Supporting document preview"
                            className="max-h-64 w-full object-contain"
                            />
                        </div>
                        )}

                    {paymentDocument.type === 'application/pdf' &&
                        paymentDocumentPreview && (
                        <div className="mt-3 rounded-lg overflow-hidden border bg-white">
                            <iframe
                            src={paymentDocumentPreview}
                            title="Supporting document preview"
                            className="w-full h-64"
                            />
                        </div>
                        )}
                    </div>
                )}
                </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button
                  variant="outline"
                  onClick={() => setPaymentOpen(false)}
                >
                  Cancel
                </Button>

                <Button
                  onClick={() => void handleRecordPayment()}
                  disabled={paymentSubmitting}
                >
                  {paymentSubmitting
                    ? 'Recording...'
                    : 'Record Payment'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment History */}
      <Dialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Payment History
            </DialogTitle>
          </DialogHeader>

          {selectedBill && (
            <div className="space-y-4">
              <div>
                <div className="font-semibold">
                  {selectedBill.billNumber}
                </div>

                <div className="text-sm text-slate-500">
                  {selectedBill.vendor?.name}
                </div>
              </div>

              {(selectedBill.payments || []).length === 0 ? (
                <div className="py-10 text-center text-slate-500">
                  No payments recorded.
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3">
                          Date
                        </th>
                        <th className="text-right px-4 py-3">
                          Amount
                        </th>
                        <th className="text-left px-4 py-3">
                          Method
                        </th>
                        <th className="text-left px-4 py-3">
                          Reference
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {selectedBill.payments?.map(
                        (payment) => (
                          <tr key={payment.id}>
                            <td className="px-4 py-3">
                              {formatDate(
                                payment.paymentDate
                              )}
                            </td>

                            <td className="px-4 py-3 text-right font-semibold">
                              {formatINR(
                                Number(payment.amount)
                              )}
                            </td>

                            <td className="px-4 py-3">
                              {payment.paymentMethod}
                            </td>

                            <td className="px-4 py-3">
                              {payment.referenceNumber || '—'}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">
        {label}
      </div>

      <div className="text-xl font-bold text-[#0B2148] mt-1">
        {value}
      </div>
    </div>
  )
}

function Detail({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">
        {label}
      </div>

      <div className="text-sm font-semibold text-slate-800 mt-1">
        {value}
      </div>
    </div>
  )
}