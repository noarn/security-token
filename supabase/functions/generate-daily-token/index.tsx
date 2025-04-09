import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// AES encryption
async function encryptAES(payload, key) {
  const enc = new TextEncoder();
  const data = enc.encode(payload);
  const keyBuffer = enc.encode(key.padEnd(32, ' ')).slice(0, 32);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, 'AES-GCM', false, [
    'encrypt'
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 96 bits
  ;
  const encrypted = await crypto.subtle.encrypt({
    name: 'AES-GCM',
    iv
  }, cryptoKey, data);
  const buffer = new Uint8Array(iv.length + encrypted.byteLength);
  buffer.set(iv, 0);
  buffer.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...buffer));
}
// Função para gerar string aleatória
function randomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(length))).map((x)=>chars.charAt(x % chars.length)).join('');
}
serve(async (req)=>{
  const method = req.method;
  const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!ENCRYPTION_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Missing env vars", {
      status: 500
    });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  if (method === 'POST') {
    const randomValue = randomString(32) // valor aleatório
    ;
    const token = await encryptAES(randomValue, ENCRYPTION_KEY);
    const { error } = await supabase.from('daily_tokens').insert({
      token
    });
    if (error) {
      console.error("Erro ao salvar token:", error);
      return new Response("Erro ao salvar token", {
        status: 500
      });
    }
    return new Response(JSON.stringify({
      token
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
  if (method === 'GET') {
    const { data, error } = await supabase.from('daily_tokens').select('*').order('created_at', {
      ascending: false
    }).limit(1);
    if (error || !data || data.length === 0) {
      return new Response("Token não encontrado", {
        status: 404
      });
    }
    return new Response(JSON.stringify({
      token: data[0].token,
      created_at: data[0].created_at
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
  return new Response("Método não suportado", {
    status: 405
  });
});
