interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly MAIN_VITE_SUPABASE_URL?: string;
  readonly MAIN_VITE_SUPABASE_KEY?: string;
  readonly MAIN_VITE_SUPABASE_BUCKET?: string;
}
