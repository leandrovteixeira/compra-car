import {describe,it,expect,vi} from 'vitest';
import {createSafeCaptureTransport} from '../engineering-safe-capture-transport';
const body=(value:string)=>new ReadableStream<Uint8Array>({
 start(controller){controller.enqueue(new TextEncoder().encode(value));controller.close();}
});
const response=(status:number,contentType='text/html')=>({
 status,headers:{get:(name:string)=>name==='content-type'?contentType:null},body:body('<html>ok</html>'),
});
describe('engineering capture transport boundaries',()=>{
 it('rejects private or mixed DNS resolution before a network request',async()=>{
  const request=vi.fn(async()=>response(200));
  const fetch=createSafeCaptureTransport({resolve:async()=>['8.8.8.8','127.0.0.1'],request});
  await expect(fetch.fetchSource('https://www.kia.com.br/')).rejects.toThrow('ENGINEERING_PRIVATE_DNS');
  expect(request).not.toHaveBeenCalled();
 });
 it('rejects source redirects and non-official URLs',async()=>{
  const transport=createSafeCaptureTransport({resolve:async()=>['8.8.8.8'],request:async()=>response(302)});
  await expect(transport.fetchSource('https://www.vw.com.br/pt/carros.html')).rejects.toThrow('ENGINEERING_REDIRECT_BLOCKED');
  await expect(transport.fetchSource('http://localhost/')).rejects.toThrow('ENGINEERING_UNSAFE_SOURCE');
 });
 it('accepts limited official HTML only',async()=>{
  const fetch=createSafeCaptureTransport({resolve:async()=>['8.8.8.8'],request:async()=>response(200)});
  await expect(fetch.fetchSource('https://www.kia.com.br/')).resolves.toMatchObject({
   status:200,finalUrl:'https://www.kia.com.br/',body:'<html>ok</html>',
  });
 });
 it('aborts body larger than cap',async()=>{
  const fetch=createSafeCaptureTransport({resolve:async()=>['8.8.8.8'],request:async()=>response(200)},{maxBytes:4});
  await expect(fetch.fetchSource('https://www.kia.com.br/')).rejects.toThrow('ENGINEERING_SOURCE_SIZE');
 });
});
