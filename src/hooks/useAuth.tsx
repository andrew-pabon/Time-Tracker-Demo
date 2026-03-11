import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: UserRole;
}

interface AuthState {
  /** Supabase session. Null when not authenticated. */
  session: Session | null;
  /** Resolved user profile + role. Null while loading or when not authed. */
  user: UserProfile | null;
  /** True during initial session check and profile fetch. */
  isLoading: boolean;
  /** Auth error message, if any. */
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    isLoading: true,
    error: null,
  });

  /** Fetch (or create) profile + role for a given auth user. */
  const fetchUserProfile = useCallback(
    async (authUser: User): Promise<UserProfile | null> => {
      try {
        // Upsert profile — handles the case where the auth trigger didn't fire
        // (e.g. trigger wasn't installed when the user first signed up).
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .upsert(
            {
              id: authUser.id,
              email: authUser.email ?? "",
              full_name:
                authUser.user_metadata?.full_name ??
                authUser.user_metadata?.name ??
                null,
              avatar_url:
                authUser.user_metadata?.avatar_url ??
                authUser.user_metadata?.picture ??
                null,
            },
            { onConflict: "id", ignoreDuplicates: false }
          )
          .select("id, email, full_name, avatar_url")
          .single();

        if (profileErr || !profile) {
          console.error("Failed to upsert profile:", profileErr);
          return null;
        }

        // Fetch role — created by trigger on signup, or seed data for existing users.
        const { data: roleRow, error: roleErr } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", authUser.id)
          .single();

        if (roleErr || !roleRow) {
          console.error("Failed to fetch role:", roleErr);
          return null;
        }

        return {
          id: profile.id,
          email: profile.email,
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
          role: roleRow.role as UserRole,
        };
      } catch (err) {
        console.error("Unexpected error fetching user profile:", err);
        return null;
      }
    },
    []
  );

  // -------------------------------------------------------------------------
  // Listen for auth state changes (sign-in, sign-out, token refresh)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        setState({
          session: null,
          user: null,
          isLoading: false,
          error: null,
        });
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        // Token rotated — profile is unchanged, just update the session object.
        setState((prev) => ({ ...prev, session }));
        return;
      }

      if (event === "SIGNED_IN") {
        setState((prev) => ({ ...prev, isLoading: true }));
        // IMPORTANT: this callback must always complete — Supabase processes
        // onAuthStateChange callbacks sequentially, so if fetchUserProfile()
        // hangs (e.g. cold Supabase DB), signOut() cannot fire SIGNED_OUT and
        // the spinner never clears. The timeout guarantees the callback exits.
        const user = await Promise.race([
          fetchUserProfile(session.user),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
        ]);
        setState({
          session,
          user,
          isLoading: false,
          error: user ? null : "Failed to load user profile.",
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const signInWithGoogle = useCallback(async () => {
    setState((prev) => ({ ...prev, error: null }));
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      setState((prev) => ({ ...prev, error: error.message }));
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // State will be cleared by the onAuthStateChange listener.
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
