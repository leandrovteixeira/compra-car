import { extractRawCommercialPrices } from '@compra-car/core/agents';

const URL_ORA5='https://www.gwmmotors.com.br/pt/modelos/ora5';
export async function probeOra5Price(fetcher: typeof fetch=fetch) {
 const response=await fetcher(URL_ORA5,{headers:{accept:'text/html,application/json;q=0.9'},redirect:'follow',signal:AbortSignal.timeout(15000)});
 const body=await response.text();
 const rows=extractRawCommercialPrices(body);
 const direct=body.match(/(?:R\$\s*165\.990(?:,00)?|165990(?:\.00)?)/gu);
 const at=body.indexOf(direct?.[0] ?? '__NO_MATCH__');
 const around=at>=0?body.slice(Math.max(0,at-210),Math.min(body.length,at+210)).replace(/[\\r\\n\\t]+/gu,' ').slice(0,420):null;
 return {status:response.status,finalUrl:response.url,bytes:Buffer.byteLength(body),
   directPriceOccurrences:direct?.length??0,priceContext:around,extracted:rows.map(x=>({amount:x.amount,label:x.label,context:x.context.slice(0,180)}))};
}
export async function runOra5PriceProbe(log:(line:string)=>void=console.log){
 const result=await probeOra5Price();
 log('PRICE_ORA5_DIRECT_PROBE '+JSON.stringify(result));
 return result;
}
