import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
    Button,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { supabase } from "../../src/services/supabase";

export default function SettingsScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    // Show re-auth modal
    setModalVisible(true);
  };

  const confirmDelete = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email;
      if (!email) throw new Error("No email for current user");

      // Re-authenticate by signing in with password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInErr) throw signInErr;

      // Call Edge Function to perform deletion
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;
      if (!token) throw new Error("No access token");

      const funcUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`;
      const res = await fetch(funcUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      // Try to parse JSON; fall back to text for clearer errors
      let payload: any = null;
      let textBody: string | null = null;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        payload = await res.json();
      } else {
        textBody = await res.text();
      }

      if (!res.ok) {
        const serverMsg =
          payload?.error ||
          payload?.message ||
          textBody ||
          `${res.status} ${res.statusText}`;
        throw new Error(`Delete failed: ${serverMsg}`);
      }

      // Clear local session and navigate to auth screen
      await supabase.auth.signOut();
      Alert.alert(
        "Account deleted",
        "Your account and data have been removed.",
      );
      router.replace("/auth");
    } catch (err: any) {
      console.error("delete account error:", err);
      Alert.alert("Error", err.message || String(err));
    } finally {
      setLoading(false);
      setModalVisible(false);
      setPassword("");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <View style={{ marginTop: 24 }}>
        <View style={{ marginBottom: 12 }}>
          <Button
            title="Edit profile"
            onPress={() => router.push("/profile")}
          />
        </View>
        <View>
          <Button
            title="Delete account"
            color="#d9534f"
            onPress={handleDelete}
          />
        </View>
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm account deletion</Text>
            <Text style={styles.modalHelp}>
              Re-enter your password to confirm.
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Password"
              style={styles.input}
              autoCapitalize="none"
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Button title="Cancel" onPress={() => setModalVisible(false)} />
              <Button
                title={loading ? "Deleting..." : "Delete"}
                color="#d9534f"
                onPress={confirmDelete}
                disabled={loading}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "white",
    padding: 20,
    borderRadius: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  modalHelp: { marginBottom: 12, color: "#444" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 8,
    marginBottom: 12,
    borderRadius: 6,
  },
});
