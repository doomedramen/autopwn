// Polyfill for crypto.randomUUID in environments that don't support it
if (typeof window !== 'undefined' && window.crypto && !window.crypto.randomUUID) {
  // @ts-ignore
  window.crypto.randomUUID = function randomUUID() {
    return (String(1e7) + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) => {
      const num = Number(c);
      return (num ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (num / 4)))).toString(16);
    });
  };
}
