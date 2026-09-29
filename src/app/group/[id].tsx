import { useLocalSearchParams } from 'expo-router';
import { GroupDetail } from '@/components/GroupDetail';

export default function GroupRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GroupDetail id={id} />;
}
