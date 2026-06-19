import { useThemeColors } from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import { useAppStore } from "@store/appStore";
import { Tabs } from "expo-router";
import { Platform } from "react-native";

export default function TabLayout() {
  const colors = useThemeColors();
  const unreadCount = useAppStore((state) => state.unreadCount);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surfaceBg,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, focused }) => (
            <Feather name="target" size={focused ? 25 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="connections"
        options={{
          title: "Connections",
          tabBarBadge: unreadCount || undefined,
          tabBarBadgeStyle: { backgroundColor: colors.secondary },
          tabBarIcon: ({ color, focused }) => (
            <Feather name="users" size={focused ? 25 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, focused }) => (
            <Feather
              name="message-circle"
              size={focused ? 25 : 23}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <Feather name="settings" size={focused ? 25 : 23} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
