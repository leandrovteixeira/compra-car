import type { AuthProfile } from '@compra-car/adapter-supabase';
import { BrandSlot } from './brand-slot';
import { ContextSwitcher } from './context-switcher';
import type { AuthenticatedArea,NavigationLink } from './authenticated-navigation-policy';
import { UserMenu } from './user-menu';
interface Props{readonly area:AuthenticatedArea;readonly displayName:string;readonly logoutAction:()=>Promise<never>;readonly profile:AuthProfile;readonly navigationLinks?:readonly NavigationLink[];}
export function ApplicationTopbar({area,displayName,logoutAction,profile,navigationLinks=[]}:Props){return <header className="sticky top-0 z-40 h-[var(--app-topbar-height)] border-b border-border bg-surface-elevated"><div className="mx-auto flex h-full w-full max-w-[100rem] items-center gap-2 px-3 sm:gap-4 sm:px-5 lg:px-6"><BrandSlot href={area==='admin'?'/admin':'/'}/><ContextSwitcher area={area} profile={profile}/><div className="ml-auto"><UserMenu displayName={displayName} logoutAction={logoutAction} navigationLinks={navigationLinks} roleLabel={profile.role==='admin'?'Administrador':'Vendedor'} showInvite={area==='seller'}/></div></div></header>}
