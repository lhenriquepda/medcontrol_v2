/**
 * extract-spki.cjs — Extract SHA-256 of SubjectPublicKeyInfo (DER) for SSL Pinning
 * Usa crypto.X509Certificate + publicKey.export('spki','der') — formato correto pro Android
 */
const tls = require('tls');
const crypto = require('crypto');

const HOST = 'guefraaqbkcehofchnrc.supabase.co';
const PORT = 443;

const socket = tls.connect({ host: HOST, port: PORT, servername: HOST }, () => {
  let cur = socket.getPeerCertificate(true);
  const seen = new Set();
  let i = 0;

  console.log(`Cert chain for ${HOST}:${PORT}\n`);

  while (cur && !seen.has(cur.fingerprint256)) {
    seen.add(cur.fingerprint256);
    const role = i === 0 ? 'LEAF' : 'INTERMEDIATE/ROOT';

    // Use raw DER to construct X509Certificate, then export SPKI
    const x509 = new crypto.X509Certificate(cur.raw);
    const spkiDer = x509.publicKey.export({ type: 'spki', format: 'der' });
    const spkiHash = crypto.createHash('sha256').update(spkiDer).digest('base64');

    console.log(`── [${i}] ${role} ──`);
    console.log(`  Subject: ${cur.subject?.CN || JSON.stringify(cur.subject)}`);
    console.log(`  Issuer:  ${cur.issuer?.CN || JSON.stringify(cur.issuer)}`);
    console.log(`  Valid:   ${cur.valid_from} → ${cur.valid_to}`);
    console.log(`  SPKI SHA-256: ${spkiHash}`);
    console.log(`  → <pin digest="SHA-256">${spkiHash}</pin>\n`);

    if (cur.issuerCertificate === cur || !cur.issuerCertificate) break;
    cur = cur.issuerCertificate;
    i++;
  }

  socket.end();
});

socket.on('error', e => { console.error('TLS error:', e.message); process.exit(1); });
