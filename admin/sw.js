/* CGA ADMIN PWA v1 — online only. No Cache Storage, IndexedDB or background send. */
"use strict";
self.addEventListener("install",()=>{/* Normal service worker lifecycle; never force a reload. */});
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
const OFFLINE_HTML='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>CGA ADMIN | Sin conexión</title><style>html{color-scheme:dark;font-family:Arial,Helvetica,sans-serif;background:#161616;color:#D7D7D5}body{margin:0;padding:32px 20px}main{max-width:440px;margin:10vh auto;line-height:1.6}h1{font-size:24px}a{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border:1px solid #09B3DC;border-radius:8px;color:#D7D7D5;text-decoration:none}a:focus-visible{outline:2px solid #09B3DC;outline-offset:3px}</style></head><body><main><h1>Sin conexión</h1><p>CGA ADMIN necesita Internet para consultar información privada. No se guardan correos ni documentos para uso offline.</p><a href="/admin/">Volver a intentar</a></main></body></html>';
self.addEventListener("fetch",event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=="GET"||request.mode!=="navigate"||url.origin!==self.location.origin||!["/admin/","/admin/index.html"].includes(url.pathname))return;
 // Only the top-level admin navigation is handled. Every request goes to the network.
 // API requests, credentials, signed URLs, PDFs, uploads and public pages are never intercepted.
 event.respondWith(fetch(request,{cache:"no-store"}).catch(()=>new Response(OFFLINE_HTML,{status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'","Referrer-Policy":"no-referrer"}})));
});
