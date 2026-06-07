import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@hooks/useAuth";
import { Tabs } from "expo-router";
import { Button } from "react-native";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { signOut } = useAuth();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: true,
        headerRight: () => <Button title="Sign Out" onPress={signOut} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Discover",
          tabBarIcon: ({ color }) => (
            <Feather name="heart" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="connections"
        options={{
          title: "Connections",
          tabBarIcon: ({ color }) => (
            <Feather name="users" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Feather name="settings" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
