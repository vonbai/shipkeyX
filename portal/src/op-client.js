export class SecretProviderClient {
  async validateReference(referenceUri) {
    if (!referenceUri.startsWith("op://")) {
      return { ok: false, reason: "Only op:// references are currently supported in MVP." };
    }
    return { ok: true };
  }

  async resolvePreview(_referenceUri) {
    return "[preview unavailable in MVP]";
  }
}
