import { requireRole } from '@/auth/authorization';
import { CatalogPageHeading } from '@/components/admin/catalog-page-heading';
import { ReadOnlyPriceList } from '@/components/admin/read-only-price-list';
import { loadAllAdminProductPublicPrices } from '@/server/admin-product-public-price-service';
export default async function PublicPriceListPage(){
 await requireRole('admin');
 const result=await loadAllAdminProductPublicPrices({sort:'vehicle',direction:'asc',status:'published'});
 return <section className="admin-pricing-workspace" style={{gridTemplateRows:'auto minmax(0,1fr)'}}>
  <CatalogPageHeading title="Lista de Preços" description="Consulte os preços públicos dos veículos."/>
  {result.ok?<ReadOnlyPriceList items={result.data.items}/>:<p role="alert">Não foi possível carregar os preços.</p>}
 </section>;
}