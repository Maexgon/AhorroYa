

// This file is auto-generated from backend.json
// It is not meant to be edited by hand, but rather regenerated using Genkit
// whenever the backend.json file is updated.
export type Tenant = {
  id: string; // Unique identifier for the tenant.
  type: string; // Type of tenant (PERSONAL, FAMILY, COMPANY).
  name: string; // Name of the tenant.
  baseCurrency: string; // Base currency for the tenant (e.g., ARS).
  createdAt: string; // Timestamp of when the tenant was created.
  ownerUid: string; // User ID of the tenant owner. (Relationship: User 1:N Tenant)
  status: string; // The current status of the tenant (e.g., pending, active, expired).
  settings: string; // Settings for the tenant, such as quiet hours and rollover preferences. Represented as a JSON string.
};
export type License = {
  id: string; // Unique identifier for the license.
  tenantId: string; // Reference to the Tenant this license belongs to.
  plan: string; // The type of plan (personal, familiar, empresa).
  status: string; // The status of the license (active, expired).
  startDate: string; // The start date of the license.
  endDate: string; // The end date of the license.
  maxUsers: number; // The maximum number of users allowed by the license.
  paymentId?: string; // The ID of the payment transaction (e.g., from Stripe).
};
export type Membership = {
  tenantId: string; // Reference to Tenant. (Relationship: Tenant 1:N Membership)
  uid: string; // User ID of the member. (Relationship: User 1:N Membership)
  displayName: string; // Denormalized display name of the user for efficient lookups.
  email: string; // Denormalized email of the user for efficient lookups.
  role: string; // Role of the member within the tenant (owner, admin, member).
  status: string; // Status of the membership (active, invited, revoked).
  joinedAt: string; // Timestamp of when the user joined the tenant.
};
export type User = {
  uid: string; // Unique identifier for the user, matching the authentication UID.
  displayName: string; // Display name of the user.
  email: string; // Email address of the user.
  photoURL?: string; // URL of the user's profile photo.
  tenantIds?: string[]; // References to Tenants. (Relationship: User 1:N Tenant)
  isSuperadmin?: boolean; // Indicates if the user has superadmin privileges.
  address?: string; // The user's physical address.
  phone?: string; // The user's phone number.
};
export type Currency = {
  code: string; // Currency code (e.g., ARS, USD).
  name: string; // Name of the currency (e.g., Argentine Peso).
  exchangeRate?: number; // Exchange rate to the base currency.
};
export type FxRate = {
  tenantId: string; // Reference to Tenant. (Relationship: Tenant 1:N FxRate)
  code: string; // Currency code (e.g., USD).
  date: string; // Date of the exchange rate.
  rateToARS: number; // Exchange rate to ARS.
};
export type Category = {
  id: string; // Unique identifier for the category.
  tenantId: string; // Reference to Tenant. (Relationship: Tenant 1:N Category)
  name: string; // Name of the category.
  color: string; // Color associated with the category (hex code).
  order: number; // Order of the category.
};
export type Subcategory = {
  id: string; // Unique identifier for the subcategory.
  tenantId: string; // Reference to Tenant. (Relationship: Tenant 1:N Subcategory)
  categoryId: string; // Reference to Category. (Relationship: Category 1:N Subcategory)
  name: string; // Name of the subcategory.
  order: number; // Order of the subcategory.
};
export type Entity = {
  id: string; // Unique identifier for the entity.
  tenantId: string; // Reference to Tenant. (Relationship: Tenant 1:N Entity)
  cuit: string; // CUIT (tax ID) of the entity, unique per tenant.
  razonSocial: string; // Business name of the entity.
  tipo: string; // Type of entity (comercio, banco, servicio, otro).
  direccion?: string; // Address of the entity (optional).
  telefono?: string; // Phone number of the entity (optional).
  pendingCuit?: boolean; // Indicates if the CUIT is pending verification.
  createdAt: string; // Timestamp of when the entity was created.
  updatedAt: string; // Timestamp of when the entity was last updated.
};
export type Expense = {
  id: string; // Unique identifier for the expense.
  tenantId: string; // Reference to Tenant. (Relationship: Tenant 1:N Expense)
  userId: string; // Reference to User. (Relationship: User 1:N Expense)
  date: string; // Date of the expense.
  amount: number; // Amount of the expense.
  currency: string; // Currency of the expense.
  amountARS: number; // Amount of the expense in ARS.
  categoryId: string; // Reference to Category. (Relationship: Category 1:N Expense)
  subcategoryId?: string; // Reference to Subcategory. (Relationship: Subcategory 1:N Expense)
  entityId?: string; // Reference to Entity. (Relationship: Entity 1:N Expense)
  entityCuit?: string; // CUIT of the entity associated with the expense.
  entityName?: string; // Name of the entity associated with the expense.
  ivaPercent?: number; // IVA percentage applied to the expense.
  hasIva?: boolean; // Indicates if the expense includes IVA.
  paymentMethod: string; // Payment method used for the expense.
  isRecurring: boolean; // Indicates if the expense is recurring.
  notes?: string; // Additional notes about the expense.
  source: string; // Source of the expense data (manual, ocr).
  status: string; // Status of the expense (posted, draft).
  createdAt: string; // Timestamp of when the expense was created.
  updatedAt: string; // Timestamp of when the expense was last updated.
  deleted: boolean; // Indicates if the expense has been soft deleted.
  installments?: number; // Total number of installments.
  installmentNumber?: number; // The number of the current installment (e.g., 1 of 3).
  cardType?: string; // The type of credit card used (e.g., visa, mastercard).
};
export type Income = {
  id: string; // Unique identifier for the income.
  tenantId: string; // Reference to Tenant. (Relationship: Tenant 1:N Income)
  userId: string; // Reference to User. (Relationship: User 1:N Income)
  date: string; // Date of the income.
  amount: number; // Amount of the income.
  currency: string; // Currency of the income (e.g., ARS, USD).
  amountARS: number; // Amount of the income in ARS.
  category: "salarios" | "inversiones" | "premios o comisiones" | "otros"; // Category of the income.
  description?: string; // Description or notes about the income.
  source: string; // Source of the income data (e.g., manual).
  createdAt: string; // Timestamp of when the income was created.
  updatedAt: string; // Timestamp of when the income was last updated.
  deleted: boolean; // Indicates if the income has been soft deleted.
};
export type Budget = {
  id: string; // Unique identifier for the budget.
  tenantId: string; // Reference to Tenant. (Relationship: Tenant 1:N Budget)
  year: number; // Year of the budget.
  month: number; // Month of the budget (1-12).
  categoryId: string; // Reference to Category. (Relationship: Category 1:N Budget)
  subcategoryId?: string; // Reference to Subcategory. (Relationship: Subcategory 1:N Budget)
  amountARS: number; // Budget amount in ARS.
  rolloverFromPrevARS: number; // Amount rolled over from the previous month.
  description?: string; // Optional description for the budget.
};
export type Alert = {
  id: string; // Unique identifier for the alert.
  tenantId: string; // Reference to Tenant. (Relationship: Tenant 1:N Alert)
  type: string; // Type of alert (budget, recurring, ocr).
  level: number; // Alert level (e.g., 80 for 80% of budget).
  payload: string; // Details of the alert as a JSON string.
  status: string; // Status of the alert (pending, sent, dismissed).
  createdAt: string; // Timestamp of when the alert was created.
};
export type ReceiptRaw = {
  id: string; // Unique identifier for the raw receipt data.
  tenantId: string; // Reference to Tenant.
  userId: string; // Reference to User.
  expenseId?: string; // Reference to the created Expense document (optional).
  base64Content: string; // Base64 encoded content of the receipt file.
  fileType: string; // The type of the file (e.g., image, pdf).
  status: string; // The processing status (e.g., processing, processed, error).
  ocrPayload: string; // Raw OCR payload as a JSON string from the AI service.
  createdAt: string; // Timestamp of when the raw receipt data was created.
};
export type ReceiptFingerprint = {
  id: string; // Unique identifier composed as {tenantId}_{fingerprint}.
  exists: boolean; // Indicates if the fingerprint exists.
  createdAt: string; // Timestamp of when the fingerprint was created.
};
export type AuditLog = {
  id: string; // Unique identifier for the audit log entry.
  tenantId: string; // Reference to Tenant. (Relationship: Tenant 1:N AuditLog)
  entity: string; // Name of the entity being audited (e.g., expenses, entities).
  entityId: string; // ID of the entity being audited.
  action: string; // Action performed on the entity (create, update, delete, softdelete).
  before: string; // State of the entity before the action as a JSON string.
  after: string; // State of the entity after the action as a JSON string.
  userId: string; // Reference to User. (Relationship: User 1:N AuditLog)
  ts: string; // Timestamp of when the audit log entry was created.
};
export type Report = {
  id: string; // Unique identifier for the report.
  tenantId: string; // Reference to Tenant.
  userId: string; // Reference to User who generated the report.
  createdAt: string; // Timestamp of when the report was created.
  reportMonth: string; // The month the report covers (e.g., 'Octubre').
  reportYear: string; // The year the report covers (e.g., '2024').
  data: string; // The full JSON payload of the generated report.
};

    
