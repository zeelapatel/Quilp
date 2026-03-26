import type { User } from "@supabase/supabase-js";
import type { QuilpUser } from "../hooks/useUser";

export type AppOutletContext = {
  authUser: User | null;
  user: QuilpUser | null;
  signOut: () => Promise<void>;
};
