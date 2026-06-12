import { PublicProfileDetail } from "@screens/PublicProfileDetail";
import { useLocalSearchParams } from "expo-router";

export default function PublicProfileRoute() {
  const { userId, notificationId } = useLocalSearchParams<{
    userId: string;
    notificationId?: string;
  }>();

  return (
    <PublicProfileDetail
      userId={userId}
      notificationId={notificationId}
    />
  );
}
