import AgentsPage from '../page';

/**
 * Dedicated navigation destination for Flight Control.
 * Reuses the existing flight-control content without duplicating operational queries.
 */
export default function FlightControlPage() {
  return <AgentsPage searchParams={Promise.resolve({ tab: 'flight' })} />;
}
