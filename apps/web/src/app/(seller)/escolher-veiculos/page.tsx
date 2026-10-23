import { getAccountTier } from '@/auth/account-tier-server';
import { comparisonLimit } from '@/auth/entitlements-23c';
import { VehicleSelection } from '@/components/vehicle-selection';

export default async function ChooseVehiclesPage() {
  const tier = await getAccountTier();
  return <VehicleSelection limit={comparisonLimit(tier)} />;
}
