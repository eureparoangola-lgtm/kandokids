// Projeto Supabase da Kandokids. A chave "publishable" é pública por natureza (vai dentro da app);
// a segurança está nas regras RLS da base de dados. Pode ser substituída por EXPO_PUBLIC_* (.env.local).
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://btneqdnusgwizrsoyhfc.supabase.co";
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_WaLSKailuf4PCzgMQpJajQ_DccjfwJg";
