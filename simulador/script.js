// ========== Simulador GR ==========
function parseGrammar(text) {
  const prods = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (let line of lines) {
    const [left, right] = line.split('->').map(x => x.trim());
    if (!prods[left]) prods[left] = [];
    right.split('|').forEach(r => prods[left].push(r.trim() === 'eps' ? '' : r.trim()));
  }
  return prods;
}

function accepts(grammar, str) {
  const start = Object.keys(grammar)[0];
  function dfs(sym, idx) {
    if (idx === str.length && (grammar[sym]||[]).includes('')) return true;
    for (let rule of grammar[sym]||[]) {
      if (rule === '') continue;
      const [a, B] = [rule[0], rule.slice(1).trim()];
      if (str[idx] === a) {
        if (B === '' && idx+1 === str.length) return true;
        if (B && dfs(B, idx+1)) return true;
      }
    }
    return false;
  }
  return dfs(start,0);
}

document.getElementById('test-btn').onclick = () => {
  const g = parseGrammar(document.getElementById('grammar').value);
  const w = document.getElementById('test-string').value;
  const res = accepts(g,w);
  document.getElementById('result').textContent = res ? 'ACEITA' : 'REJEITA';
};

// ========== AF Editor ==========
jsPlumb.ready(() => {
  const instance = jsPlumb.getInstance({
    Connector: ["Bezier", { curviness: 30 }],
    Endpoint: ["Dot", { radius: 4 }],
    PaintStyle: { stroke: "#2b6cb0", strokeWidth: 2 },
    HoverPaintStyle: { stroke: "#0b5cff", strokeWidth: 3 },
    ConnectionOverlays: [
      ["Arrow", { 
        location: 1, 
        width: 10, 
        length: 10, 
        foldback: 0.8 
      }]
    ],
    Container: "af-canvas"
  });

  const canvas = document.getElementById('af-canvas');
  let stateCounter = 0;
  let mode = null;
  let startState = null;
  const finals = new Set();
  let selected = null;
  const transitions = {}; // {from: {symbol: to}}

  function addState(x = 50, y = 50) {
    const id = 'q' + (stateCounter++);
    const div = document.createElement('div');
    div.className = 'state';
    div.id = id;
    div.textContent = id;
    div.style.left = x + 'px';
    div.style.top = y + 'px';
    canvas.appendChild(div);

    // Configurar como draggable
    instance.draggable(div, {
      containment: true
    });

    // Configurar endpoints
    instance.makeSource(div, {
      filter: ".state",
      anchor: "Continuous",
      connectorStyle: { stroke: "#2b6cb0", strokeWidth: 2 },
      connectionType: "basic",
      extract: {
        "action": "the-action"
      }
    });

    instance.makeTarget(div, {
      dropOptions: { hoverClass: "dragHover" },
      anchor: "Continuous",
      allowLoopback: true
    });

    div.onclick = (e) => {
      e.stopPropagation();
      
      if (mode === 'start') {
        if (startState) {
          document.getElementById(startState).style.outline = '';
        }
        startState = id;
        div.style.outline = '3px solid #0b5cff';
        mode = null;
        
      } else if (mode === 'final') {
        if (finals.has(id)) {
          finals.delete(id);
          div.style.border = '2px solid #2b6cb0';
        } else {
          finals.add(id);
          div.style.border = '4px double #1f7a1f';
        }
        mode = null;
        
      } else if (mode === 'connect') {
        if (!selected) {
          selected = id;
          div.style.boxShadow = '0 0 0 4px rgba(11,92,255,0.3)';
        } else if (selected !== id) {
          const label = prompt('Símbolo da transição:', 'a');
          if (label && label.trim()) {
            const connection = instance.connect({
              source: selected,
              target: id,
              overlays: [
                ["Arrow", { 
                  location: 1, 
                  width: 10, 
                  length: 10 
                }],
                ["Label", { 
                  label: label.trim(), 
                  id: "label",
                  cssClass: "connection-label"
                }]
              ]
            });

            if (!transitions[selected]) transitions[selected] = {};
            transitions[selected][label.trim()] = id;
          }
          
          document.getElementById(selected).style.boxShadow = '';
          selected = null;
          mode = null;
        }
      }
    };

    return div;
  }

  // Event listeners
  document.getElementById('add-state').onclick = () => {
    const x = 60 + (stateCounter % 8) * 80;
    const y = 60 + Math.floor(stateCounter / 8) * 80;
    addState(x, y);
  };

  document.getElementById('set-start').onclick = () => {
    mode = mode === 'start' ? null : 'start';
    document.getElementById('set-start').style.background = mode === 'start' ? '#ff6b35' : '#0b5cff';
  };

  document.getElementById('toggle-final').onclick = () => {
    mode = mode === 'final' ? null : 'final';
    document.getElementById('toggle-final').style.background = mode === 'final' ? '#ff6b35' : '#0b5cff';
  };

  document.getElementById('connect-mode').onclick = () => {
    if (mode === 'connect') {
      // Cancelar modo de conexão
      mode = null;
      document.getElementById('connect-mode').style.background = '#0b5cff';
      document.getElementById('connect-mode').textContent = 'Conectar';
      if (selected) {
        document.getElementById(selected).style.boxShadow = '';
        selected = null;
      }
    } else {
      // Ativar modo de conexão
      mode = 'connect';
      document.getElementById('connect-mode').style.background = '#ff6b35';
      document.getElementById('connect-mode').textContent = 'Cancelar';
      // Limpar outros modos
      document.getElementById('set-start').style.background = '#0b5cff';
      document.getElementById('toggle-final').style.background = '#0b5cff';
    }
  };

  document.getElementById('clear-all').onclick = () => {
    instance.deleteEveryConnection();
    canvas.innerHTML = '';
    stateCounter = 0;
    startState = null;
    finals.clear();
    for (let k in transitions) delete transitions[k];
    mode = null;
    selected = null;
    
    // Reset button styles
    document.getElementById('set-start').style.background = '#0b5cff';
    document.getElementById('toggle-final').style.background = '#0b5cff';
    document.getElementById('connect-mode').style.background = '#0b5cff';
  };

  document.getElementById('simulate').onclick = () => {
    const input = document.getElementById('af-string').value;
    if (!startState) {
      document.getElementById('af-result').textContent = 'Defina um estado inicial!';
      return;
    }
    
    let current = startState;
    let ok = true;
    let path = [current];
    
    for (let ch of input) {
      if (transitions[current] && transitions[current][ch]) {
        current = transitions[current][ch];
        path.push(current);
      } else {
        ok = false;
        break;
      }
    }
    
    const res = ok && finals.has(current);
    const pathStr = path.join(' → ');
    document.getElementById('af-result').textContent = 
      `${res ? 'ACEITA' : 'REJEITA'}\nCaminho: ${pathStr}`;
  };

  // Adicionar estados iniciais de exemplo
  const state1 = addState(100, 150);
  const state2 = addState(300, 150);
  
  // Marcar o primeiro como inicial
  startState = state1.id;
  state1.style.outline = '3px solid #0b5cff';
});
