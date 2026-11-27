import { createServerClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";
import { NextResponse, type NextRequest } from "next/server";

/** Renova a sessão do Supabase e protege as rotas do painel. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;

  if (!signedIn && (path.startsWith("/painel") || path.startsWith("/plataforma") || path === "/suspensa")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  // Com ?erro= (ex.: encarregado sem acesso ao painel) mostramos a mensagem em vez de redirecionar,
  // senão haveria um ciclo /painel → /login → /painel.
  if (signedIn && (path === "/login" || path === "/registar") && !request.nextUrl.searchParams.has("erro")) {
    const url = request.nextUrl.clone();
    url.pathname = "/painel";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
