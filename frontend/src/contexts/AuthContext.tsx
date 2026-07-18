import {createContext,useContext,useEffect,useState,ReactNode} from 'react';
import type {Session,User} from '@supabase/supabase-js';
import supabase from '../lib/supabase';
type Role='patient'|'doctor'|'admin';
type Auth={user:User|null;session:Session|null;loading:boolean;role:Role;signOut:()=>Promise<void>};
const C=createContext<Auth>({user:null,session:null,loading:true,role:'patient',signOut:async()=>{}});
const getRole=(u:User|null):Role=>{const email=u?.email||'';if(email.startsWith('admin'))return'admin';if(email.startsWith('doctor'))return'doctor';return (u?.user_metadata?.role as Role)||'patient'};
export function AuthProvider({children}:{children:ReactNode}){const[user,setUser]=useState<User|null>(null);const[session,setSession]=useState<Session|null>(null);const[loading,setLoading]=useState(true);useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setUser(data.session?.user||null);setLoading(false)});const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s);setUser(s?.user||null);setLoading(false)});return()=>subscription.unsubscribe()},[]);return <C.Provider value={{user,session,loading,role:getRole(user),signOut:async()=>{await supabase.auth.signOut()}}}>{children}</C.Provider>}
export const useAuth=()=>useContext(C);
