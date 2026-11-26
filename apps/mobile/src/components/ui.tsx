import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, space } from "@/lib/theme";

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const content = <View style={styles.screenInner}>{children}</View>;
  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={styles.screen}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  if (onPress) {
    return (
      <Pressable testID={testID} accessibilityRole="button" onPress={onPress}
        style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

type Variant = "primary" | "brand" | "secondary" | "danger" | "ghost";

export function Button({ title, onPress, variant = "primary", disabled, loading, icon, style }: {
  title: string; onPress: () => void; variant?: Variant; disabled?: boolean; loading?: boolean; icon?: string; style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[variant];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: v.bg, borderColor: v.border }, (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.8 }, style]}>
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <Text style={[styles.buttonText, { color: v.fg }]}>{icon ? `${icon}  ` : ""}{title}</Text>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.ink, fg: "#fff", border: colors.ink },
  brand: { bg: colors.brand, fg: colors.ink, border: colors.brand },
  secondary: { bg: "#fff", fg: colors.ink, border: colors.border },
  danger: { bg: colors.red, fg: "#fff", border: colors.red },
  ghost: { bg: "transparent", fg: colors.inkSoft, border: "transparent" },
};

export function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={styles.title}>{children}</Text>;
}
export function Subtitle({ children }: { children: ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}
export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}
export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Banner({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: ReactNode }) {
  const map = { error: [colors.redSoft, colors.red], success: [colors.greenSoft, colors.green], info: [colors.brandSoft, colors.ink] };
  const [bg, fg] = map[kind];
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 14 }}>{children}</Text>
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ padding: space.xxl, alignItems: "center" }}>
      <ActivityIndicator color={colors.ink} />
    </View>
  );
}

/** Folha modal simples que funciona em Android, iOS e web. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.sheetHandle} />
        <Text accessibilityRole="header" style={[styles.title, { fontSize: 20 }]}>{title}</Text>
        <View style={{ gap: space.md, marginTop: space.md }}>{children}</View>
      </View>
    </Modal>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  screenInner: { padding: space.lg, gap: space.md, width: "100%", maxWidth: 640, alignSelf: "center" },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: colors.border, gap: space.sm },
  button: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  badge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  title: { fontSize: 24, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 15, color: colors.muted },
  section: { marginTop: space.md, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: colors.muted },
  muted: { fontSize: 14, color: colors.muted },
  banner: { borderRadius: radius.md, padding: space.md },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16, backgroundColor: "#fff", color: colors.text },
  backdrop: { flex: 1, backgroundColor: "rgba(15,33,64,0.45)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: space.xl, paddingBottom: 40, width: "100%", maxWidth: 640, alignSelf: "center" },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: space.md },
});
