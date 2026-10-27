import { describe,expect,it } from 'vitest';
import { reviewWatcherAiEvents } from '../watcher-ai-review';
import type { WatcherAiExtractedEvent } from '@compra-car/adapter-openai';
const base:WatcherAiExtractedEvent={category:'MSRP',brand:'MG',model:'IM 6',version:null,market:'BR',evidence:'MG IM 6 custa R$ 368 mil',uncertain:false};
describe('AI Watcher local review projection',()=>{
  it('deduplicates repeated price extraction preserving evidence',()=>{
    const rows=reviewWatcherAiEvents([base,{...base,evidence:'Preço do MG IM 6 anunciado',uncertain:true}]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.evidences).toHaveLength(2);
    expect(rows[0]?.uncertain).toBe(true);
    expect(rows[0]?.status).toBe('REVIEW_REQUIRED');
  });
  it('separates factory news from catalog candidates',()=>{
    expect(reviewWatcherAiEvents([{...base,category:'INDUSTRIAL',model:null}])[0]?.route)
      .toBe('COMPETITIVE_INTELLIGENCE');
  });
  it('holds known motorcycle name for out-of-scope review',()=>{
    expect(reviewWatcherAiEvents([{...base,brand:'BMW',model:'F 450 GS',category:'MARKET_ENTRY'}])[0]?.route)
      .toBe('OUT_OF_SCOPE_REVIEW');
  });
  it('never approves a brand or product automatically',()=>{
    expect(reviewWatcherAiEvents([base])[0]).toMatchObject({status:'REVIEW_REQUIRED',route:'CATALOG_REVIEW'});
  });
});
