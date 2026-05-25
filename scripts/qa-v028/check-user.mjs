import WebSocket from 'ws';

const wsUrl = process.argv[2];
if (!wsUrl) { console.error('missing wsUrl'); process.exit(1); }

const ws = new WebSocket(wsUrl);
let id = 1;
const pending = new Map();
function send(method, params={}) {
  return new Promise((resolve) => {
    const myId = id++;
    pending.set(myId, resolve);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
}
ws.on('message', (data) => {
  const m = JSON.parse(data.toString());
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
ws.on('open', async () => {
  await send('Runtime.enable');
  const res = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const { Preferences } = window.Capacitor.Plugins;
        const session = await Preferences.get({ key: 'sb-guefraaqbkcehofchnrc-auth-token' });
        let email = 'unknown';
        try {
          const json = JSON.parse(session.value || 'null');
          email = json?.user?.email || json?.currentSession?.user?.email || 'no-email-in-session';
        } catch (e) { email = 'session parse fail: ' + e.message; }
        return {
          url: window.location.href,
          pathname: window.location.pathname,
          email,
          devLog: document.body.innerText.slice(0, 600)
        };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log(JSON.stringify(res.result?.result?.value, null, 2));
  ws.close();
});
