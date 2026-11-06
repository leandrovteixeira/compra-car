import {NextResponse} from 'next/server';
import {requireRole} from '@/auth/authorization';
import {createPrivilegedAdminClient} from '@/auth/admin-client';

export async function GET(){
 await requireRole('admin');
 const db=createPrivilegedAdminClient();
 const {data,error}=await db.from('specs')
  .select('id,code,display_pt,detail_pt,detail,type,unit')
  .eq('is_active',true).order('display_pt',{ascending:true}).limit(500);
 if(error||!data)return NextResponse.json({error:'CATALOG_UNAVAILABLE'},{status:503});
 return NextResponse.json({items:data.map(s=>({
  id:Number(s.id),code:String(s.code),label:String(s.display_pt??s.detail_pt??s.detail??s.code),
  type:String(s.type),unit:typeof s.unit==='string'?s.unit:null
 }))},{headers:{'Cache-Control':'private, no-store'}});
}
