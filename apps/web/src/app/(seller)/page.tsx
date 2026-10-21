import { getAccountTier } from '@/auth/account-tier-server';
import { comparisonLimit } from '@/auth/entitlements-23c';
import { VehicleSelection } from '@/components/vehicle-selection';

export default async function HomePage() {
  const tier = await getAccountTier();
  return <VehicleSelection maxVehicles={comparisonLimit(tier)} />;
}
