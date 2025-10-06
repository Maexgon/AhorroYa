# **App Name**: Ahorro Ya

## Core Features:

- Multi-Tenant Support: Supports personal, family, and company tenants with role-based access control (Admin, Member, Superadmin) and invitation system.
- Expense Tracking: Add expenses with details like amount, currency, category, entity, and payment method. Automatic currency conversion to base currency.
- OCR Receipt Processing: Upload receipts, extract data using OCR via Docling to create expense drafts. Duplication detection.
- Budgeting: Create monthly budgets per category/subcategory. Rollover unused amounts. Trigger alerts based on budget usage levels.
- Reporting and Export: Dashboard with expense summaries and visualizations. Export data to Excel format for detailed analysis.
- Offline Support: Offline persistence using Firestore, allowing users to continue using the app without a stable internet connection.
- Generate insights: Use the transaction history to suggest possible budget re-allocations, or to predict overspending in certain categories. LLM reasons about whether this insights would be a useful 'tool' for the user, based on the user's individual spending profile.

## Style Guidelines:

- Primary color: Forest green (#00C2A8) to convey growth and financial well-being.
- Background color: Light gray (#F5F5F5) for a clean and neutral base.
- Accent color: Vivid orange (#FF6B00) for calls to action and important notifications.
- Body font: 'Montserrat', a sans-serif font for readability and a modern feel.
- Headline font: 'Aptos Display', also a sans-serif, providing clear hierarchy and style. Note: currently only Google Fonts are supported.
- Consistent and intuitive icons for expense categories and actions.
- Clean and intuitive layouts, prioritize key data like amount, date, and category.
- Subtle transitions for data updates and interactive elements, avoiding overly flashy animations.