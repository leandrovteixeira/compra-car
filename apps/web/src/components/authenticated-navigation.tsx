import type { AuthProfile } from '@compra-car/adapter-supabase';
import { logout } from '../app/actions/auth';
import { ApplicationTopbar } from './application-topbar';
import { getAuthenticatedNavigationModel,type AuthenticatedArea } from './authenticated-navigation-policy';
export interface AuthenticatedNavigationProps{readonly area:AuthenticatedArea;readonly displayName:string;readonly logoutAction:()=>Promise<never>;readonly profile:AuthProfile;}
export function AuthenticatedNavigation({area,displayName,logoutAction,profile}:AuthenticatedNavigationProps){const {localLinks}=getAuthenticatedNavigationModel(profile,area);return <ApplicationTopbar area={area} displayName={displayName} logoutAction={logoutAction} navigationLinks={localLinks} profile={profile}/>;}
export function AppAuthenticatedNavigation(props:Omit<AuthenticatedNavigationProps,'logoutAction'>){return <AuthenticatedNavigation {...props} logoutAction={logout}/>;}
