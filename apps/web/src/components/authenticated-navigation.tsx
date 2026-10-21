import type { AuthProfile } from '@compra-car/adapter-supabase';
import type { AccountTier } from '@/auth/entitlements-23c';
import { logout } from '../app/actions/auth';
import { ApplicationTopbar } from './application-topbar';
import { getAuthenticatedNavigationModel,type AuthenticatedArea } from './authenticated-navigation-policy';
export interface AuthenticatedNavigationProps{readonly area:AuthenticatedArea;readonly displayName:string;readonly logoutAction:()=>Promise<never>;readonly profile:AuthProfile;readonly tier?:AccountTier;}
export function AuthenticatedNavigation({area,displayName,logoutAction,profile,tier}:AuthenticatedNavigationProps){const {localLinks}=getAuthenticatedNavigationModel(profile,area);return <ApplicationTopbar area={area} displayName={displayName} logoutAction={logoutAction} navigationLinks={localLinks} profile={profile} tier={tier}/>;}
export function AppAuthenticatedNavigation(props:Omit<AuthenticatedNavigationProps,'logoutAction'>){return <AuthenticatedNavigation {...props} logoutAction={logout}/>;}
