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
    Connector: ["Bezier", { curviness: 50 }],
    Endpoint: ["Dot", { radius: 6 }],
    PaintStyle: { stroke: "#2b6cb0", strokeWidth: 2 },
    HoverPaintStyle: { stroke: "#0b5cff", strokeWidth: 3 },
    ConnectionOverlays: [
      ["Arrow", { 
        location: 1, 
        width: 12, 
        length: 12, 
        foldback: 0.8 
      }]
    ],
    Container: "af-canvas"
  });

  const canvas = document.getElementById('af-canvas');
  let stateCounter = 0;
  let currentMode = null; // 'add', 'start', 'final', 'connect'
  let startState = null;
  const finals = new Set();
  let selected = null;
  const transitions = {}; // {from: {symbol: to}}

  // Função para limpar todos os modos ativos
  function clearAllModes() {
    currentMode = null;
    selected = null;
    
    // Reset visual dos botões
    const buttons = ['add-state', 'set-start', 'toggle-final', 'connect-mode'];
    buttons.forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) btn.classList.remove('active');
    });
    
    // Reset texto do botão de conectar
    const connectBtn = document.getElementById('connect-mode');
    if (connectBtn) connectBtn.textContent = 'Conectar estados';
    
    // Limpar seleções visuais
    document.querySelectorAll('.state').forEach(state => {
      state.classList.remove('selected');
    });
    
    // Atualizar indicador de modo
    updateModeIndicator();
  }

  // Função para atualizar o indicador visual do modo ativo
  function updateModeIndicator() {
    let indicator = document.querySelector('.mode-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'mode-indicator';
      const controls = document.querySelector('.controls');
      if (controls) controls.appendChild(indicator);
    }
    
    switch(currentMode) {
      case 'add':
        indicator.textContent = 'Modo: Adicionar Estados - Clique no canvas';
        indicator.classList.add('active');
        break;
      case 'start':
        indicator.textContent = 'Modo: Definir Estado Inicial - Clique em um estado';
        indicator.classList.add('active');
        break;
      case 'final':
        indicator.textContent = 'Modo: Marcar Estados Finais - Clique nos estados';
        indicator.classList.add('active');
        break;
      case 'connect':
        indicator.textContent = selected ? 'Selecione o estado destino' : 'Selecione o estado origem';
        indicator.classList.add('active');
        break;
      default:
        indicator.textContent = 'Clique em um botão para começar';
        indicator.classList.remove('active');
    }
  }

  // Função para atualizar a aparência de um estado
  function updateStateAppearance(stateElement, stateId) {
    // Remover todas as classes de estado
    stateElement.classList.remove('initial', 'final', 'selected');
    
    // Aplicar classes baseadas no estado atual
    if (startState === stateId) {
      stateElement.classList.add('initial');
    }
    if (finals.has(stateId)) {
      stateElement.classList.add('final');
    }
  }

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
      containment: true,
      drag: function(event) {
        // Callback durante o arraste para manter conexões
        instance.repaintEverything();
      }
    });

    // Configurar endpoints com melhor estilo
    instance.makeSource(div, {
      filter: ".state",
      anchor: "Continuous",
      connectorStyle: { stroke: "#2b6cb0", strokeWidth: 2 },
      connectionType: "basic"
    });

    instance.makeTarget(div, {
      dropOptions: { hoverClass: "dragHover" },
      anchor: "Continuous",
      allowLoopback: true
    });

    div.onclick = (e) => {
      e.stopPropagation();
      
      if (currentMode === 'start') {
        // Remover estado inicial anterior
        if (startState) {
          const oldStart = document.getElementById(startState);
          if (oldStart) updateStateAppearance(oldStart, startState);
        }
        
        // Definir novo estado inicial
        startState = id;
        updateStateAppearance(div, id);
        clearAllModes();
        
      } else if (currentMode === 'final') {
        // Toggle estado final (permite múltiplos)
        if (finals.has(id)) {
          finals.delete(id);
        } else {
          finals.add(id);
        }
        updateStateAppearance(div, id);
        // Não limpar modo - permite marcar múltiplos estados
        
      } else if (currentMode === 'connect') {
        if (!selected) {
          selected = id;
          div.classList.add('selected');
          updateModeIndicator();
        } else if (selected !== id) {
          const label = prompt('Símbolo da transição:', 'a');
          if (label && label.trim()) {
            // Verificar se já existe uma transição com esse símbolo do estado origem
            const symbolExists = transitions[selected] && transitions[selected][label.trim()];
            
            if (symbolExists) {
              alert(`Já existe uma transição com o símbolo "${label.trim()}" do estado ${selected}!`);
            } else {
              const connection = instance.connect({
                source: selected,
                target: id,
                overlays: [
                  ["Arrow", { 
                    location: 1, 
                    width: 12, 
                    length: 12 
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
          }
          
          clearAllModes();
        }
      }
    };

    return div;
  }

  // Event listeners para os botões
  const addStateBtn = document.getElementById('add-state');
  if (addStateBtn) {
    addStateBtn.onclick = () => {
      if (currentMode === 'add') {
        clearAllModes();
      } else {
        clearAllModes();
        currentMode = 'add';
        addStateBtn.classList.add('active');
        updateModeIndicator();
      }
    };
  }

  // Event listener para clique no canvas (adicionar estado)
  canvas.onclick = (e) => {
    if (currentMode === 'add' && e.target === canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(25, Math.min(e.clientX - rect.left - 25, rect.width - 50));
      const y = Math.max(25, Math.min(e.clientY - rect.top - 25, rect.height - 50));
      addState(x, y);
    }
  };

  const setStartBtn = document.getElementById('set-start');
  if (setStartBtn) {
    setStartBtn.onclick = () => {
      if (currentMode === 'start') {
        clearAllModes();
      } else {
        clearAllModes();
        currentMode = 'start';
        setStartBtn.classList.add('active');
        updateModeIndicator();
      }
    };
  }

  const toggleFinalBtn = document.getElementById('toggle-final');
  if (toggleFinalBtn) {
    toggleFinalBtn.onclick = () => {
      if (currentMode === 'final') {
        clearAllModes();
      } else {
        clearAllModes();
        currentMode = 'final';
        toggleFinalBtn.classList.add('active');
        updateModeIndicator();
      }
    };
  }

  const connectBtn = document.getElementById('connect-mode');
  if (connectBtn) {
    connectBtn.onclick = () => {
      if (currentMode === 'connect') {
        clearAllModes();
      } else {
        clearAllModes();
        currentMode = 'connect';
        connectBtn.classList.add('active');
        connectBtn.textContent = 'Cancelar conexão';
        updateModeIndicator();
      }
    };
  }

  const clearBtn = document.getElementById('clear-all');
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (confirm('Tem certeza que deseja limpar tudo?')) {
        instance.deleteEveryConnection();
        canvas.innerHTML = '';
        stateCounter = 0;
        startState = null;
        finals.clear();
        for (let k in transitions) delete transitions[k];
        clearAllModes();
      }
    };
  }

  const simulateBtn = document.getElementById('simulate');
  if (simulateBtn) {
    simulateBtn.onclick = () => {
      const inputField = document.getElementById('af-string');
      const resultField = document.getElementById('af-result');
      
      if (!inputField || !resultField) return;
      
      const input = inputField.value;
      
      if (!startState) {
        resultField.textContent = 'Erro: Defina um estado inicial!';
        return;
      }
      
      if (finals.size === 0) {
        resultField.textContent = 'Erro: Defina pelo menos um estado final!';
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
      const finalStates = Array.from(finals).join(', ');
      
      resultField.textContent = 
        `Resultado: ${res ? 'ACEITA' : 'REJEITA'}\n` +
        `Caminho: ${pathStr}\n` +
        `Estado inicial: ${startState}\n` +
        `Estados finais: {${finalStates}}\n` +
        `String testada: "${input}"`;
    };
  }

  // Inicializar indicador de modo
  updateModeIndicator();

  // Adicionar alguns estados de exemplo
  const state1 = addState(100, 150);
  const state2 = addState(300, 150);
  
  // Marcar o primeiro como inicial
  startState = state1.id;
  updateStateAppearance(state1, state1.id);
});
