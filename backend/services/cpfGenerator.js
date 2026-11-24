function generateCPF() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));

  const calcCheckDigit = (base) => {
    const sum = base.reduce((acc, digit, idx) => acc + digit * ((base.length + 1) - idx), 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calcCheckDigit(n);
  const d2 = calcCheckDigit([...n, d1]);

  return [...n, d1, d2].join('');
}

module.exports = generateCPF;
