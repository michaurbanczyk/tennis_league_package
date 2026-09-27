export const BANNER_MAX_BYTES=2*1024*1024;
export const BANNERS={sponsors:{title:'Baner sponsorów',width:2400,height:600},header:{title:'Baner ligi',width:1200,height:420}} as const;
export type BannerKind=keyof typeof BANNERS;
export function validateBanner(bytes:Uint8Array,mime:string,kind:BannerKind='sponsors'){
 const dimensions=BANNERS[kind];
 if(!bytes.length||bytes.length>BANNER_MAX_BYTES)throw Error('Baner może mieć maksymalnie 2 MB.');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let width=0,height=0;
 if(mime==='image/png'){
  if(bytes.length<45||[137,80,78,71,13,10,26,10].some((n,i)=>bytes[i]!==n)||v.getUint32(8)!==13||v.getUint32(12)!==0x49484452)throw Error('Wybierz prawidłowy plik PNG lub JPG.');
  width=v.getUint32(16);height=v.getUint32(20);
  let p=8,idat=false,end=false;
  while(p+12<=bytes.length){const len=v.getUint32(p),type=v.getUint32(p+4);if(p+12+len>bytes.length)throw Error('Uszkodzony plik PNG.');if(type===0x6163544c)throw Error('Wybierz nieruchomy baner PNG lub JPG.');if(type===0x49444154)idat=true;p+=12+len;if(type===0x49454e44){end=len===0&&p===bytes.length;break;}}
  if(!idat||!end)throw Error('Uszkodzony plik PNG.');
 }else if(mime==='image/jpeg'){
  if(bytes.length<12||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw Error('Wybierz prawidłowy plik PNG lub JPG.');
  let p=2,sos=false;
  while(p+4<=bytes.length){if(bytes[p++]!==255)break;while(bytes[p]===255)p++;const marker=bytes[p++];if(marker===0xda){sos=true;break;}if(marker===0xd9)break;const len=v.getUint16(p);if(len<2||p+len>bytes.length)break;if([0xc0,0xc1,0xc2].includes(marker)){if(len<8)break;height=v.getUint16(p+3);width=v.getUint16(p+5);}p+=len;}
  if(!sos||!width||!height)throw Error('Uszkodzony lub nieobsługiwany plik JPG.');
 }else throw Error('Wybierz plik PNG lub JPG.');
 if(width!==dimensions.width||height!==dimensions.height)throw Error(`Baner musi mieć ${dimensions.width} × ${dimensions.height} px. Wybrany plik ma ${width} × ${height} px.`);
 return {width,height,mime};
}
