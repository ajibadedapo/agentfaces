import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { CORE_STATES, STATE_LABEL, type AgentState } from "agentfaces";
import { AgentFace } from "agentfaces/react-native";

export default function App() {
  const [state, setState] = useState<AgentState>("thinking");

  return (
    <View style={styles.screen}>
      <View style={styles.stage}>
        <AgentFace state={state} shape="circle" color="#2F6BFF" size={160} name="Assistant" />
        <Text style={styles.label}>{STATE_LABEL[state]}</Text>
      </View>
      <View style={styles.row}>
        {CORE_STATES.map((option) => (
          <Pressable key={option} onPress={() => setState(option)} style={[styles.chip, option === state && styles.active]}>
            <Text style={[styles.chipText, option === state && styles.activeText]}>{STATE_LABEL[option]}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.team}>
        {["ada", "grace", "linus"].map((id, i) => (
          <AgentFace key={id} seed={id} name={id} state={(["working", "needs-you", "done"] as const)[i]} size={56} />
        ))}
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", gap: 32 },
  stage: { alignItems: "center", gap: 12 },
  label: { fontSize: 18, fontWeight: "600", color: "#1C1B22" },
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, paddingHorizontal: 24 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "#F6F5FA" },
  active: { backgroundColor: "#1C1B22" },
  chipText: { color: "#1C1B22" },
  activeText: { color: "#fff" },
  team: { flexDirection: "row", gap: 20 },
});
