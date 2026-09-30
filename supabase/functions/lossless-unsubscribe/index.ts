import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {unsubscribeRequest} from './handler.ts';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
Deno.serve(req=>unsubscribeRequest(req,db));
