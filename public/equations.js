// Générateur d'équations (repris de la version solo)
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function nonZero(min, max) { let v; do { v = randInt(min, max); } while (v === 0); return v; }

function genLinear() {
  const a = nonZero(-9, 9);
  const x = nonZero(-10, 10);
  const b = -a * x;
  const fmt = (n) => n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`;
  return { eq: `${a}x ${fmt(b)} = 0`, answers: [x] };
}

function genLinearBothSides() {
  const a = nonZero(-9, 9);
  const c = nonZero(-9, 9);
  if (a === c) return genLinearBothSides();
  const x = nonZero(-10, 10);
  const b = randInt(-15, 15);
  const d = (a - c) * x + b;
  const fmt = (n) => n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`;
  return { eq: `${a}x ${fmt(b)} = ${c}x ${fmt(d)}`, answers: [x] };
}

function genQuadratic() {
  const r1 = randInt(-6, 6);
  const r2 = randInt(-6, 6);
  const b = -(r1 + r2);
  const c = r1 * r2;
  const fmt = (n) => n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`;
  let eq = `x²`;
  if (b !== 0) eq += ` ${fmt(b)}x`;
  if (c !== 0) eq += ` ${fmt(c)}`;
  eq += ' = 0';
  const answers = r1 === r2 ? [r1] : [Math.min(r1, r2), Math.max(r1, r2)];
  return { eq, answers };
}

function generateEquation(mode) {
  let pool;
  if (mode === 'easy') pool = [genLinear, genLinear, genLinearBothSides];
  else if (mode === 'medium') pool = [genLinear, genLinearBothSides, genQuadratic, genQuadratic];
  else pool = [genLinear, genLinearBothSides, genQuadratic, genQuadratic, genQuadratic];
  return pool[randInt(0, pool.length - 1)]();
}

// Export global
window.Equations = { generateEquation };