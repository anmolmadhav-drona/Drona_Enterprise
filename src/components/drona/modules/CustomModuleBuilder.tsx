'use client'

import React, { useState } from 'react'
import { Plus, Trash2, CheckCircle2, Sliders, Shield, Eye, FileText, ArrowRight, ArrowLeft, Sparkles, Building2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

type FieldDefinition = {
  id: string
  name: string
  type: 'Text' | 'Number' | 'Currency' | 'Date' | 'Dropdown' | 'Percentage' | 'Checkbox' | 'Long Text'
  required: boolean
  filterable: boolean
}

export function CustomModuleBuilder({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const [step, setStep] = useState(1)
  const [moduleName, setModuleName] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<FieldDefinition[]>([
    { id: '1', name: 'Entry Title', type: 'Text', required: true, filterable: true },
    { id: '2', name: 'Amount (INR)', type: 'Currency', required: true, filterable: true },
    { id: '3', name: 'Entry Date', type: 'Date', required: true, filterable: true },
  ])
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldDefinition['type']>('Currency')

  function handleAddField() {
    if (!newFieldName.trim()) return
    setFields([
      ...fields,
      {
        id: Date.now().toString(),
        name: newFieldName.trim(),
        type: newFieldType,
        required: true,
        filterable: true,
      },
    ])
    setNewFieldName('')
  }

  function handleRemoveField(id: string) {
    setFields(fields.filter((f) => f.id !== id))
  }

  function handleCreateModule() {
    if (!moduleName.trim()) {
      toast.error('Please enter a module name')
      return
    }
    toast.success(`Business Module "${moduleName}" initialized successfully!`)
    onOpenChange(false)
    setStep(1)
    setModuleName('')
    setDescription('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden border-slate-200 shadow-2xl rounded-2xl bg-white">
        {/* Wizard Header */}
        <div className="p-6 bg-gradient-to-r from-[#0B2148] via-[#102B63] to-[#08B6D8] text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#16C4E8]">
              <Sparkles className="h-4 w-4" /> Enterprise Module Builder
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/10">
              Step {step} of 5
            </span>
          </div>
          <DialogTitle className="text-xl font-bold text-white tracking-tight">
            Create Custom Business Module
          </DialogTitle>
          <DialogDescription className="text-slate-300 text-xs mt-1">
            Build custom operational tracking schemas (e.g., Vendor Costs, Equipment Leases, Project Budgets).
          </DialogDescription>

          {/* Step Stepper Pills */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10">
            {['Information', 'Fields Schema', 'Rules', 'Permissions', 'Preview'].map((title, idx) => {
              const cur = idx + 1
              const active = step === cur
              const done = step > cur
              return (
                <div
                  key={title}
                  className={`flex-1 flex items-center justify-center py-1 rounded text-[10px] font-bold transition ${
                    active
                      ? 'bg-[#08B6D8] text-[#0B2148]'
                      : done
                      ? 'bg-white/20 text-white'
                      : 'bg-white/5 text-white/50'
                  }`}
                >
                  {title}
                </div>
              )
            })}
          </div>
        </div>

        {/* Wizard Body Steps */}
        <div className="p-6 max-h-[60vh] overflow-y-auto scroll-thin space-y-4">
          {/* STEP 1: Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="modName" className="text-xs font-semibold text-slate-700">Module Name</Label>
                <Input
                  id="modName"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  placeholder="e.g., Marketing Expenses, Vendor Contracts, Fleet Maintenance"
                  className="h-10 border-slate-200 focus:border-[#08B6D8]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="modDesc" className="text-xs font-semibold text-slate-700">Module Description</Label>
                <Input
                  id="modDesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the operational cost or business data tracked in this module"
                  className="h-10 border-slate-200 focus:border-[#08B6D8]"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Fields Schema */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="Field name (e.g. Vendor Name, Billed Amount)"
                  className="h-9 text-xs"
                />
                <Select value={newFieldType} onValueChange={(v: any) => setNewFieldType(v)}>
                  <SelectTrigger className="h-9 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Text">Text</SelectItem>
                    <SelectItem value="Number">Number</SelectItem>
                    <SelectItem value="Currency">Currency (INR)</SelectItem>
                    <SelectItem value="Date">Date</SelectItem>
                    <SelectItem value="Percentage">Percentage %</SelectItem>
                    <SelectItem value="Dropdown">Dropdown</SelectItem>
                    <SelectItem value="Long Text">Long Text</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAddField} size="sm" className="h-9 bg-[#0B2148] text-white">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {fields.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-3 text-xs bg-slate-50/50">
                    <div>
                      <span className="font-semibold text-[#0B2148]">{f.name}</span>
                      <span className="ml-2 px-2 py-0.5 rounded bg-slate-200 text-[10px] text-slate-700">{f.type}</span>
                    </div>
                    <button onClick={() => handleRemoveField(f.id)} className="text-slate-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Rules */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-[#0B2148]">Field Rules & Calculation Behaviors</div>
              {fields.map((f) => (
                <div key={f.id} className="p-3 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800">{f.name}</span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox checked={f.required} onCheckedChange={(val) => {
                        setFields(fields.map((item) => item.id === f.id ? { ...item, required: !!val } : item))
                      }} />
                      <span>Required</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox checked={f.filterable} onCheckedChange={(val) => {
                        setFields(fields.map((item) => item.id === f.id ? { ...item, filterable: !!val } : item))
                      }} />
                      <span>Filterable</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 4: Permissions */}
          {step === 4 && (
            <div className="space-y-3 text-xs">
              <div className="font-bold text-[#0B2148]">Access Control & Role Permissions</div>
              <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/50">
                <div className="flex items-center justify-between font-semibold border-b pb-1 text-slate-600">
                  <span>Role</span>
                  <span>Permissions</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Group Admin</span>
                  <span className="text-emerald-600 font-bold">Full Access (View, Create, Edit, Delete)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Company Admin</span>
                  <span className="text-emerald-600 font-bold">Tenant Access (View, Create, Edit)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Standard User</span>
                  <span className="text-slate-500 font-bold">View Only</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Live Preview */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="p-4 border border-emerald-200 rounded-2xl bg-emerald-50/50 text-xs space-y-2">
                <div className="font-bold text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Module Schema Ready
                </div>
                <div>Module: <strong className="text-[#0B2148]">{moduleName || 'New Custom Module'}</strong></div>
                <div>Fields Configured: <strong>{fields.length} fields</strong></div>
              </div>

              <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-3">
                <div className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">Form Input Preview</div>
                <div className="grid grid-cols-2 gap-3">
                  {fields.map((f) => (
                    <div key={f.id} className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-700">{f.name} {f.required && '*'}</Label>
                      <Input placeholder={`Enter ${f.name.toLowerCase()}`} disabled className="h-8 text-xs bg-slate-50" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer */}
        <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          {step > 1 ? (
            <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} className="gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
          ) : <div />}

          {step < 5 ? (
            <Button size="sm" onClick={() => setStep(step + 1)} className="bg-[#0B2148] text-white gap-1">
              Next Step <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleCreateModule} className="bg-[#08B6D8] hover:bg-[#16C4E8] text-[#0B2148] font-bold gap-1 shadow-md">
              <Sparkles className="h-3.5 w-3.5" /> Create & Deploy Module
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
