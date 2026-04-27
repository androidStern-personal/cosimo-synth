const extensionNoisePatterns = [
  /failed to connect to metamask/i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
];

const getErrorText = (value: unknown) => {
  if (value instanceof Error) {
    return `${value.name}\n${value.message}\n${value.stack ?? ""}`;
  }

  if (typeof value === "object" && value !== null) {
    const maybeError = value as { message?: unknown; stack?: unknown; reason?: unknown };
    return [
      typeof maybeError.message === "string" ? maybeError.message : "",
      typeof maybeError.stack === "string" ? maybeError.stack : "",
      typeof maybeError.reason === "string" ? maybeError.reason : "",
    ].join("\n");
  }

  return String(value ?? "");
};

const isExtensionNoise = (text: string) =>
  extensionNoisePatterns.some((pattern) => pattern.test(text));

if (typeof window !== "undefined") {
  window.addEventListener(
    "error",
    (event) => {
      const text = [event.message, event.filename, getErrorText(event.error)].join("\n");
      if (!isExtensionNoise(text)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      const text = getErrorText(event.reason);
      if (!isExtensionNoise(text)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
}
