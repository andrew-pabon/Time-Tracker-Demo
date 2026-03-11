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

  /** Fetch profile + role for a given auth user. */
  const fetchUserProfile = useCallback(
    async (authUser: User): Promise<UserProfile | null> => {
      try {
        // Fetch profile
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("id, email, full_name, avatar_url")
          .eq("id", authUser.id)
          .single();

        if (profileErr || !profile) {
          console.error("Failed to fetch profile:", profileErr);
          return null;
        }

        // Fetch role
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
  // Bootstrap: check existing session on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const effectId = Math.random().toString(36).slice(2, 6);
    console.log(`[auth:${effectId}] effect started`);

    async function doInit() {
      console.log(`[auth:${effectId}] getSession() start`);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log(`[auth:${effectId}] getSession() done, cancelled=${cancelled}, hasSession=${!!session?.user}`);

      if (cancelled) return;

      if (!session?.user) {
        setState({ session: null, user: null, isLoading: false, error: null });
        return;
      }

      console.log(`[auth:${effectId}] fetchUserProfile() start`);
      const user = await fetchUserProfile(session.user);
      console.log(`[auth:${effectId}] fetchUserProfile() done, cancelled=${cancelled}, user=${!!user}`);
      if (cancelled) return;

      if (!user) {
        console.log(`[auth:${effectId}] no profile — signing out locally`);
        await supabase.auth.signOut({ scope: "local" });
        if (!cancelled) {
          setState({ session: null, user: null, isLoading: false, error: null });
        }
        return;
      }

      setState({ session, user, isLoading: false, error: null });
    }

    async function init() {
      const timeout = new Promise<void>((_, reject) =>
        setTimeout(() => {
          console.log(`[auth:${effectId}] TIMEOUT fired`);
          reject(new Error("auth_timeout"));
        }, 6000)
      );
      try {
        await Promise.race([doInit(), timeout]);
        console.log(`[auth:${effectId}] init() resolved normally`);
      } catch (e) {
        console.log(`[auth:${effectId}] init() caught:`, e);
        await supabase.auth.signOut({ scope: "local" });
        console.log(`[auth:${effectId}] signOut done, cancelled=${cancelled}`);
        if (!cancelled) {
          setState({ session: null, user: null, isLoading: false, error: null });
          console.log(`[auth:${effectId}] setState(isLoading:false) called`);
        }
      }
    }

    init();
    return () => {
      console.log(`[auth:${effectId}] effect cleanup (cancelled=true)`);
      cancelled = true;
    };
  }, [fetchUserProfile]);

  // -------------------------------------------------------------------------
  // Listen for auth state changes (sign-in, sign-out, token refresh)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[auth:onAuthStateChange] event=${event}, hasSession=${!!session?.user}`);
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
        console.log(`[auth:onAuthStateChange] SIGNED_IN — fetching profile`);
        setState((prev) => ({ ...prev, isLoading: true }));
        const user = await fetchUserProfile(session.user);
        console.log(`[auth:onAuthStateChange] SIGNED_IN profile done, user=${!!user}`);
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
