'use client';
import { useFirebase, UserHookResult } from '@/firebase/provider';

/**
 * A hook that provides access to the Firebase Auth service instance.
 *
 * @returns {Auth} The Firebase Auth service instance.
 * @throws {Error} If used outside of a `FirebaseProvider` or if the Auth service is not available.
 *
 * @example
 * ```tsx
 * import { useAuth } from '@/firebase/auth';
 * import { signOut } from 'firebase/auth';
 *
 * function SignOutButton() {
 *   const auth = useAuth();
 *   return <button onClick={() => signOut(auth)}>Sign Out</button>;
 * }
 * ```
 */
export const useAuth = () => {
  // This hook now correctly leverages the central `useFirebase` hook
  // to get the auth instance, ensuring consistency.
  const { auth } = useFirebase();
  if (!auth) {
    // This check is redundant if `useFirebase` already throws, but serves as a safeguard.
    throw new Error('Firebase Auth service is not available.');
  }
  return auth;
};

/**
 * A hook that provides the current authenticated user's state, including the user object,
 * loading status, and any authentication errors. It's a dedicated hook for user state
 * that abstracts the underlying context details.
 *
 * @returns {UserHookResult} An object containing:
 *  - `user`: The Firebase `User` object if authenticated, otherwise `null`.
 *  - `isUserLoading`: A boolean that is `true` during the initial auth state check.
 *  - `userError`: An `Error` object if there was an issue with the auth listener.
 *
 * @example
 * ```tsx
 * import { useUser } from '@/firebase/auth';
 *
 * function UserProfile() {
 *   const { user, isUserLoading } = useUser();
 *
 *   if (isUserLoading) return <p>Loading...</p>;
 *   if (!user) return <p>Please sign in.</p>;
 *
 *   return <h1>Welcome, {user.displayName}</h1>;
 * }
 * ```
 */
export const useUser = (): UserHookResult => {
  // This hook now correctly leverages the central `useFirebase` hook.
  const { user, isUserLoading, userError } = useFirebase();
  return { user, isUserLoading, userError };
};
