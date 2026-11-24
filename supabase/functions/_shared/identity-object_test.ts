import { matchesCapturedDocument, readBrokerBody, sha256 } from './identity-object.ts';

Deno.test('broker releases only nonempty matching bytes for the still-current digest', async () => {
  const data = new TextEncoder().encode('synthetic document').buffer;
  const digest = await sha256(data);
  if (!await matchesCapturedDocument(data, digest, digest)) throw new Error('Valid digest rejected');
  for (const current of [null, 'a'.repeat(64)]) {
    if (await matchesCapturedDocument(data, digest, current)) throw new Error('Changed reference accepted');
  }
  const tampered = new TextEncoder().encode('tampered synthetic document').buffer;
  if (await matchesCapturedDocument(tampered, digest, digest)) throw new Error('Changed content accepted');
});

Deno.test('broker rejects malformed or oversized bodies', async () => {
  const request = (body: string) => new Request('https://synthetic.invalid', { method: 'POST', body });
  if (!(await readBrokerBody(request('{"ready":true}')))?.ready) throw new Error('Valid body rejected');
  for (const body of ['null', '[]', 'not-json', '{"padding":"' + 'a'.repeat(1024) + '"}']) {
    if (await readBrokerBody(request(body))) throw new Error('Invalid body accepted');
  }
});
