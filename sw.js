// Service worker do aplicativo "Ônibus de Foz do Iguaçu".
// O que ele faz: guarda no aparelho a página, os ícones, a biblioteca do mapa e as fontes.
//  - Página e arquivos do aplicativo: busca sempre a versão nova na internet; sem internet, usa a cópia guardada.
//    Por isso, para atualizar o aplicativo basta trocar o index.html no servidor: quem já instalou recebe na próxima abertura.
//  - Fontes: usa a cópia guardada e só baixa na primeira vez.
//  - Mapa de fundo (ruas): cada pedaço que a pessoa já viu fica guardado no aparelho (até FUNDO_MAX pedaços, por até 30 dias).
//    Sem internet, as regiões já vistas continuam com as ruas; com internet, o pedaço guardado é usado e só é renovado depois de 30 dias
//    (isso também economiza a cota do MapTiler). Nada é baixado de antemão: só o que a própria pessoa olhou.
//  - Dados das linhas e posição dos ônibus, rotas a pé e busca de endereços: sempre da internet.
// Só mude o nome abaixo se quiser forçar todos os aparelhos a apagar o que guardaram.
const VERSAO = 'onibus-foz-v1';
const FIXOS = ['./', 'manifest.webmanifest', 'vendor/leaflet.js', 'icons/icon-192.png', 'icons/icon-512.png'];
const FUNDO = 'onibus-foz-fundo', FUNDO_MAX = 1500, FUNDO_DIAS = 30;
const FUNDO_RE = /^https:\/\/(api\.maptiler\.com\/maps\/|tile\.openstreetmap\.org\/|[a-d]\.basemaps\.cartocdn\.com\/)/;
let fundoN = 0;
function guardaFundo(r, resp) {
  if (!resp || !resp.ok || resp.type === 'opaque') return; // só resposta com CORS (as opacas ocupariam espaço demais no aparelho)
  const h = new Headers(resp.headers); h.set('x-guardado', String(Date.now()));
  resp.blob().then(b => caches.open(FUNDO).then(c => c.put(r, new Response(b, { status: resp.status, headers: h }))))
    .then(() => { if (++fundoN % 50 === 0) aparaFundo(); }).catch(() => {});
}
function aparaFundo() { // passou do limite: apaga os mais antigos (a lista vem na ordem em que foram guardados)
  caches.open(FUNDO).then(c => c.keys().then(ks => Promise.all(ks.slice(0, Math.max(0, ks.length - FUNDO_MAX)).map(k => c.delete(k))))).catch(() => {});
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(FIXOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO && k !== FUNDO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
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
  if (FUNDO_RE.test(r.url)) {
    e.respondWith(caches.open(FUNDO).then(c => c.match(r)).then(m => {
      const velho = !m || Date.now() - Number(m.headers.get('x-guardado') || 0) > FUNDO_DIAS * 864e5;
      if (!velho) return m;
      return fetch(r).then(resp => { guardaFundo(r, resp.clone()); return resp; }).catch(() => m || Response.error());
    }));
    return;
  }
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(resp => {
      if (resp.ok || resp.type === 'opaque') { const copia = resp.clone(); caches.open(VERSAO).then(c => c.put(r, copia)); }
      return resp;
    })));
  }
});
