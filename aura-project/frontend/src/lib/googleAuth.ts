import supabase from './supabase';
const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
function buildGoogleUrl(appName:string) {
  const clientId=import.meta.env.VITE_GOOGLE_CLIENT_ID, redirectUri=import.meta.env.VITE_GOOGLE_AUTH_PROXY;
  if(!clientId||!redirectUri) return null;
  const state=btoa(JSON.stringify({origin:window.location.origin,appName,supabaseUrl:import.meta.env.VITE_SUPABASE_URL,supabaseAnonKey:import.meta.env.VITE_SUPABASE_ANON_KEY}));
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&prompt=select_account&state=${encodeURIComponent(state)}`;
}
export function signInWithGoogle(){const url=buildGoogleUrl('AURA Health');if(!url){window.dispatchEvent(new CustomEvent('aura-notify',{detail:'Google sign-in is unavailable. Please use the secure email login.'}));return}window.open(url,'google-auth',isMobile()?'':'width=500,height=650');const handler=async(e:MessageEvent)=>{if(e.data?.type!=='google-auth-success')return;window.removeEventListener('message',handler);if(e.data.access_token)await supabase.auth.setSession({access_token:e.data.access_token,refresh_token:e.data.refresh_token});else if(e.data.id_token)await supabase.auth.signInWithIdToken({provider:'google',token:e.data.id_token});};window.addEventListener('message',handler)}
export async function handleGoogleRedirect(){const p=new URLSearchParams(location.search),token=p.get('google_id_token');if(!token)return;history.replaceState({},'',location.pathname);await supabase.auth.signInWithIdToken({provider:'google',token});try{window.close()}catch{}}
