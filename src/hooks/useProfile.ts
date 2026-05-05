import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserPreferences {
  experience?: "beginner" | "intermediate" | "advanced";
  style?: "scalping" | "daytrading" | "swing";
  coins?: string[];
}

export interface Profile {
  id: string;
  user_id: string;
  onboarding_completed: boolean;
  user_preferences: UserPreferences;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setProfile({
        id: data.id,
        user_id: data.user_id,
        onboarding_completed: data.onboarding_completed,
        user_preferences: (data.user_preferences as UserPreferences) ?? {},
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const completeOnboarding = useCallback(
    async (prefs: UserPreferences) => {
      if (!user) return { error: new Error("Not authenticated") };
      const { error } = await supabase
        .from("profiles")
        .upsert(
          [
            {
              user_id: user.id,
              onboarding_completed: true,
              user_preferences: prefs as never,
            },
          ],
          { onConflict: "user_id" },
        );
      if (!error) await fetchProfile();
      return { error };
    },
    [user, fetchProfile],
  );

  return { profile, loading, completeOnboarding, refetch: fetchProfile };
}
