// Projeto Supabase da Kandokids. A chave "publishable" é pública por natureza (vai para o browser);
// a segurança está nas regras RLS. Pode ser substituída com NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://btneqdnusgwizrsoyhfc.supabase.co";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_WaLSKailuf4PCzgMQpJajQ_DccjfwJg";
