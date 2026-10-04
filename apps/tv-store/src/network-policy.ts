export function isPrivateLanIpv4Address(value: string): boolean {
  const parts = value.split(".");
  if (
    parts.length !== 4 ||
    parts.some(
      (part) => !/^\d{1,3}$/u.test(part) || String(Number(part)) !== part,
    )
  )
    return false;
  const octets = parts.map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) return false;
  const [first = -1, second = -1] = octets;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}
