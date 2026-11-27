import type { ConfigContext, ExpoConfig } from "expo/config";

// Extends app.json. EXPO_BASE_URL=/app serves the web version under kandokids.vercel.app/app.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
