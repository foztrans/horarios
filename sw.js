// Service worker do aplicativo "Ônibus de Foz do Iguaçu".
// O que ele faz: guarda no aparelho a página, os ícones, a biblioteca do mapa e as fontes.
//  - Página e arquivos do aplicativo: busca sempre a versão nova na internet; sem internet, usa a cópia guardada.
//    Por isso, para atualizar o aplicativo basta trocar o index.html no servidor: quem já instalou recebe na próxima abertura.
//  - Fontes: usa a cópia guardada e só baixa na primeira vez.
//  - Dados das linhas e posição dos ônibus (Apps Script), mapa de fundo e rotas a pé: sempre da internet, nada é guardado aqui.
// Só mude o nome abaixo se quiser forçar todos os aparelhos a apagar o que guardaram.
const VERSAO = 'onibus-foz-v1';
const FIXOS = ['./', 'manifest.webmanifest', 'vendor/leaflet.js', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(FIXOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    e.respondWith(
      fetch(r, { cache: 'no-cache' }).then(resp => {
        if (resp.ok) { const copia = resp.clone(); caches.open(VERSAO).then(c => c.put(r, copia)); }
        return resp;
      }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('./')))
    );
    return;
  }
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(resp => {
      if (resp.ok || resp.type === 'opaque') { const copia = resp.clone(); caches.open(VERSAO).then(c => c.put(r, copia)); }
      return resp;
    })));
  }
});
