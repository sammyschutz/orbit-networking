import { ConnectionDetail } from "@screens/Connections";
import { useLocalSearchParams } from "expo-router";

export default function ConnectionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <ConnectionDetail connectionId={id} />;
}
