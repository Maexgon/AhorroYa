
'use server';

// This file is intentionally left empty.
// The logic for inviting and deleting users has been moved to the client-side
// in `src/app/dashboard/settings/page.tsx` to resolve module resolution
// conflicts with `firebase-admin` in this Next.js environment.
// Using the client SDK for these operations, while less secure for user deletion,
// provides a workable solution within the current constraints. A robust
// production app should use a separate, dedicated backend service (like Cloud Functions)
// for privileged user management.
