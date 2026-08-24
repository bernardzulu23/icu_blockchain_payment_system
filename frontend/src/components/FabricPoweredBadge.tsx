import { Lock } from 'lucide-react';

type FabricPoweredBadgeProps = {
  className?: string;
};

/** "Powered by Hyperledger Fabric" lock badge for brand headers */
export default function FabricPoweredBadge({ className = '' }: FabricPoweredBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-900 bg-blue-100 border border-blue-300 ${className}`}
    >
      <Lock className="h-3 w-3 shrink-0 text-blue-900" aria-hidden strokeWidth={2.25} />
      Powered by Hyperledger Fabric
    </span>
  );
}
