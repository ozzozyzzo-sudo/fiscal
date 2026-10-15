import https from 'https';
import fs from 'fs';
import path from 'path';

const TOKEN = 'LVBQNfVyqyNZeUtDDUi6ZM4eTjCGzSMfNsvCMy_h0wgEbWtDnVeKXP3ceFaoXvGGM9L0l2h3JfgCMUHeWSfHwxOZYqI0VHQ3Aixodvw4PSPHfpyEtWvBRVzlTzXzxJ4NZwYFNAo3YyIoZxJpUx56dAFfTlvXb6gLkX9bzwX6_YtmqmaqKAMKFane30IDyzPp';

function fetchQuery(whereClause, count) {
  return new Promise((resolve) => {
    const q = new URLSearchParams({
      where: whereClause,
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'geojson',
      resultRecordCount: String(count),
      orderByFields: 'OBJECTID_1 ASC',
      token: TOKEN,
    });

    const options = {
      hostname: 'geo.londrina.pr.gov.br',
      port: 443,
      path: '/server/rest/services/BCIntranet/Base_de_Lotes_Urbanos_com_atualiza%C3%A7%C3%A3o_di%C3%A1ria/MapServer/0/query?' + q.toString(),
      method: 'GET',
      headers: {
        referer: 'https://geo.londrina.pr.gov.br',
      },
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.features || []);
        } catch (e) {
          resolve([]);
        }
      });
    });

    req.on('error', () => resolve([]));
    req.end();
  });
}

async function run() {
  console.log('Downloading initial cached lots: Centro (600) + Palhano (600)...');
  const t0 = Date.now();
  const centro = await fetchQuery("NOME_LOTE LIKE '%CENTRO%'", 600);
  console.log(`Centro fetched: ${centro.length} lots`);
  const palhano = await fetchQuery("NOME_LOTE LIKE '%PALHANO%'", 600);
  console.log(`Palhano fetched: ${palhano.length} lots`);

  const combined = [...centro, ...palhano];
  const cacheDir = path.resolve('.data_cache');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  const payload = {
    type: 'FeatureCollection',
    features: combined,
    properties: {
      totalCadastradoLondrina: 342483,
      cachedLots: combined.length,
      regionsIncluded: ['Centro (600 lotes)', 'Gleba Palhano (600 lotes)'],
      generatedAt: new Date().toISOString(),
    },
  };

  fs.writeFileSync(path.join(cacheDir, 'lotes_iniciais.json'), JSON.stringify(payload));
  console.log(`Successfully saved ${combined.length} lotes in ${Date.now() - t0}ms to .data_cache/lotes_iniciais.json`);
}

run();
