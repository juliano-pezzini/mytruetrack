import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';

export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div className="bg-amber-500 text-white text-center text-sm py-1.5 px-4">
      You are offline — changes are saved locally
    </div>
  );
}
