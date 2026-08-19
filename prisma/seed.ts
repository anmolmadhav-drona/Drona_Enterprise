/**
 * Seed script for Drona Enterprises - Multi-Tenant Profitability System.
 * Creates the full sample dataset shown in the design diagram:
 *   - Parent: Drona Enterprises
 *   - Tenants: Drona Logitech, Drona Valuechain
 *   - Reference data, clients, revenue, employees, costs, allocations, expenses.
 *
 * Run with: bun run db:seed
 */
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import argon2 from 'argon2'

const db = new PrismaClient()

async function hashPassword(pw: string): Promise<string> {
  return argon2.hash(pw, {
    type: argon2.argon2id,
  })
}

async function main() {
  console.log('Seeding Drona Enterprises database...')

  // -------- Reference data --------
  const clientTypes = await db.$transaction([
    db.clientType.upsert({ where: { name: 'Enterprise' }, create: { name: 'Enterprise' }, update: {} }),
    db.clientType.upsert({ where: { name: 'SMB' }, create: { name: 'SMB' }, update: {} }),
    db.clientType.upsert({ where: { name: 'Strategic' }, create: { name: 'Strategic' }, update: {} }),
    db.clientType.upsert({ where: { name: 'Retail' }, create: { name: 'Retail' }, update: {} }),
  ])
  const [enterprise, smb, strategic] = clientTypes

  const locations = await db.$transaction([
    db.location.upsert({ where: { name: 'Mumbai' }, create: { name: 'Mumbai', country: 'India' }, update: {} }),
    db.location.upsert({ where: { name: 'Bengaluru' }, create: { name: 'Bengaluru', country: 'India' }, update: {} }),
    db.location.upsert({ where: { name: 'Delhi' }, create: { name: 'Delhi', country: 'India' }, update: {} }),
    db.location.upsert({ where: { name: 'Hyderabad' }, create: { name: 'Hyderabad', country: 'India' }, update: {} }),
    db.location.upsert({ where: { name: 'Pune' }, create: { name: 'Pune', country: 'India' }, update: {} }),
  ])
  const [mumbai, bengaluru, delhi, hyderabad, pune] = locations

  const empTypes = await db.$transaction([
    db.employeeType.upsert({ where: { name: 'Full-time' }, create: { name: 'Full-time' }, update: {} }),
    db.employeeType.upsert({ where: { name: 'Part-time' }, create: { name: 'Part-time' }, update: {} }),
    db.employeeType.upsert({ where: { name: 'Contractor' }, create: { name: 'Contractor' }, update: {} }),
  ])
  const [fullTime, partTime, contractor] = empTypes

  const departments = await db.$transaction([
    db.department.upsert({ where: { name: 'Engineering' }, create: { name: 'Engineering' }, update: {} }),
    db.department.upsert({ where: { name: 'Sales' }, create: { name: 'Sales' }, update: {} }),
    db.department.upsert({ where: { name: 'Delivery' }, create: { name: 'Delivery' }, update: {} }),
    db.department.upsert({ where: { name: 'Operations' }, create: { name: 'Operations' }, update: {} }),
    db.department.upsert({ where: { name: 'HR' }, create: { name: 'HR' }, update: {} }),
    db.department.upsert({ where: { name: 'Finance' }, create: { name: 'Finance' }, update: {} }),
  ])
  const [engDept, salesDept, deliveryDept, opsDept, hrDept, finDept] = departments

  // -------- Companies (Parent + 2 Tenants) --------
  const parent = await db.company.upsert({
    where: { code: 'DRONA-ENT' },
    create: { name: 'Drona Enterprises', code: 'DRONA-ENT', type: 'PARENT', status: 'ACTIVE' },
    update: { type: 'PARENT' },
  })
  const logitech = await db.company.upsert({
    where: { code: 'DRONA-LOG' },
    create: { name: 'Drona Logitech', code: 'DRONA-LOG', type: 'TENANT', parentId: parent.id, status: 'ACTIVE' },
    update: { parentId: parent.id, type: 'TENANT' },
  })
  const valuechain = await db.company.upsert({
    where: { code: 'DRONA-VAL' },
    create: { name: 'Drona Valuechain', code: 'DRONA-VAL', type: 'TENANT', parentId: parent.id, status: 'ACTIVE' },
    update: { parentId: parent.id, type: 'TENANT' },
  })

  // -------- Users (one per role) --------
const users = [
  { name: 'Arjun Mehta', email: 'group.admin@drona.com', pw: 'admin123', role: 'GROUP_ADMIN', company: null },
  { name: 'Priya Nair', email: 'logitech.admin@drona.com', pw: 'admin123', role: 'COMPANY_ADMIN', company: logitech.id },
  { name: 'Rahul Sharma', email: 'valuechain.admin@drona.com', pw: 'admin123', role: 'COMPANY_ADMIN', company: valuechain.id },
  { name: 'Sneha Verma', email: 'user.logitech@drona.com', pw: 'user123', role: 'STANDARD_USER', company: logitech.id },
  { name: 'Karthik Rao', email: 'user.valuechain@drona.com', pw: 'user123', role: 'STANDARD_USER', company: valuechain.id },
]

for (const u of users) {
  const existing = await db.user.findUnique({
    where: { email: u.email },
  })

  if (!existing) {
    await db.user.create({
      data: {
        name: u.name,
        email: u.email,
        passwordHash: await hashPassword(u.pw),
        role: u.role,
        companyId: u.company,
      },
    })
  } else {
    await db.user.update({
      where: { email: u.email },
      data: {
        name: u.name,
        passwordHash: await hashPassword(u.pw),
        role: u.role,
        companyId: u.company,
        active: true,
      },
    })
  }
}

  // -------- Drona Logitech: Clients --------
  const logitechClients = await Promise.all([
    db.client.upsert({ where: { companyId_code: { companyId: logitech.id, code: 'LOG-CL-A' } },
      update: {}, create: { companyId: logitech.id, name: 'Acme Manufacturing', code: 'LOG-CL-A', clientTypeId: enterprise.id, locationId: mumbai.id, contractValue: 4_50_00_000, contactName: 'Rajesh Kumar', contactEmail: 'rajesh@acme.com' } }),
    db.client.upsert({ where: { companyId_code: { companyId: logitech.id, code: 'LOG-CL-B' } },
      update: {}, create: { companyId: logitech.id, name: 'TechNova Solutions', code: 'LOG-CL-B', clientTypeId: strategic.id, locationId: bengaluru.id, contractValue: 3_20_00_000, contactName: 'Anjali Gupta', contactEmail: 'anjali@technova.com' } }),
    db.client.upsert({ where: { companyId_code: { companyId: logitech.id, code: 'LOG-CL-C' } },
      update: {}, create: { companyId: logitech.id, name: 'Greenfield Retail', code: 'LOG-CL-C', clientTypeId: smb.id, locationId: delhi.id, contractValue: 1_85_00_000, contactName: 'Vikram Singh', contactEmail: 'vikram@greenfield.com' } }),
    db.client.upsert({ where: { companyId_code: { companyId: logitech.id, code: 'LOG-CL-D' } },
      update: {}, create: { companyId: logitech.id, name: 'Bluewave Logistics', code: 'LOG-CL-D', clientTypeId: smb.id, locationId: hyderabad.id, contractValue: 95_00_000, contactName: 'Meena Iyer', contactEmail: 'meena@bluewave.com' } }),
  ])

  // -------- Drona Valuechain: Clients --------
  const valuechainClients = await Promise.all([
    db.client.upsert({ where: { companyId_code: { companyId: valuechain.id, code: 'VAL-CL-A' } },
      update: {}, create: { companyId: valuechain.id, name: 'Pinnacle Pharma', code: 'VAL-CL-A', clientTypeId: enterprise.id, locationId: mumbai.id, contractValue: 5_20_00_000, contactName: 'Suresh Patel', contactEmail: 'suresh@pinnacle.com' } }),
    db.client.upsert({ where: { companyId_code: { companyId: valuechain.id, code: 'VAL-CL-B' } },
      update: {}, create: { companyId: valuechain.id, name: 'Orbit Aerospace', code: 'VAL-CL-B', clientTypeId: strategic.id, locationId: bengaluru.id, contractValue: 2_80_00_000, contactName: 'Lakshmi Rao', contactEmail: 'lakshmi@orbit.com' } }),
    db.client.upsert({ where: { companyId_code: { companyId: valuechain.id, code: 'VAL-CL-C' } },
      update: {}, create: { companyId: valuechain.id, name: 'Summit Foods', code: 'VAL-CL-C', clientTypeId: smb.id, locationId: pune.id, contractValue: 1_45_00_000, contactName: 'Aditya Joshi', contactEmail: 'aditya@summit.com' } }),
  ])

  // -------- Drona Logitech: Employees --------
  const logitechEmployees = await Promise.all([
    db.employee.upsert({ where: { companyId_code: { companyId: logitech.id, code: 'LOG-EMP-001' } },
      update: {}, create: { companyId: logitech.id, name: 'Arun Kumar', code: 'LOG-EMP-001', employeeTypeId: fullTime.id, departmentId: engDept.id, locationId: bengaluru.id, designation: 'Senior Engineer', salary: 18_00_000, joiningDate: new Date('2022-04-01') } }),
    db.employee.upsert({ where: { companyId_code: { companyId: logitech.id, code: 'LOG-EMP-002' } },
      update: {}, create: { companyId: logitech.id, name: 'Divya Menon', code: 'LOG-EMP-002', employeeTypeId: fullTime.id, departmentId: deliveryDept.id, locationId: mumbai.id, designation: 'Delivery Lead', salary: 22_00_000, joiningDate: new Date('2021-08-15') } }),
    db.employee.upsert({ where: { companyId_code: { companyId: logitech.id, code: 'LOG-EMP-003' } },
      update: {}, create: { companyId: logitech.id, name: 'Imran Khan', code: 'LOG-EMP-003', employeeTypeId: fullTime.id, departmentId: salesDept.id, locationId: delhi.id, designation: 'Account Manager', salary: 16_00_000, joiningDate: new Date('2023-02-10') } }),
    db.employee.upsert({ where: { companyId_code: { companyId: logitech.id, code: 'LOG-EMP-004' } },
      update: {}, create: { companyId: logitech.id, name: 'Pooja Reddy', code: 'LOG-EMP-004', employeeTypeId: fullTime.id, departmentId: engDept.id, locationId: bengaluru.id, designation: 'Tech Lead', salary: 26_00_000, joiningDate: new Date('2020-11-05') } }),
    db.employee.upsert({ where: { companyId_code: { companyId: logitech.id, code: 'LOG-EMP-005' } },
      update: {}, create: { companyId: logitech.id, name: 'Sai Teja', code: 'LOG-EMP-005', employeeTypeId: contractor.id, departmentId: deliveryDept.id, locationId: hyderabad.id, designation: 'QA Specialist', salary: 9_50_000, joiningDate: new Date('2023-06-20') } }),
  ])

  // -------- Drona Valuechain: Employees --------
  const valuechainEmployees = await Promise.all([
    db.employee.upsert({ where: { companyId_code: { companyId: valuechain.id, code: 'VAL-EMP-001' } },
      update: {}, create: { companyId: valuechain.id, name: 'Naveen Joshi', code: 'VAL-EMP-001', employeeTypeId: fullTime.id, departmentId: engDept.id, locationId: pune.id, designation: 'Engineering Manager', salary: 28_00_000, joiningDate: new Date('2020-05-12') } }),
    db.employee.upsert({ where: { companyId_code: { companyId: valuechain.id, code: 'VAL-EMP-002' } },
      update: {}, create: { companyId: valuechain.id, name: 'Ritika Shah', code: 'VAL-EMP-002', employeeTypeId: fullTime.id, departmentId: deliveryDept.id, locationId: mumbai.id, designation: 'Project Manager', salary: 24_00_000, joiningDate: new Date('2021-09-01') } }),
    db.employee.upsert({ where: { companyId_code: { companyId: valuechain.id, code: 'VAL-EMP-003' } },
      update: {}, create: { companyId: valuechain.id, name: 'Manish Gupta', code: 'VAL-EMP-003', employeeTypeId: fullTime.id, departmentId: salesDept.id, locationId: bengaluru.id, designation: 'Sales Director', salary: 30_00_000, joiningDate: new Date('2019-12-01') } }),
    db.employee.upsert({ where: { companyId_code: { companyId: valuechain.id, code: 'VAL-EMP-004' } },
      update: {}, create: { companyId: valuechain.id, name: 'Kavya Nair', code: 'VAL-EMP-004', employeeTypeId: fullTime.id, departmentId: opsDept.id, locationId: delhi.id, designation: 'Operations Lead', salary: 19_00_000, joiningDate: new Date('2022-03-15') } }),
  ])

  // -------- Revenue entries (monthly across 6 months Apr-Sep for FY) --------
  // Amounts in INR. Total target ~10.5 Cr for both companies combined.
  async function addRevenue(clientId: string, months: { m: number; amt: number }[]) {
    for (const { m, amt } of months) {
      const date = new Date(2024, m, 10)
      const inv = `INV-${clientId.slice(-4).toUpperCase()}-${m + 1}-2024`
      const exists = await db.revenue.findFirst({ where: { clientId, invoiceNo: inv } })
      if (exists) continue
      await db.revenue.create({
        data: { clientId, date, invoiceNo: inv, description: 'Monthly services invoice', quantity: 1, rate: amt, amount: amt },
      })
    }
  }

  // Logitech clients revenue (Apr..Sep 2024) - amounts roughly proportional to contract value
  await addRevenue(logitechClients[0].id, [
    { m: 3, amt: 75_00_000 }, { m: 4, amt: 78_00_000 }, { m: 5, amt: 82_00_000 },
    { m: 6, amt: 80_00_000 }, { m: 7, amt: 85_00_000 }, { m: 8, amt: 88_00_000 },
  ])
  await addRevenue(logitechClients[1].id, [
    { m: 3, amt: 52_00_000 }, { m: 4, amt: 55_00_000 }, { m: 5, amt: 58_00_000 },
    { m: 6, amt: 56_00_000 }, { m: 7, amt: 60_00_000 }, { m: 8, amt: 62_00_000 },
  ])
  await addRevenue(logitechClients[2].id, [
    { m: 3, amt: 28_00_000 }, { m: 4, amt: 30_00_000 }, { m: 5, amt: 32_00_000 },
    { m: 6, amt: 31_00_000 }, { m: 7, amt: 33_00_000 }, { m: 8, amt: 35_00_000 },
  ])
  await addRevenue(logitechClients[3].id, [
    { m: 3, amt: 14_00_000 }, { m: 4, amt: 15_00_000 }, { m: 5, amt: 16_00_000 },
    { m: 6, amt: 15_00_000 }, { m: 7, amt: 17_00_000 }, { m: 8, amt: 18_00_000 },
  ])

  // Valuechain clients revenue
  await addRevenue(valuechainClients[0].id, [
    { m: 3, amt: 88_00_000 }, { m: 4, amt: 90_00_000 }, { m: 5, amt: 92_00_000 },
    { m: 6, amt: 89_00_000 }, { m: 7, amt: 95_00_000 }, { m: 8, amt: 98_00_000 },
  ])
  await addRevenue(valuechainClients[1].id, [
    { m: 3, amt: 46_00_000 }, { m: 4, amt: 48_00_000 }, { m: 5, amt: 50_00_000 },
    { m: 6, amt: 47_00_000 }, { m: 7, amt: 52_00_000 }, { m: 8, amt: 54_00_000 },
  ])
  await addRevenue(valuechainClients[2].id, [
    { m: 3, amt: 22_00_000 }, { m: 4, amt: 24_00_000 }, { m: 5, amt: 25_00_000 },
    { m: 6, amt: 23_00_000 }, { m: 7, amt: 26_00_000 }, { m: 8, amt: 28_00_000 },
  ])

  // -------- Employee cost entries (monthly salary, allowances, benefits) --------
  async function addEmpCosts(empId: string, monthlySalary: number, months = [3, 4, 5, 6, 7, 8]) {
    for (const m of months) {
      const date = new Date(2024, m, 28)
      const salKey = `SAL-${empId.slice(-4)}-${m}`
      const allowKey = `ALW-${empId.slice(-4)}-${m}`
      const benKey = `BEN-${empId.slice(-4)}-${m}`
      const existsSal = await db.employeeCost.findFirst({ where: { employeeId: empId, costType: 'SALARY', date } })
      if (!existsSal) {
        await db.employeeCost.create({ data: { employeeId: empId, date, costType: 'SALARY', amount: monthlySalary, description: 'Monthly salary' } })
      }
      const existsAllow = await db.employeeCost.findFirst({ where: { employeeId: empId, costType: 'ALLOWANCE', date } })
      if (!existsAllow) {
        await db.employeeCost.create({ data: { employeeId: empId, date, costType: 'ALLOWANCE', amount: Math.round(monthlySalary * 0.2), description: 'HRA & travel allowance' } })
      }
      const existsBen = await db.employeeCost.findFirst({ where: { employeeId: empId, costType: 'BENEFIT', date } })
      if (!existsBen) {
        await db.employeeCost.create({ data: { employeeId: empId, date, costType: 'BENEFIT', amount: Math.round(monthlySalary * 0.08), description: 'Health & PF benefits' } })
      }
    }
  }

  for (const emp of logitechEmployees) {
    await addEmpCosts(emp.id, Math.round(emp.salary / 12))
  }
  for (const emp of valuechainEmployees) {
    await addEmpCosts(emp.id, Math.round(emp.salary / 12))
  }

  // -------- Employee-Client Allocations --------
  // Logitech: each employee split across clients (allocation example from spec)
  const allocSeed = [
    [logitechEmployees[0].id, logitechClients[0].id, 60],
    [logitechEmployees[0].id, logitechClients[1].id, 40],
    [logitechEmployees[1].id, logitechClients[0].id, 50],
    [logitechEmployees[1].id, logitechClients[2].id, 50],
    [logitechEmployees[2].id, logitechClients[1].id, 70],
    [logitechEmployees[2].id, logitechClients[3].id, 30],
    [logitechEmployees[3].id, logitechClients[0].id, 80],
    [logitechEmployees[3].id, logitechClients[1].id, 20],
    [logitechEmployees[4].id, logitechClients[2].id, 60],
    [logitechEmployees[4].id, logitechClients[3].id, 40],
    [valuechainEmployees[0].id, valuechainClients[0].id, 70],
    [valuechainEmployees[0].id, valuechainClients[1].id, 30],
    [valuechainEmployees[1].id, valuechainClients[0].id, 60],
    [valuechainEmployees[1].id, valuechainClients[2].id, 40],
    [valuechainEmployees[2].id, valuechainClients[0].id, 50],
    [valuechainEmployees[2].id, valuechainClients[1].id, 30],
    [valuechainEmployees[2].id, valuechainClients[2].id, 20],
    [valuechainEmployees[3].id, valuechainClients[0].id, 40],
    [valuechainEmployees[3].id, valuechainClients[2].id, 60],
  ]
  for (const [empId, clientId, pct] of allocSeed) {
    const existing = await db.employeeClientAllocation.findFirst({
      where: { employeeId: empId as string, clientId: clientId as string },
    })
    if (!existing) {
      await db.employeeClientAllocation.create({
        data: { employeeId: empId as string, clientId: clientId as string, allocationPercent: pct as number, startDate: new Date('2024-04-01') },
      })
    } else {
      await db.employeeClientAllocation.update({
        where: { id: existing.id },
        data: { allocationPercent: pct as number },
      })
    }
  }

  // -------- Expense Categories + Expenses --------
  const logitechCats = await Promise.all([
    db.expenseCategory.upsert({ where: { companyId_name: { companyId: logitech.id, name: 'Rent' } }, update: {}, create: { companyId: logitech.id, name: 'Rent', type: 'ADMINISTRATIVE' } }),
    db.expenseCategory.upsert({ where: { companyId_name: { companyId: logitech.id, name: 'Utilities' } }, update: {}, create: { companyId: logitech.id, name: 'Utilities', type: 'OPERATIONAL' } }),
    db.expenseCategory.upsert({ where: { companyId_name: { companyId: logitech.id, name: 'Travel' } }, update: {}, create: { companyId: logitech.id, name: 'Travel', type: 'OPERATIONAL' } }),
    db.expenseCategory.upsert({ where: { companyId_name: { companyId: logitech.id, name: 'Software Licenses' } }, update: {}, create: { companyId: logitech.id, name: 'Software Licenses', type: 'OPERATIONAL' } }),
    db.expenseCategory.upsert({ where: { companyId_name: { companyId: logitech.id, name: 'Marketing' } }, update: {}, create: { companyId: logitech.id, name: 'Marketing', type: 'ADMINISTRATIVE' } }),
  ])
  const valuechainCats = await Promise.all([
    db.expenseCategory.upsert({ where: { companyId_name: { companyId: valuechain.id, name: 'Rent' } }, update: {}, create: { companyId: valuechain.id, name: 'Rent', type: 'ADMINISTRATIVE' } }),
    db.expenseCategory.upsert({ where: { companyId_name: { companyId: valuechain.id, name: 'Utilities' } }, update: {}, create: { companyId: valuechain.id, name: 'Utilities', type: 'OPERATIONAL' } }),
    db.expenseCategory.upsert({ where: { companyId_name: { companyId: valuechain.id, name: 'Travel' } }, update: {}, create: { companyId: valuechain.id, name: 'Travel', type: 'OPERATIONAL' } }),
    db.expenseCategory.upsert({ where: { companyId_name: { companyId: valuechain.id, name: 'Cloud Infrastructure' } }, update: {}, create: { companyId: valuechain.id, name: 'Cloud Infrastructure', type: 'OPERATIONAL' } }),
    db.expenseCategory.upsert({ where: { companyId_name: { companyId: valuechain.id, name: 'R&D' } }, update: {}, create: { companyId: valuechain.id, name: 'R&D', type: 'CAPITAL' } }),
  ])

  // Add monthly expenses per category (Apr-Sep 2024)
  async function addExpenses(companyId: string, cats: { id: string; name: string }[], monthly: Record<string, number>) {
    for (const cat of cats) {
      const amt = monthly[cat.name] ?? 5_00_000
      for (let m = 3; m <= 8; m++) {
        const date = new Date(2024, m, 5)
        const exists = await db.expense.findFirst({ where: { companyId, categoryId: cat.id, date } })
        if (!exists) {
          await db.expense.create({ data: { companyId, categoryId: cat.id, date, amount: amt, description: `${cat.name} for ${date.toLocaleString('en', { month: 'short' })} 2024` } })
        }
      }
    }
  }
  await addExpenses(logitech.id, logitechCats, { 'Rent': 12_00_000, 'Utilities': 3_50_000, 'Travel': 6_50_000, 'Software Licenses': 4_20_000, 'Marketing': 5_00_000 })
  await addExpenses(valuechain.id, valuechainCats, { 'Rent': 14_00_000, 'Utilities': 4_00_000, 'Travel': 7_00_000, 'Cloud Infrastructure': 9_50_000, 'R&D': 6_00_000 })

  console.log('✅ Seed complete.')
  console.log('   Parent:  ', parent.name)
  console.log('   Tenants: ', logitech.name, ',', valuechain.name)
  console.log('   Logitech clients:', logitechClients.length, '| employees:', logitechEmployees.length)
  console.log('   Valuechain clients:', valuechainClients.length, '| employees:', valuechainEmployees.length)
  console.log('   Default logins:')
  console.log('     group.admin@drona.com / admin123')
  console.log('     logitech.admin@drona.com / admin123')
  console.log('     valuechain.admin@drona.com / admin123')
  console.log('     user.logitech@drona.com / user123')
  console.log('     user.valuechain@drona.com / user123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
