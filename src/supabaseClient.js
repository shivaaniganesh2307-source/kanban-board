import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://sgwutvpmohhyhhowewpn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnd3V0dnBtb2hoeWhob3dld3BuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDgyNzUsImV4cCI6MjA5MDYyNDI3NX0.KsMf9u-VRX9_b4DaAgbXsc8eBam1sEG3DP0Zn-DODRQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);