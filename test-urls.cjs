const http = require('http');

const url = '/services/geminiService.ts';

http.get('http://localhost:3000' + url, { headers: { 'Accept': '*/*', 'Sec-Fetch-Dest': 'script' } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
      console.log(res.statusCode);
      console.log(data.match(/from\s+["'](.*prompt.*)["']/)[1]);
  });
}).on('error', (e) => {
  console.error(e.message);
});
