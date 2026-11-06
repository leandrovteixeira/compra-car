/** Source-faithful raster crops of the official Ford Ranger page 2.
 * Each crop isolates one of the three printed equipment-table blocks.
 * No OCR guesses, no model call, no catalog writes.
 */
import {spawn} from 'node:child_process';
export type FordMatrixRegion27='EXTERIOR_AND_MULTIMEDIA'|'INTERIOR_AND_SAFETY'|'TECHNOLOGY_AND_TECHNICAL';
export interface FordMatrixCrop27{
 region:FordMatrixRegion27;imagePng:Uint8Array;pageWidth:number;pageHeight:number;
 pixelRect:{x:number;y:number;width:number;height:number};
}
function pngDimensions(bytes:Uint8Array):{width:number;height:number}{
 const b=Buffer.from(bytes);
 if(b.length<25||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
   throw new Error('FORD_PDF_RASTER_INVALID_PNG');
 const width=b.readUInt32BE(16),height=b.readUInt32BE(20);
 if(width<100||height<100||width>10000||height>15000)
   throw new Error('FORD_PDF_RASTER_DIMENSIONS_INVALID');
 return {width,height};
}
async function rasterize(pdf:Uint8Array,crop?:{x:number;y:number;width:number;height:number}):Promise<Uint8Array>{
 const args=['-f','2','-l','2','-png','-scale-to-x','2560','-scale-to-y','-1'];
 if(crop)args.push('-x',String(crop.x),'-y',String(crop.y),
   '-W',String(crop.width),'-H',String(crop.height));
 args.push('-');
 return new Promise<Uint8Array>((resolve,reject)=>{
  const child=spawn('pdftoppm',args,{stdio:['pipe','pipe','pipe']});
  const chunks:Buffer[]=[];let bytes=0;let done=false;
  const timer=setTimeout(()=>child.kill('SIGKILL'),45000);
  const finish=(error?:Error)=>{
   if(done)return;done=true;clearTimeout(timer);
   if(error)reject(error);else resolve(Buffer.concat(chunks));
  };
  child.on('error',()=>finish(new Error('FORD_PDF_RASTER_POPPLER_UNAVAILABLE')));
  child.stdout.on('data',(chunk:Buffer)=>{
   bytes+=chunk.length;
   if(bytes>15_000_000)child.kill('SIGKILL');else chunks.push(chunk);
  });
  child.stderr.on('data',()=>{});
  child.on('close',code=>finish(code===0?undefined:new Error('FORD_PDF_RASTER_RENDER_FAILED')));
  child.stdin.on('error',()=>{});
  child.stdin.end(Buffer.from(pdf));
 });
}
export async function renderFordMatrixRegions27(pdf:Uint8Array):Promise<FordMatrixCrop27[]>{
 const b=Buffer.from(pdf);
 if(b.subarray(0,4).toString('ascii')!=='%PDF'||b.length<512||b.length>3_000_000)
   throw new Error('FORD_PDF_RASTER_SOURCE_INVALID');
 const full=await rasterize(pdf);
 const {width:W,height:H}=pngDimensions(full);
 if(H/W<1.2||H/W>1.8)throw new Error('FORD_PDF_RASTER_PAGE_RATIO_INVALID');
 const regions=[
  {region:'EXTERIOR_AND_MULTIMEDIA',x0:0.005,x1:0.385,y0:0.012,y1:0.50},
  {region:'INTERIOR_AND_SAFETY',x0:0.237,x1:0.611,y0:0.485,y1:0.914},
  {region:'TECHNOLOGY_AND_TECHNICAL',x0:0.608,x1:0.995,y0:0.48,y1:0.929}
 ] as const;
 const result:FordMatrixCrop27[]=[];
 for(const region of regions){
  const x=Math.floor(region.x0*W),y=Math.floor(region.y0*H);
  const width=Math.ceil(region.x1*W)-x,height=Math.ceil(region.y1*H)-y;
  const rect={x,y,width,height};
  const imagePng=await rasterize(pdf,rect);
  const shape=pngDimensions(imagePng);
  if(shape.width!==width||shape.height!==height)
   throw new Error('FORD_PDF_RASTER_CROP_DIMENSIONS_INVALID');
  result.push({region:region.region,imagePng,pageWidth:W,pageHeight:H,pixelRect:rect});
 }
 return result;
}
