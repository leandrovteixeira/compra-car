'use client';

import Link from 'next/link';
import { useEffect,useRef,useState } from 'react';
import { LogoutControl } from './logout-control';
import { PwaInstallInstructions } from './pwa-install-instructions';
import { canOfferPwaInstall,usePwaInstall } from './use-pwa-install';

interface MenuLink{readonly href:string;readonly label:string;}
export function UserMenu({displayName,logoutAction,roleLabel,navigationLinks=[]}:{readonly displayName:string;readonly logoutAction:()=>Promise<never>;readonly roleLabel:string;readonly navigationLinks?:readonly MenuLink[]}){
 const menu=useRef<HTMLDetailsElement>(null);const {availability,requestNativeInstall}=usePwaInstall({desktopManual:true});const [requestingInstall,setRequestingInstall]=useState(false);const [showInstallInstructions,setShowInstallInstructions]=useState(false);const canInstall=canOfferPwaInstall(availability);const manualInstall=availability==='ios-manual'||availability==='browser-manual';const instructionsId='user-menu-install-instructions';
 useEffect(()=>{const close=(event:MouseEvent)=>{if(menu.current?.open&&!menu.current.contains(event.target as Node))menu.current.removeAttribute('open');};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')menu.current?.removeAttribute('open');};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};},[]);
 const install=async()=>{if(manualInstall){setShowInstallInstructions(c=>!c);return;}setRequestingInstall(true);const result=await requestNativeInstall();setRequestingInstall(false);if(result==='completed')menu.current?.removeAttribute('open');else setShowInstallInstructions(true);};
 const close=()=>menu.current?.removeAttribute('open');
 return <details className="group relative shrink-0" ref={menu}><summary className="ui-button ui-button--ghost ui-button--compact cursor-pointer list-none" aria-label="Menu"><svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16"><path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"/></svg><span>Menu</span></summary>
 <section aria-label="Menu" className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-border bg-surface p-2 shadow-lg">
  <div className="border-b border-border px-2 pb-2"><p className="truncate text-sm font-semibold text-text-primary">{displayName}</p><p className="mt-0.5 text-xs text-text-muted">{roleLabel}</p></div>
  {navigationLinks.length?<nav className="my-1 border-b border-border pb-1">{navigationLinks.map(link=><Link className="touch-target flex min-h-8 items-center rounded-md px-2 text-xs font-semibold text-text-secondary hover:bg-surface-muted" href={link.href} key={link.href} onClick={close}>{link.label}</Link>)}</nav>:null}
  {canInstall?<><button aria-controls={manualInstall?instructionsId:undefined} aria-expanded={manualInstall?showInstallInstructions:undefined} className="touch-target mt-1 flex min-h-8 w-full items-center rounded-md px-2 text-left text-xs font-semibold text-interactive hover:bg-surface-muted" disabled={requestingInstall} onClick={install} type="button">{requestingInstall?'Abrindo instalação…':'Instalar aplicativo'}</button>{showInstallInstructions?<div className="px-1 py-1" role="status"><PwaInstallInstructions id={instructionsId} ios={availability==='ios-manual'}/></div>:null}</>:null}
  <LogoutControl action={logoutAction} className="touch-target mt-1 flex min-h-8 w-full items-center rounded-md px-2 text-xs font-semibold text-text-secondary hover:bg-surface-muted"/>
 </section></details>;
}
