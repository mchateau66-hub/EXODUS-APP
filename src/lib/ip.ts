export function getClientIp(headers: Headers) {
    const xff = headers.get("x-forwarded-for") || "";
    return (
      (xff.split(",")[0] ||
        headers.get("x-real-ip") ||
        headers.get("cf-connecting-ip") ||
        "0.0.0.0")
        .trim()
    );
  }
  