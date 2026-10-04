# Staging Signing Key Backup

The operational private key is an encrypted Ed25519 PKCS#8 PEM stored outside Git at `%LOCALAPPDATA%\ZUI-WebOS\keys\staging-release-ed25519.pem`. Its passphrase is not stored by the platform.

Back up manually:

1. Copy the **encrypted PEM** to independent off-device storage with access controls.
2. Back up the passphrase separately from the PEM, preferably in a trusted password manager or separate physical custody channel.
3. Record the public key ID and verify that the backup PEM unlocks and derives that ID in a controlled recovery test.
4. Keep `repository/trust/keys.json` as public metadata; it is not a private-key backup.

Loss of either the encrypted PEM or passphrase means no future release can be signed by that key. Do not overwrite the only key, upload it to GitHub, attach it to a release, place it in CI artifacts, email/chat it, or store its passphrase beside it.

On Windows the generator removes inherited ACLs and grants the current Windows identity full control on the key directory/file using `icacls`. This is best-effort local access control, not hardware-backed protection and not a defense against administrators, malware, memory inspection, or a compromised user account. Encryption at rest and independent backup remain mandatory.
