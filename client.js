import {createClient} from './supabase-vendor.js';
import {config} from './config.js';
export const configured=!!config.supabaseUrl&&!!config.publishableKey;
export const supabase=configured?createClient(config.supabaseUrl,config.publishableKey,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'atelier04-private-archive-auth'}}):null;
export const appURL=new URL('./index.html',location.href).href;
