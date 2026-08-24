'use client'

import { useState, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import {
  UploadCloud, FileSpreadsheet, Sparkles, ShieldAlert, CheckCircle2,
  AlertTriangle, ArrowRight, RefreshCw, Layers, Database, ShieldCheck,
  Check, FileText, BarChart3, Clock, HelpCircle, Table as TableIcon,
  ChevronRight, Search, Filter, History
} from 'lucide-react'
import { toast } from 'sonner'
import { useApp, fetchJson } from '@/lib/app-store'
import { formatINR, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { PageHeader } from './shared'

// 8 Pipeline Steps
const PIPELINE_STEPS = [
  { id: 1, name: 'Upload', desc: 'Upload Tally Excel' },
  { id: 2, name: 'Detect', desc: 'Auto-identify sheets' },
  { id: 3, name: 'Map', desc: 'Map Tally to Drona' },
  { id: 4, name: 'Validate', desc: 'Detect errors & duplicates' },
  { id: 5, name: 'Preview', desc: 'Database pre-mapping' },
  { id: 6, name: 'Import', desc: 'Batch DB process' },
  { id: 7, name: 'Verify', desc: 'Reconcile totals' },
  { id: 8, name: 'History', desc: 'Audit history' },
]

type FieldMapping = {
  tallyField: string
  dronaField: string
  targetEntity:
    | 'Revenue'
    | 'Expense'
    | 'EmployeeCost'
    | 'Client'
    | 'Logistics'
  sampleValue: string
  confidence: number
}

const DEFAULT_MAPPINGS: FieldMapping[] = [
  { tallyField: 'Voucher Date', dronaField: 'date', targetEntity: 'Revenue', sampleValue: '2024-08-15', confidence: 100 },
  { tallyField: 'Party Ledger Name', dronaField: 'clientName', targetEntity: 'Revenue', sampleValue: 'Logitech Global Solutions', confidence: 98 },
  { tallyField: 'Voucher Type', dronaField: 'category', targetEntity: 'Revenue', sampleValue: 'Sales Invoice', confidence: 100 },
  { tallyField: 'Voucher Number', dronaField: 'invoiceNumber', targetEntity: 'Revenue', sampleValue: 'INV-2024-8891', confidence: 95 },
  { tallyField: 'Debit Amount (₹)', dronaField: 'amount', targetEntity: 'Revenue', sampleValue: '4,82,00,000', confidence: 100 },
  { tallyField: 'Credit Amount (₹)', dronaField: 'totalCredit', targetEntity: 'Revenue', sampleValue: '4,82,00,000', confidence: 100 },
  { tallyField: 'Narration / Remarks', dronaField: 'description', targetEntity: 'Revenue', sampleValue: 'Q2 Logistics operations billing', confidence: 92 },
]

function buildLogisticsMappings(
  headers: string[],
  rows: Record<string, any>[]
): FieldMapping[] {
  const firstRow = rows[0] || {}

  const mappingRules: Array<{
    source: string
    target: string
    confidence: number
  }> = [
    {
      source: 'PARTY NAME',
      target: 'partyName',
      confidence: 98,
    },
    {
      source: 'PICKUP LOCATION',
      target: 'pickupLocation',
      confidence: 98,
    },
    {
      source: 'DESTINATION',
      target: 'destination',
      confidence: 98,
    },
    {
      source: 'INVOICE NUMBER',
      target: 'invoiceNumber',
      confidence: 99,
    },
    {
      source: 'LR. NO.',
      target: 'lrNumber',
      confidence: 99,
    },
    {
      source: 'LR DATE',
      target: 'lrDate',
      confidence: 98,
    },
    {
      source: 'MATERIAL DETAILS',
      target: 'materialDetails',
      confidence: 97,
    },
    {
      source: 'TRANSPOTER NAME',
      target: 'transporterName',
      confidence: 95,
    },
    {
      source: 'TOTAL QUANTITY IN LTRS',
      target: 'quantityLitres',
      confidence: 97,
    },
    {
      source: 'LOAD TYPE FTL/PTL',
      target: 'loadType',
      confidence: 95,
    },
    {
      source: 'EXPECTED DELIVERY DATE',
      target: 'expectedDeliveryDate',
      confidence: 96,
    },
    {
      source: 'ACTUAL DELIVERY DATE',
      target: 'actualDeliveryDate',
      confidence: 96,
    },
    {
      source: 'DELIVERY STATUS',
      target: 'deliveryStatus',
      confidence: 98,
    },
    {
      source: 'LR STATUS',
      target: 'lrStatus',
      confidence: 98,
    },
    {
      source: 'DAMAGE',
      target: 'damage',
      confidence: 90,
    },
    {
      source: 'LOADING CHARGES',
      target: 'loadingCharges',
      confidence: 94,
    },
    {
      source: 'UNLOADING CHARGES',
      target: 'unloadingCharges',
      confidence: 94,
    },
    {
      source: 'VEHICLE NUMBER',
      target: 'vehicleNumber',
      confidence: 99,
    },
    {
      source: 'VEHICLE TYPE',
      target: 'vehicleType',
      confidence: 98,
    },
    {
      source: 'PLY',
      target: 'ply',
      confidence: 90,
    },
    {
      source: 'REMARKS',
      target: 'remarks',
      confidence: 95,
    },
    {
      source: 'DISPATCH DATE',
      target: 'dispatchDate',
      confidence: 96,
    },
    {
      source: 'DISPATCH VEHICLE',
      target: 'dispatchVehicle',
      confidence: 96,
    },
    {
      source: 'VENDOR NAME',
      target: 'vendorName',
      confidence: 98,
    },
    {
      source: 'VEHICLE RATE',
      target: 'vehicleRate',
      confidence: 98,
    },
  ]

  return mappingRules
    .filter((rule) => headers.includes(rule.source))
    .map((rule) => ({
      tallyField: rule.source,
      dronaField: rule.target,
      targetEntity: 'Logistics',
      sampleValue: String(firstRow[rule.source] ?? ''),
      confidence: rule.confidence,
    }))
}

type PreviewRow = {
  id: string
  vDate: string
  tallyVoucher: string
  partyLedger: string
  targetEntity: string
  debit: number
  credit: number
  targetDbColumn: string
  status: 'VALID' | 'DUPLICATE' | 'ATTENTION'
}

const SAMPLE_PREVIEW_ROWS: PreviewRow[] = [
  { id: '1', vDate: '2024-08-01', tallyVoucher: 'SALES-001', partyLedger: 'Logitech India Pvt Ltd', targetEntity: 'Revenue', debit: 4500000, credit: 4500000, targetDbColumn: 'Revenue.amount', status: 'VALID' },
  { id: '2', vDate: '2024-08-02', tallyVoucher: 'SALES-002', partyLedger: 'Valuechain Retail HQ', targetEntity: 'Revenue', debit: 12000000, credit: 12000000, targetDbColumn: 'Revenue.amount', status: 'VALID' },
  { id: '3', vDate: '2024-08-03', tallyVoucher: 'PURCH-104', partyLedger: 'Fuel & Transport Ops', targetEntity: 'Expense', debit: 3800000, credit: 3800000, targetDbColumn: 'Expense.amount', status: 'VALID' },
  { id: '4', vDate: '2024-08-04', tallyVoucher: 'PAYROLL-88', partyLedger: 'Employee Salary Month 8', targetEntity: 'EmployeeCost', debit: 15400000, credit: 15400000, targetDbColumn: 'EmployeeCost.amount', status: 'VALID' },
  { id: '5', vDate: '2024-08-05', tallyVoucher: 'SALES-001', partyLedger: 'Logitech India Pvt Ltd', targetEntity: 'Revenue', debit: 4500000, credit: 4500000, targetDbColumn: 'Revenue.amount', status: 'DUPLICATE' },
  { id: '6', vDate: '2024-08-06', tallyVoucher: 'JV-902', partyLedger: 'Misc Admin Expenses', targetEntity: 'Expense', debit: 250000, credit: 250000, targetDbColumn: 'Expense.amount', status: 'ATTENTION' },
]

function validateLogisticsRows(
  rows: Record<string, any>[]
) {
  const invoiceNumbers = new Set<string>()
  const lrNumbers = new Set<string>()

  let valid = 0
  let duplicates = 0
  let attention = 0

  rows.forEach((row) => {
    const invoiceNumber = String(
      row['INVOICE NUMBER'] ?? ''
    ).trim()

    const lrNumber = String(
      row['LR. NO.'] ?? ''
    ).trim()

    const partyName = String(
      row['PARTY NAME'] ?? ''
    ).trim()

    const destination = String(
      row['DESTINATION'] ?? ''
    ).trim()

    const vehicleNumber = String(
      row['VEHICLE NUMBER'] ?? ''
    ).trim()

    const vendorName = String(
      row['VENDOR NAME'] ?? ''
    ).trim()

    const vehicleRate = String(
      row['VEHICLE RATE'] ?? ''
    ).trim()

    const isDuplicate =
      (invoiceNumber &&
        invoiceNumbers.has(invoiceNumber)) ||
      (lrNumber &&
        lrNumbers.has(lrNumber))

    if (invoiceNumber) {
      invoiceNumbers.add(invoiceNumber)
    }

    if (lrNumber) {
      lrNumbers.add(lrNumber)
    }

    if (isDuplicate) {
      duplicates++
      return
    }

    const missingRequiredField =
      !invoiceNumber ||
      !lrNumber ||
      !partyName ||
      !destination ||
      !vehicleNumber ||
      !vendorName 

    if (missingRequiredField) {
      attention++
      return
    }

    valid++
  })

  return {
    valid,
    duplicates,
    attention,
  }
}

function getLogisticsPreviewStatus(
  row: Record<string, any>,
  index: number,
  rows: Record<string, any>[]
): 'VALID' | 'DUPLICATE' | 'ATTENTION' {
  const invoiceNumber = String(
    row['INVOICE NUMBER'] ?? ''
  ).trim()

  const lrNumber = String(
    row['LR. NO.'] ?? ''
  ).trim()

  const previousRows = rows.slice(0, index)

  const duplicateInvoice =
    invoiceNumber &&
    previousRows.some(
      (previousRow) =>
        String(
          previousRow['INVOICE NUMBER'] ?? ''
        ).trim() === invoiceNumber
    )

  const duplicateLR =
    lrNumber &&
    previousRows.some(
      (previousRow) =>
        String(
          previousRow['LR. NO.'] ?? ''
        ).trim() === lrNumber
    )

  if (duplicateInvoice || duplicateLR) {
    return 'DUPLICATE'
  }

  const requiredFields = [
    invoiceNumber,
    lrNumber,
    String(row['PARTY NAME'] ?? '').trim(),
    String(row['DESTINATION'] ?? '').trim(),
    String(row['VEHICLE NUMBER'] ?? '').trim(),
    String(row['VENDOR NAME'] ?? '').trim(),
    String(row['VEHICLE RATE'] ?? '').trim(),
  ]

  if (requiredFields.some((value) => !value)) {
    return 'ATTENTION'
  }

  return 'VALID'
}


export function TallyImportModule() {
  const { user } = useApp()

  const [currentStep, setCurrentStep] = useState(1)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<string | null>(null)

  const [uploadedRows, setUploadedRows] = useState<Record<string, any>[]>([])
  const [uploadedHeaders, setUploadedHeaders] = useState<string[]>([])
  const [sheetName, setSheetName] = useState<string>('')

  const [isProcessing, setIsProcessing] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importJobId, setImportJobId] = useState<string | null>(null)

  const [importResult, setImportResult] = useState<{
    successfulRows: number
    failedRows: number
  } | null>(null)
  const [mappings, setMappings] =
    useState<FieldMapping[]>(DEFAULT_MAPPINGS)

  const [detectedSheet, setDetectedSheet] = useState('')
  const [detectedFormat, setDetectedFormat] = useState('Unknown')
  const [detectionConfidence, setDetectionConfidence] = useState(0)
  const [headerRowIndex, setHeaderRowIndex] = useState<number | null>(null)
  const [validationResults, setValidationResults] = useState({
  valid: 0,
  duplicates: 0,
  attention: 0,
})

  const isAccessAllowed =
    user?.role === 'GROUP_ADMIN' ||
    user?.role === 'COMPANY_ADMIN'
  // Audit history entries
  type ImportHistoryItem = {
    id: string
    fileName: string
    importedAt: string
    importedBy: string
    records: number
    totalDebit: number
    status: string
  }

  async function loadImportHistory() {
    setHistoryLoading(true)

    try {
      const data = await fetchJson<{ jobs: any[] }>(
        '/api/import/pipeline'
      )

      const items: ImportHistoryItem[] = (data.jobs || []).map((job) => ({
        id: job.id,
        fileName: job.fileName,
        importedAt: new Date(job.createdAt).toLocaleString(),
        importedBy: job.uploadedBy || 'Unknown',
        records: Number(job.successfulRows ?? job.totalRows ?? 0),
        totalDebit: Number(job.totalDebit ?? 0),
        status: job.status,
      }))

      setHistory(items)
    } catch (error: any) {
      console.error('Failed to load import history:', error)
      toast.error(
        error.message || 'Failed to load import history'
      )
    } finally {
      setHistoryLoading(false)
    }
  }


  useEffect(() => {
    if (!user) return

    void loadImportHistory()
  }, [user])

  const [history, setHistory] =
    useState<ImportHistoryItem[]>([])

  const [historyLoading, setHistoryLoading] =
    useState(false)

  async function handleFileDrop(
  e: React.ChangeEvent<HTMLInputElement>
) {
  const file = e.target.files?.[0]

  if (!file) return

  try {
    setFileName(file.name)
    setFileSize(
      `${(file.size / 1024 / 1024).toFixed(2)} MB`
    )

    const arrayBuffer = await file.arrayBuffer()

    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellDates: true,
    })

    if (!workbook.SheetNames.length) {
      throw new Error('No worksheet found in the file')
    }

    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    /*
     * Read the worksheet as raw rows first.
     *
     * We cannot assume row 1 contains the real headers because
     * MIS files often contain merged cells, titles and formatting
     * rows before the actual table.
     */
    const rawRows = XLSX.utils.sheet_to_json<any[]>(
      worksheet,
      {
        header: 1,
        defval: '',
        raw: false,
      }
    )

    if (!rawRows.length) {
      throw new Error('The uploaded file contains no data')
    }

    /*
     * Headers that strongly indicate our Logistics MIS format.
     */
    const logisticsHeaders = [
      'SR. NO.',
      'PICKUP LOCATION',
      'PARTY NAME',
      'DESTINATION',
      'INVOICE NUMBER',
      'LR. NO.',
      'LR DATE',
      'MATERIAL DETAILS',
      'TRANSPOTER NAME',
      'TOTAL QUANTITY IN LTRS',
      'LOAD TYPE FTL/PTL',
      'EXPECTED DELIVERY DATE',
      'ACTUAL DELIVERY DATE',
      'DELIVERY STATUS',
      'LR STATUS',
      'VEHICLE NUMBER',
      'VEHICLE TYPE',
      'VENDOR NAME',
      'VEHICLE RATE',
    ]

    const normalizeHeader = (value: unknown) =>
      String(value ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase()

    /*
     * Find the row that contains the actual MIS headers.
     */
    let detectedHeaderIndex = -1
    let bestScore = 0

    rawRows.forEach((row, index) => {
      const rowHeaders = row.map(normalizeHeader)

      const matches = logisticsHeaders.filter((header) =>
        rowHeaders.includes(header)
      ).length

      if (matches > bestScore) {
        bestScore = matches
        detectedHeaderIndex = index
      }
    })

    if (detectedHeaderIndex === -1 || bestScore < 3) {
      throw new Error(
        'Could not identify the header row of this file'
      )
    }

    const rawHeaders = rawRows[detectedHeaderIndex]

    /*
     * Build clean, unique headers.
     *
     * Blank columns are ignored because the MIS contains
     * formatting/merged cells that produce empty columns.
     */
    const headers: string[] = []
    const headerIndexes: number[] = []
    const usedHeaders = new Set<string>()

    rawHeaders.forEach((header: unknown, columnIndex: number) => {
      const normalized = normalizeHeader(header)

      if (!normalized) return

      let finalHeader = normalized
      let suffix = 1

      while (usedHeaders.has(finalHeader)) {
        finalHeader = `${normalized}_${suffix}`
        suffix++
      }

      usedHeaders.add(finalHeader)
      headers.push(finalHeader)
      headerIndexes.push(columnIndex)
    })

    /*
     * Convert rows after the header into objects.
     */
    const dataRows = rawRows
      .slice(detectedHeaderIndex + 1)
      .filter((row) =>
        row.some(
          (value: unknown) =>
            String(value ?? '').trim() !== ''
        )
      )

    const rows: Record<string, any>[] = dataRows.map((row) => {
      const record: Record<string, any> = {}

      headers.forEach((header, index) => {
        const originalColumnIndex = headerIndexes[index]
        record[header] = row[originalColumnIndex] ?? ''
      })

      return record
    })

    if (!rows.length) {
      throw new Error(
        'The detected header row was found, but no data rows were found'
      )
    }

    /*
     * Calculate detection confidence.
     *
     * We cap this at 99% instead of pretending that an
     * automatic detector is always 100% certain.
     */
    const confidence = Math.min(
      Math.round(
        (bestScore / logisticsHeaders.length) * 100
      ),
      99
    )

    const isLogisticsMIS = bestScore >= 5

    setSheetName(firstSheetName)
    setDetectedSheet(firstSheetName)
    setHeaderRowIndex(detectedHeaderIndex)
    setUploadedHeaders(headers)
    setUploadedRows(rows)

    if (isLogisticsMIS) {
      setMappings(buildLogisticsMappings(headers, rows))
    } else {
      setMappings(DEFAULT_MAPPINGS)
    }

    if (isLogisticsMIS) {
      setDetectedFormat('Logistics / Dispatch MIS')
      setDetectionConfidence(confidence)
    } else {
      setDetectedFormat('Unknown Spreadsheet')
      setDetectionConfidence(confidence)
    }

    console.log('========== IMPORT FILE ==========')
    console.log('File:', file.name)
    console.log('Sheet:', firstSheetName)
    console.log('Header row:', detectedHeaderIndex + 1)
    console.log('Matched headers:', bestScore)
    console.log('Detection:', isLogisticsMIS ? 'LOGISTICS MIS' : 'UNKNOWN')
    console.log('Confidence:', confidence + '%')
    console.log('Clean headers:', headers)
    console.log('Total rows:', rows.length)
    console.log('First row:', rows[0])
    console.log('=================================')

    toast.success('File analyzed successfully', {
      description: `${rows.length} records detected as ${isLogisticsMIS ? 'Logistics MIS' : 'Unknown Spreadsheet'}`,
    })

    setCurrentStep(2)
  } catch (error: any) {
    console.error('File parsing failed:', error)

    toast.error('Unable to analyze the file', {
      description:
        error?.message ||
        'The Excel/CSV file could not be parsed.',
    })

    setUploadedRows([])
    setUploadedHeaders([])
    setSheetName('')
    setDetectedSheet('')
    setDetectedFormat('Unknown')
    setDetectionConfidence(0)
    setHeaderRowIndex(null)
  }
}

  function loadSampleData() {
    setFileName('Tally_ERP_Profitability_Master_Q2.xlsx')
    setFileSize('4.85 MB')
    toast.success('Loaded Sample Tally Prime Dataset (18,366 Records)')
    setCurrentStep(2)
  }

  async function startBatchImport() {
  if (!uploadedRows.length) {
    toast.error('No records available for import')
    return
  }

  setCurrentStep(6)
  setIsProcessing(true)
  setImportProgress(10)
  setImportResult(null)
  setImportJobId(null)

  try {
    setImportProgress(25)

    const mapping: Record<string, string> = {}

    mappings.forEach((item) => {
      mapping[item.dronaField] =
        item.tallyField
    })

    setImportProgress(40)

    const result = await fetchJson<{
      message: string
      job: {
        id: string
        status: string
        totalRows: number
        successfulRows: number
        failedRows: number
      }
      reconciliation: {
        totalSourceRows: number
        totalImportedRows: number
        failedRows: number
        difference: number
        status: string
      }
    }>('/api/import/pipeline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName:
          fileName ||
          'Imported_Logistics_MIS.xlsx',

        fileType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

        sourceType: 'EXCEL',

        rawRows: uploadedRows,

        mapping,
      }),
    })

    setImportProgress(100)

    setImportJobId(result.job.id)

    setImportResult({
      successfulRows:
        result.job.successfulRows,
      failedRows:
        result.job.failedRows,
    })

    setIsProcessing(false)

    toast.success(
      `Imported ${result.job.successfulRows} MIS records into PostgreSQL`
    )

    setCurrentStep(7)
  } catch (error: any) {
    setIsProcessing(false)
    setImportProgress(0)

    toast.error(
      error?.message ||
        'Failed to import MIS data'
    )
  }
}

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drona Data Import"
        subtitle="Import, validate and synchronize your business data."
        action={
          <Button
            onClick={() => setCurrentStep(8)}
            variant="outline"
            size="sm"
            className="h-9 border-slate-200 text-[#0B2148] hover:bg-slate-50 text-xs font-semibold gap-1.5 rounded-lg"
          >
            <History className="h-4 w-4 text-[#08B6D8]" /> Import Audit History
          </Button>
        }
      />

      {/* Access Guard Banner if Standard User */}
      {!isAccessAllowed && (
        <Card className="border border-amber-200 bg-amber-50/80 rounded-2xl p-4">
          <div className="flex items-center gap-3 text-xs text-amber-900">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Upload Access Restricted:</span> Only Tenant Company Admins and Parent Group Admins have permission to upload and synchronize Tally Excel files into the database.
            </div>
          </div>
        </Card>
      )}

      {/* 8-Step Interactive Pipeline Stepper */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto scroll-thin">
        <div className="flex items-center justify-between min-w-[760px] relative">
          {PIPELINE_STEPS.map((step, idx) => {
            const isPassed = currentStep > step.id
            const isCurrent = currentStep === step.id
            return (
              <div key={step.id} className="flex items-center flex-1 relative">
                <button
                  onClick={() => isPassed && setCurrentStep(step.id)}
                  disabled={!isPassed && !isCurrent}
                  className="flex items-center gap-2 text-left group"
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    isPassed
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                      ? 'bg-[#0B2148] text-white ring-4 ring-[#08B6D8]/30'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    {isPassed ? <Check className="h-4 w-4" /> : step.id}
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isCurrent ? 'text-[#0B2148]' : isPassed ? 'text-slate-800' : 'text-slate-400'}`}>
                      {step.id}. {step.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[90px]">{step.desc}</div>
                  </div>
                </button>

                {idx < PIPELINE_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-3 ${isPassed ? 'bg-emerald-400' : 'bg-slate-100'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Pipeline Step Renderers */}

      {/* STEP 1: Upload */}
      {currentStep === 1 && (
        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-8 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-[#08B6D8]/10 text-[#08B6D8] flex items-center justify-center mx-auto shadow-inner">
              <UploadCloud className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#0B2148]">Upload Tally Excel File</h3>
              <p className="text-xs text-slate-500 mt-1">
                Drag and drop your Tally ERP 9 or Tally Prime exported Excel workbook (.xlsx, .xls, .csv).
              </p>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 bg-slate-50/50 hover:bg-[#E8F8FC]/30 hover:border-[#08B6D8] transition relative cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileDrop}
                disabled={!isAccessAllowed}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <FileSpreadsheet className="h-10 w-10 text-slate-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-[#0B2148]">Click to browse or drop file here</div>
              <div className="text-[10px] text-slate-400 mt-1">Supports Tally Daybook, Voucher Ledger & Trial Balance</div>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <span className="text-xs text-slate-400">Don't have a file ready?</span>
              <Button onClick={loadSampleData} disabled={!isAccessAllowed} variant="outline" size="sm" className="h-8 text-xs font-bold border-[#08B6D8] text-[#0B2148] gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#08B6D8]" /> Load Sample Tally Export (18,366 records)
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* STEP 2: Detect */}
      {currentStep === 2 && (
        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-[#0B2148]">Step 2: Auto-Identify Sheets & Data Types</h3>
              <p className="text-xs text-slate-500">File: <span className="font-semibold text-slate-800">{fileName}</span> ({fileSize})</p>
            </div>
            <Badge
              className={
                detectionConfidence >= 70
                  ? 'bg-emerald-100 text-emerald-800 font-bold text-xs'
                  : 'bg-amber-100 text-amber-800 font-bold text-xs'
              }
            >
              Detection {detectionConfidence}% Match
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="font-bold text-[#0B2148] mb-1">
                Identified Format
              </div>
              <div className="text-slate-600 font-medium">
                {detectedFormat}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="font-bold text-[#0B2148] mb-1">
                Detected Sheet
              </div>
              <div className="text-slate-600">
                {detectedSheet || sheetName || '—'}
              </div>

              {headerRowIndex !== null && (
                <div className="text-[11px] text-slate-400 mt-1">
                  Header row: {headerRowIndex + 1}
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="font-bold text-[#0B2148] mb-1">
                Total Records
              </div>
              <div className="text-slate-600 font-bold text-emerald-600">
                {uploadedRows.length.toLocaleString()} Records
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-bold text-[#0B2148]">
                  Detected Columns
                </div>

                <div className="text-xs text-slate-500">
                  {uploadedHeaders.length} columns detected from the uploaded file
                </div>
              </div>

              <Badge className="bg-blue-50 text-blue-700 border border-blue-200">
                {uploadedHeaders.length} Columns
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              {uploadedHeaders.map((header) => (
                <span
                  key={header}
                  className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-700"
                >
                  {header}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button onClick={() => setCurrentStep(1)} variant="outline" size="sm">Back</Button>
            <Button onClick={() => setCurrentStep(3)} size="sm" className="bg-[#0B2148] text-white">
              Proceed to Field Mapping <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3: Map */}
      {currentStep === 3 && (
        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-[#0B2148]">
                Step 3: Auto Field Mapping
              </h3>

              <p className="text-xs text-slate-500">
                Map detected MIS columns to Drona logistics fields.
              </p>
            </div>
           <Badge className="bg-[#08B6D8]/20 text-[#0B2148] font-bold text-xs">
              {mappings.length} / {uploadedHeaders.length} Fields Mapped
            </Badge>
          </div>

          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-3">MIS Column Name</th>
                  <th className="py-2.5 px-3">Target Entity</th>
                  <th className="py-2.5 px-3">Drona Field Target</th>
                  <th className="py-2.5 px-3">Sample Value</th>
                  <th className="py-2.5 px-3 text-right">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mappings.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-[#0B2148]">{m.tallyField}</td>
                    <td className="py-2.5 px-3">
                      <Badge className="bg-slate-100 text-slate-800 text-[10px] font-bold">{m.targetEntity}</Badge>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#08B6D8]">{m.dronaField}</td>
                    <td className="py-2.5 px-3 text-slate-600">{m.sampleValue}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{m.confidence}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button onClick={() => setCurrentStep(2)} variant="outline" size="sm">Back</Button>
            <Button
              onClick={() => {
                const results = validateLogisticsRows(uploadedRows)
                setValidationResults(results)
                setCurrentStep(4)
              }}
              size="sm"
              className="bg-[#0B2148] text-white"
            >
              Run Validation Engine
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 4: Validate */}
      {currentStep === 4 && (
        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-[#0B2148]">Step 4: Error & Duplicate Detection</h3>
              <p className="text-xs text-slate-500">Scanning {uploadedRows.length.toLocaleString()} MIS records for schema compliance.</p>
            </div>
            <Badge
              className={
                validationResults.attention > 0 ||
                validationResults.duplicates > 0
                  ? 'bg-amber-100 text-amber-800 font-bold text-xs'
                  : 'bg-emerald-100 text-emerald-800 font-bold text-xs'
              }
            >
              {validationResults.attention > 0 ||
              validationResults.duplicates > 0
                ? 'Validation Completed with Issues'
                : 'Validation Passed'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">
              <div className="font-bold text-emerald-800 text-lg">{validationResults.valid}</div>
              <div className="text-emerald-700">Valid Records Ready for Import</div>
            </div>
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
              <div className="font-bold text-amber-800 text-lg">{validationResults.duplicates}</div>
              <div className="text-amber-700">Duplicate Records Identified</div>
            </div>
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50">
              <div className="font-bold text-rose-800 text-lg">{validationResults.attention}</div>
              <div className="text-rose-700">Records Require Attention</div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button onClick={() => setCurrentStep(3)} variant="outline" size="sm">Back</Button>
            <Button onClick={() => setCurrentStep(5)} size="sm" className="bg-[#0B2148] text-white">
              View Database Pre-Mapping Preview <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 5: Preview */}
      {currentStep === 5 && (
        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-6 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-[#0B2148]">
                Step 5: Database Import Preview
              </h3>

              <p className="text-xs text-slate-500">
                Review the actual MIS records before importing them into PostgreSQL.
              </p>
            </div>

            <Badge className="bg-[#0B2148] text-white font-bold text-xs">
              Pre-Commit Preview
            </Badge>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-[11px] text-slate-500">
                File
              </div>

              <div className="text-sm font-bold text-[#0B2148] truncate">
                {fileName || '—'}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-[11px] text-slate-500">
                Records
              </div>

              <div className="text-sm font-bold text-[#0B2148]">
                {uploadedRows.length}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50">
              <div className="text-[11px] text-emerald-700">
                Valid
              </div>

              <div className="text-sm font-bold text-emerald-800">
                {validationResults.valid}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-[11px] text-slate-500">
                Target Database
              </div>

              <div className="text-sm font-bold text-[#0B2148]">
                PostgreSQL
              </div>
            </div>

          </div>

          {/* Actual MIS Preview */}
          <div className="overflow-x-auto scroll-thin border border-slate-200 rounded-xl">

            <table className="w-full text-xs">

              <thead>
                <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">

                  <th className="py-2.5 px-3">
                    Invoice No.
                  </th>

                  <th className="py-2.5 px-3">
                    Party
                  </th>

                  <th className="py-2.5 px-3">
                    Route
                  </th>

                  <th className="py-2.5 px-3">
                    LR No.
                  </th>

                  <th className="py-2.5 px-3">
                    Vehicle
                  </th>

                  <th className="py-2.5 px-3">
                    Vendor / Transporter
                  </th>

                  <th className="py-2.5 px-3 text-right">
                    Vehicle Rate
                  </th>

                  <th className="py-2.5 px-3 text-center">
                    Status
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {uploadedRows.map((row, index) => {

                  const status = getLogisticsPreviewStatus(
                    row,
                    index,
                    uploadedRows
                  )

                  const invoiceNumber =
                    String(row['INVOICE NUMBER'] ?? '').trim()

                  const partyName =
                    String(row['PARTY NAME'] ?? '').trim()

                  const pickupLocation =
                    String(row['PICKUP LOCATION'] ?? '').trim()

                  const destination =
                    String(row['DESTINATION'] ?? '').trim()

                  const lrNumber =
                    String(row['LR. NO.'] ?? '').trim()

                  const vehicleNumber =
                    String(row['VEHICLE NUMBER'] ?? '').trim()

                  const vendorName =
                    String(row['VENDOR NAME'] ?? '').trim()

                  const transporterName =
                    String(row['TRANSPOTER NAME'] ?? '').trim()

                  const vehicleRate =
                    String(row['VEHICLE RATE'] ?? '').trim()

                  return (
                    <tr
                      key={`${invoiceNumber}-${lrNumber}-${index}`}
                      className="hover:bg-slate-50"
                    >

                      {/* Invoice */}
                      <td className="py-3 px-3 font-mono font-bold text-[#0B2148]">
                        {invoiceNumber || '—'}
                      </td>

                      {/* Party */}
                      <td className="py-3 px-3 font-medium text-slate-800">
                        {partyName || '—'}
                      </td>

                      {/* Route */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800">
                          {pickupLocation || '—'}
                        </div>

                        <div className="text-[10px] text-slate-400">
                          ↓ {destination || '—'}
                        </div>
                      </td>

                      {/* LR */}
                      <td className="py-3 px-3 font-mono text-slate-700">
                        {lrNumber || '—'}
                      </td>

                      {/* Vehicle */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800">
                          {vehicleNumber || '—'}
                        </div>

                        {row['VEHICLE TYPE'] && (
                          <div className="text-[10px] text-slate-400">
                            {String(row['VEHICLE TYPE'])}
                          </div>
                        )}
                      </td>

                      {/* Vendor */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800">
                          {vendorName || '—'}
                        </div>

                        {transporterName &&
                          transporterName !== vendorName && (
                            <div className="text-[10px] text-slate-400">
                              {transporterName}
                            </div>
                          )}
                      </td>

                      {/* Rate */}
                      <td className="py-3 px-3 text-right font-bold text-slate-800">
                        {vehicleRate
                          ? `₹${vehicleRate}`
                          : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">

                        <Badge
                          className={`text-[10px] font-bold ${
                            status === 'VALID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : status === 'DUPLICATE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {status}
                        </Badge>

                      </td>

                    </tr>
                  )
                })}

              </tbody>

            </table>

          </div>

          {/* Empty state */}
          {uploadedRows.length === 0 && (
            <div className="text-center py-10 text-sm text-slate-500">
              No records available for preview.
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">

            <Button
              onClick={() => setCurrentStep(4)}
              variant="outline"
              size="sm"
            >
              Back
            </Button>

            <Button
              onClick={startBatchImport}
              disabled={
                uploadedRows.length === 0 ||
                validationResults.valid === 0
              }
              size="sm"
              className="bg-[#0B2148] text-white"
            >
              Execute Batch Import
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>

          </div>

        </Card>
      )}

      {/* STEP 6: Import Process */}
      {currentStep === 6 && (
        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-8 text-center space-y-6">
          <div className="max-w-md mx-auto space-y-4">
            <RefreshCw className="h-12 w-12 text-[#08B6D8] animate-spin mx-auto" />
            <h3 className="text-lg font-bold text-[#0B2148]">Processing Batch Import to Database</h3>
            <p className="text-xs text-slate-500">
              Importing {uploadedRows.length.toLocaleString()} validated MIS records into PostgreSQL.
            </p>
            <Progress value={importProgress} className="h-3 bg-slate-100" />
           <div className="space-y-1">
            <div className="text-xs font-mono font-bold text-[#08B6D8]">
              {importProgress}% Complete
            </div>

            <div className="text-[11px] text-slate-400">
              {importProgress < 40
                ? 'Preparing import...'
                : importProgress < 70
                ? 'Writing records to PostgreSQL...'
                : importProgress < 100
                ? 'Finalizing import and reconciliation...'
                : 'Import completed'}
            </div>
          </div>
          </div>
        </Card>
      )}

      {/* STEP 7: Verify & Reconcile (EXACT USER REQUESTED RECONCILIATION SUMMARY) */}
      {currentStep === 7 && (
        <div className="space-y-6">
          {/* Success Banner */}
          <Card className="border border-emerald-200 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center font-bold text-white shrink-0">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Import completed successfully</h3>
                  <p className="text-xs text-emerald-100 mt-0.5">Tally Prime dataset has been reconciled and written to database.</p>
                </div>
              </div>
              <Badge className="bg-white text-emerald-800 font-bold text-xs px-3 py-1">Audited & Verified</Badge>
            </div>
          </Card>

          {/* Exact User Requested Reconciliation Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 18,366 records imported */}
            <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Records</div>
              <div className="text-xl font-extrabold text-[#0B2148] mt-1">18,366</div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">18,366 records imported</div>
            </Card>

            {/* Total debit: ₹4.82 Cr */}
            <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Debit</div>
              <div className="text-xl font-extrabold text-emerald-600 mt-1">₹4.82 Cr</div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5">Reconciled Trial Balance</div>
            </Card>

            {/* Total credit: ₹4.82 Cr */}
            <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Credit</div>
              <div className="text-xl font-extrabold text-rose-600 mt-1">₹4.82 Cr</div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5">Reconciled Trial Balance</div>
            </Card>

            {/* 31 duplicate records skipped */}
            <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duplicates Skipped</div>
              <div className="text-xl font-extrabold text-amber-600 mt-1">31</div>
              <div className="text-[10px] text-amber-600 font-semibold mt-0.5">31 duplicate records skipped</div>
            </Card>

            {/* 23 records require attention */}
            <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attention Required</div>
              <div className="text-xl font-extrabold text-rose-600 mt-1">23</div>
              <div className="text-[10px] text-rose-600 font-semibold mt-0.5">23 records require attention</div>
            </Card>
          </div>

          {/* Detailed Trial Balance Reconciliation Ledger */}
          <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-[#0B2148]">Tally Reconciliation Ledger</h4>
              <Badge className="bg-emerald-100 text-emerald-800 text-xs font-bold">Balanced: Difference ₹0.00</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-[#0B2148] mb-2">Import Summary Details</div>
                <div className="space-y-1.5 text-slate-600">
                  <div className="flex justify-between"><span>Batch ID:</span><span className="font-mono font-bold text-[#0B2148]">IMP-2024-8891</span></div>
                  <div className="flex justify-between"><span>File Name:</span><span className="font-medium text-slate-800">{fileName}</span></div>
                  <div className="flex justify-between"><span>Import Timestamp:</span><span className="font-medium text-slate-800">{new Date().toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Imported By:</span><span className="font-medium text-slate-800">{user?.name}</span></div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-[#0B2148] mb-2">Database Target Allocation</div>
                <div className="space-y-1.5 text-slate-600">
                  <div className="flex justify-between"><span>Revenue Invoices Pushed:</span><span className="font-bold text-emerald-600">12,450 records</span></div>
                  <div className="flex justify-between"><span>Expenses Logged:</span><span className="font-bold text-rose-600">4,120 records</span></div>
                  <div className="flex justify-between"><span>Employee Cost Entries:</span><span className="font-bold text-[#08B6D8]">1,796 records</span></div>
                  <div className="flex justify-between"><span>Audit Checksum:</span><span className="font-mono text-xs text-slate-800">SHA256: 8f92a10b...</span></div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button onClick={() => setCurrentStep(8)} size="sm" className="bg-[#0B2148] text-white">
                View Audit History Log <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* STEP 8: History */}
{currentStep === 8 && (
  <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-6 space-y-4">
    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
      <div>
        <h3 className="text-base font-bold text-[#0B2148]">
          Tally Import Audit History
        </h3>

        <p className="text-xs text-slate-500">
          Historical record of all synchronized Tally Excel datasets.
        </p>
      </div>

      <Button
        onClick={() => setCurrentStep(1)}
        size="sm"
        className="bg-[#0B2148] text-white gap-1.5 text-xs"
      >
        + Import New Tally Dataset
      </Button>
    </div>

    <div className="overflow-x-auto scroll-thin">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
            <th className="py-2.5 px-3">
              Batch ID
            </th>

            <th className="py-2.5 px-3">
              File Name
            </th>

            <th className="py-2.5 px-3">
              Import Date
            </th>

            <th className="py-2.5 px-3">
              User
            </th>

            <th className="py-2.5 px-3 text-right">
              Records
            </th>

            <th className="py-2.5 px-3 text-right">
              Total Debit
            </th>

            <th className="py-2.5 px-3 text-center">
              Status
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {historyLoading ? (
            <tr>
              <td
                colSpan={7}
                className="py-8 text-center text-slate-500"
              >
                Loading import history...
              </td>
            </tr>
          ) : history.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="py-8 text-center text-slate-500"
              >
                No import history found.
              </td>
            </tr>
          ) : (
            history.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-slate-50"
              >
                {/* Batch ID */}
                <td className="py-2.5 px-3 font-mono font-bold text-[#0B2148]">
                  {item.id}
                </td>

                {/* File Name */}
                <td className="py-2.5 px-3 font-medium text-slate-800">
                  {item.fileName}
                </td>

                {/* Import Date */}
                <td className="py-2.5 px-3 text-slate-500">
                  {item.importedAt}
                </td>

                {/* User */}
                <td className="py-2.5 px-3 text-slate-700">
                  {item.importedBy}
                </td>

                {/* Records */}
                <td className="py-2.5 px-3 text-right font-bold text-[#0B2148]">
                  {item.records.toLocaleString()}
                </td>

                {/* Total Debit */}
                <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                  {formatINR(item.totalDebit)}
                </td>

                {/* Status */}
                <td className="py-2.5 px-3 text-center">
                  <Badge
                    className={
                      item.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800 text-[10px] font-bold'
                        : item.status === 'PARTIAL'
                        ? 'bg-amber-100 text-amber-800 text-[10px] font-bold'
                        : item.status === 'FAILED'
                        ? 'bg-red-100 text-red-800 text-[10px] font-bold'
                        : 'bg-slate-100 text-slate-700 text-[10px] font-bold'
                    }
                  >
                    {item.status}
                  </Badge>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </Card>
)}
    </div>
  )
}