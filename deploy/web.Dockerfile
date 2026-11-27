# Kandokids website: dashboard (Next.js) + parent/assistant app (Expo web) at /app.
FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile

# Public values (they end up in the browser anyway); override with --build-arg.
ARG NEXT_PUBLIC_SUPABASE_URL=https://btneqdnusgwizrsoyhfc.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_WaLSKailuf4PCzgMQpJajQ_DccjfwJg
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    EXPO_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    EXPO_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    EXPO_BASE_URL=/app \
    NEXT_TELEMETRY_DISABLED=1 \
    KANDOKIDS_STANDALONE=1
RUN cd apps/web && pnpm build:with-app

FROM node:22-bookworm-slim
WORKDIR /srv
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
