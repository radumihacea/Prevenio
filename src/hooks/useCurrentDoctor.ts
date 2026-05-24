import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CurrentDoctor = {
  id: string;
  slug: string;
  full_name: string;
  specialty: string;
  cabinet_name: string | null;
  parafa_code: string;
  auth_email: string | null;
  working_days: number[];
  work_start_time: string;
  work_end_time: string;
};

export function useCurrentDoctor() {
  return useQuery({
    queryKey: ["current-doctor"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CurrentDoctor | null> => {
      const { data: sess } = await supabase.auth.getSession();
      const email = sess.session?.user?.email;
      if (!email) return null;

      // Try by auth_email first
      const byEmail = await (supabase as any)
        .from("doctors")
        .select("*")
        .eq("auth_email", email.toLowerCase())
        .maybeSingle();
      if (byEmail.data) return byEmail.data as CurrentDoctor;

      // Fallback: extract parafa from synthetic email and match by parafa_code
      const parafa = email.split("@")[0]?.toUpperCase();
      if (!parafa) return null;
      const byParafa = await (supabase as any)
        .from("doctors")
        .select("*")
        .ilike("parafa_code", parafa)
        .maybeSingle();
      return (byParafa.data as CurrentDoctor) ?? null;
    },
  });
}
