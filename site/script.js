const patternInput = document.getElementById('pattern');
const sampleInput = document.getElementById('sample');
const output = document.getElementById('output');

function testRegex() {
  const pattern = patternInput.value;
  const text = sampleInput.value;
  output.textContent = '';
  if (!pattern) return;

  let regex;
  try {
    regex = new RegExp(pattern);
  } catch (e) {
    output.textContent = 'Erro na expressão: ' + e.message;
    return;
  }

  const match = regex.exec(text);
  if (match) {
    output.textContent = `Encontrado: "${match[0]}" na posição ${match.index}`;
  } else {
    output.textContent = 'Nenhuma correspondência encontrada.';
  }
}

patternInput.addEventListener('input', testRegex);
sampleInput.addEventListener('input', testRegex);
