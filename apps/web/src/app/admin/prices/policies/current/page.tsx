import { requireRole } from '@/auth/authorization';
import { CatalogPageHeading } from '@/components/admin/catalog-page-heading';
import { ReadOnlyCommercialPolicies } from '@/components/admin/read-only-commercial-policies';
import { loadCommercialOfferBuilder } from '@/server/commercial-offer-builder-service';
export default async function CurrentPoliciesPage(){
 await requireRole('admin');
 const data=await loadCommercialOfferBuilder();
 return <section className="admin-pricing-workspace" style={{gridTemplateRows:'auto minmax(0,1fr)'}}>
  <CatalogPageHeading title="Políticas Vigentes" description="Consulte as políticas comerciais publicadas e suas ofertas relacionadas."/>
  <ReadOnlyCommercialPolicies products={data.products} policies={data.policies} offers={data.drafts}/>
 </section>;
}