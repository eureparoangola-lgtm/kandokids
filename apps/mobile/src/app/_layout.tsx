import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { loading } = useAuth();
  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.ink },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: "minimal",
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="registo" options={{ title: "Criar conta" }} />
      <Stack.Screen name="codigo" options={{ title: "Código de convite" }} />
      <Stack.Screen name="encarregado/index" options={{ title: "Kandokids" }} />
      <Stack.Screen name="encarregado/aluno/[id]" options={{ title: "" }} />
      <Stack.Screen name="encarregado/pin/[id]" options={{ title: "PIN de entrega" }} />
      <Stack.Screen name="encarregado/extras" options={{ title: "Extras" }} />
      <Stack.Screen name="encarregado/notificacoes" options={{ title: "Notificações" }} />
      <Stack.Screen name="conversa/[id]" options={{ title: "Mensagens" }} />
      <Stack.Screen name="assistente/index" options={{ title: "As minhas viagens" }} />
      <Stack.Screen name="assistente/viagem/[id]" options={{ title: "Viagem" }} />
      <Stack.Screen name="assistente/scan/[id]" options={{ title: "Ler cartão" }} />
      <Stack.Screen name="assistente/mensagens" options={{ title: "Mensagens dos pais" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Navigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
