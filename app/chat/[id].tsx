import { ChatScreen } from "@screens/Chat";
import { useLocalSearchParams } from "expo-router";

export default function ChatRoute() {
  const { id, recipientId, connectionId, name, photo } = useLocalSearchParams<{
    id: string;
    recipientId?: string;
    connectionId?: string;
    name?: string;
    photo?: string;
  }>();

  return (
    <ChatScreen
      routeId={id}
      recipientId={recipientId}
      connectionId={connectionId}
      name={name}
      photo={photo}
    />
  );
}
