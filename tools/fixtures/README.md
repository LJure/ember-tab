# Local HTTPS test fixture

`loopback-test.crt` and `loopback-test.key` are public, disposable test material for
the loopback WebDAV fixture. They contain no production credentials and must never
be used for a real service. The certificate covers localhost and 127.0.0.1.

The Chrome feature runner permits this certificate's public key only in its
isolated test profile. These files and that browser option are excluded from both
extension packages.
