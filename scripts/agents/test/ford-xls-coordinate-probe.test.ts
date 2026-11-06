import {describe,it,expect} from 'vitest';
import {readFordPdfBbox27,summarizeFordPdfGeometry27} from '../ford-xls-coordinate-probe';
const word=(text:string,x:number,y:number)=>
 '<word xMin="'+x+'" yMin="'+y+'" xMax="'+(x+12)+'" yMax="'+(y+6)+'">'+text+'</word>';
describe('Ford PDF Poppler zero-cost geometry',()=>{
 it('preserves spatial positions and XML entities',()=>{
  const words=Array.from({length:120},(_,i)=>word('x',20+i,10+i)).join('');
  const xml='<html><body><doc><page width="1200" height="1600">'+
   word('XLS',200,100)+word('&amp;',250,100)+words+'</page></doc></body></html>';
  const r=readFordPdfBbox27(xml,'a'.repeat(64));
  expect(r.pageWidth).toBe(1200);
  expect(r.words[0]).toMatchObject({text:'XLS',x:200,y:100});
  expect(r.words[1]?.text).toBe('&');
  expect(summarizeFordPdfGeometry27(r).wordCount).toBe(122);
 });
 it('rejects missing embedded PDF text and out of bounds coordinates',()=>{
  expect(()=>readFordPdfBbox27('<page width="1200" height="1600"></page>','a'.repeat(64)))
   .toThrow('FORD_PDF_BBOX_TEXT_MISSING');
  expect(()=>readFordPdfBbox27('<page width="1200" height="1600">'+
   word('x',1500,2).repeat(120)+'</page>','a'.repeat(64)))
   .toThrow('FORD_PDF_BBOX_WORD_INVALID');
 });
});
