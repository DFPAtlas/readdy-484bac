#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
certs="$(mktemp -d)"
trap 'rm -rf "$certs"' EXIT
umask 077
for ca in client server rogue; do
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=synthetic-$ca"     -keyout "$certs/$ca-ca.key" -out "$certs/$ca-ca.pem" >/dev/null 2>&1
  openssl req -new -newkey rsa:2048 -nodes -subj "/CN=synthetic-$ca-leaf"     -keyout "$certs/$ca.key" -out "$certs/$ca.csr" >/dev/null 2>&1
  if [[ "$ca" == server ]]; then
    printf 'extendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n' > "$certs/$ca.ext"
  else
    printf 'extendedKeyUsage=clientAuth\n' > "$certs/$ca.ext"
  fi
  openssl x509 -req -days 1 -in "$certs/$ca.csr" -CA "$certs/$ca-ca.pem"     -CAkey "$certs/$ca-ca.key" -CAcreateserial -extfile "$certs/$ca.ext"     -out "$certs/$ca.pem" >/dev/null 2>&1
done
image="${IDENTITY_TEST_IMAGE:-quickguard-identity-phase3b:validation}"
docker build -t "$image" workers/identity-documents
# Only short-lived synthetic leaf keys need to be readable by the image UID.
chmod 755 "$certs"
chmod 444 "$certs"/{client,server,rogue}.{pem,key} "$certs"/*-ca.pem
docker run --rm --network none --cap-drop ALL \
  --security-opt no-new-privileges --read-only --tmpfs /tmp:rw,nosuid,nodev,noexec,size=8m \
  --memory 512m --cpus 1 --pids-limit 32 -e PYTHONPATH=/app \
  -v "$certs:/certs:ro" -v "$PWD/tests/identity-queue:/tests:ro" \
  --entrypoint python "$image" -m unittest discover -s /tests -p '*_test.py' -v
