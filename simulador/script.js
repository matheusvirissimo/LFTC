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
    Container: "af-canvas",
    // Configurações de performance otimizadas
    ReattachConnections: true,
    MaxConnections: -1,
    DragOptions: {
      cursor: 'move',
      zIndex: 2000,
      containment: true,
      grid: [1, 1], // Movimento suave pixel por pixel
      start: function(params) {
        params.drag.style.transition = 'none';
      },
      stop: function(params) {
        params.drag.style.transition = '';
      }
    },
    // Otimizações de rendering
    RepaintEverythingThrottleTimeout: 8, // 120fps para movimento mais suave
    BeforeDetach: function(connection) {
      return true;
    },
    BeforeDrop: function(params) {
      return true;
    }
  });

  const canvas = document.getElementById('af-canvas');
  let stateCounter = 0;
  let currentMode = null; // 'add', 'start', 'final', 'connect', 'delete'
  let startState = null;
  const finals = new Set();
  let selected = null;
  const transitions = {}; // {from: {symbol: to}}

  // Variáveis para otimização de performance
  let repaintTimeout = null;
  let isDragging = false;

  // Função para limpar todos os modos ativos
  function clearAllModes() {
    currentMode = null;
    selected = null;
    
    // Reset visual dos botões
    const buttons = ['add-state', 'set-start', 'toggle-final', 'connect-mode', 'delete-state'];
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
    
    // Limpar todas as classes específicas de modo
    indicator.classList.remove('active', 'delete-mode');
    
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
      case 'delete':
        indicator.textContent = 'Modo: Apagar Estados - Clique nos estados para remover';
        indicator.classList.add('active', 'delete-mode');
        break;
      default:
        indicator.textContent = 'Clique em um botão para começar';
        indicator.classList.remove('active');
    }
  }

  // Função para atualizar a aparência de um estado
  function updateStateAppearance(stateElement, stateId) {
    if (!stateElement) return;
    
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

  // Função otimizada para repaint com throttling
  function throttledRepaint() {
    if (repaintTimeout) return;
    repaintTimeout = requestAnimationFrame(() => {
      instance.repaintEverything();
      repaintTimeout = null;
    });
  }

  // Função para repaint em tempo real durante o drag
  function realTimeRepaint(element) {
    instance.repaint(element);
  }

  // Função para reinicializar jsPlumb para um elemento
  function reinitializeJsPlumbForElement(element) {
    // Remover configurações antigas
    instance.removeAllEndpoints(element);
    instance.detachAllConnections(element);
    
    // Configuração otimizada para movimento natural
    instance.draggable(element, {
      containment: true,
      cursor: 'move',
      grid: [1, 1], // Movimento pixel por pixel para suavidade
      start: function(event) {
        isDragging = true;
        element.style.zIndex = '1000';
        element.style.transition = 'none'; // Remove transições CSS durante o drag
      },
      drag: function(event) {
        // Repaint em tempo real das conexões
        realTimeRepaint(element);
      },
      stop: function(event) {
        isDragging = false;
        element.style.zIndex = '';
        element.style.transition = ''; // Restaura transições CSS
        // Repaint final
        throttledRepaint();
      }
    });

    instance.makeSource(element, {
      filter: ".state",
      anchor: "Continuous",
      connectorStyle: { stroke: "#2b6cb0", strokeWidth: 2 },
      connectionType: "basic",
      maxConnections: -1
    });

    instance.makeTarget(element, {
      dropOptions: { 
        hoverClass: "dragHover",
        tolerance: "pointer" // Melhora a responsividade do drop
      },
      anchor: "Continuous",
      allowLoopback: true,
      maxConnections: -1
    });
    
    instance.revalidate(element);
  }

  // Função para apagar um estado
  function deleteState(stateId) {
    const element = document.getElementById(stateId);
    if (!element) return;

    console.log('Deletando estado:', stateId); // Debug

    // Primeiro, remover todas as conexões do jsPlumb
    const connections = instance.getConnections();
    connections.forEach(conn => {
      if (conn.sourceId === stateId || conn.targetId === stateId) {
        instance.deleteConnection(conn);
      }
    });

    // Remover endpoints
    instance.removeAllEndpoints(element);

    // Limpar das variáveis de controle
    if (startState === stateId) {
      startState = null;
    }
    finals.delete(stateId);

    // Remover das transições (tanto como origem quanto como destino)
    delete transitions[stateId];
    Object.keys(transitions).forEach(from => {
      Object.keys(transitions[from]).forEach(symbol => {
        if (transitions[from][symbol] === stateId) {
          delete transitions[from][symbol];
        }
      });
      // Remover objetos vazios
      if (Object.keys(transitions[from]).length === 0) {
        delete transitions[from];
      }
    });

    // Remover o elemento do DOM por último
    element.remove();

    // Repaint otimizado sem delay
    throttledRepaint();
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

    // Configuração otimizada para movimento natural
    // Configurar como draggable
    instance.draggable(div, {
      containment: true,
      cursor: 'move',
      grid: [1, 1], // Movimento pixel por pixel para suavidade
      start: function(event) {
        isDragging = true;
        div.style.zIndex = '1000';
        div.style.transition = 'none'; // Remove transições CSS durante o drag
      },
      drag: function(event) {
        // Repaint em tempo real das conexões
        realTimeRepaint(div);
      },
      stop: function(event) {
        isDragging = false;
        div.style.zIndex = '';
        div.style.transition = ''; // Restaura transições CSS
        // Repaint final
        throttledRepaint();
      }
    });

    // Configurar endpoints com melhor estilo e performance
    instance.makeSource(div, {
      filter: ".state",
      anchor: "Continuous",
      connectorStyle: { stroke: "#2b6cb0", strokeWidth: 2 },
      connectionType: "basic",
      maxConnections: -1
    });

    instance.makeTarget(div, {
      dropOptions: { 
        hoverClass: "dragHover",
        tolerance: "pointer" // Melhora a responsividade do drop
      },
      anchor: "Continuous",
      allowLoopback: true,
      maxConnections: -1
    });
    
    // Revalidação imediata do elemento
    instance.revalidate(div);

    div.onclick = (e) => {
      e.stopPropagation();
      
      if (currentMode === 'start') {
        // Remover estado inicial anterior de TODOS os estados
        document.querySelectorAll('.state').forEach(state => {
          state.classList.remove('initial');
        });
        
        // Definir novo estado inicial
        startState = id;
        div.classList.add('initial');
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
        
      } else if (currentMode === 'delete') {
        // Apagar estado diretamente sem confirmação
        console.log('Modo delete ativo, deletando estado:', id); // Debug
        deleteState(id);
        // Manter o modo delete ativo para apagar outros estados
        
      } else if (currentMode === 'connect') {
        if (!selected) {
          selected = id;
          div.classList.add('selected');
          updateModeIndicator();
        } else {
          // Permitir conexão para o mesmo estado (self-loop) ou estados diferentes
          const label = prompt('Símbolo da transição:', '');
          if (label && label.trim()) {
            // Verificar se já existe uma transição com esse símbolo do estado origem
            const symbolExists = transitions[selected] && transitions[selected][label.trim()];
            
            
              // Garantir que os elementos existem e estão posicionados
              const sourceElement = document.getElementById(selected);
              const targetElement = document.getElementById(id);
              
              if (sourceElement && targetElement) {
                // Revalidar os elementos antes de criar a conexão
                instance.revalidate(sourceElement);
                instance.revalidate(targetElement);
                
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
                
                // Repaint otimizado após criar a conexão
                throttledRepaint();
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
      
      // Adicionar estado e garantir que seja configurado corretamente
      const newState = addState(x, y);
      
      // Repaint otimizado sem delay
      throttledRepaint();
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
        // Remover todos os elementos gerenciados pelo jsPlumb primeiro
        const allStates = canvas.querySelectorAll('.state');
        allStates.forEach(state => {
          instance.removeAllEndpoints(state);
          instance.detachAllConnections(state);
        });
        
        // Limpar todas as conexões
        instance.deleteEveryConnection();
        
        // Limpar o canvas
        canvas.innerHTML = '';
        
        // Reset das variáveis
        stateCounter = 0;
        startState = null;
        finals.clear();
        for (let k in transitions) delete transitions[k];
        
        // Limpar modos ativos
        clearAllModes();
        
        // Repaint otimizado
        throttledRepaint();
      }
    };
  }

  // Handler para o botão de deletar estados
  const deleteStateBtn = document.getElementById('delete-state');
  if (deleteStateBtn) {
    deleteStateBtn.onclick = () => {
      if (currentMode === 'delete') {
        clearAllModes();
      } else {
        clearAllModes();
        currentMode = 'delete';
        deleteStateBtn.classList.add('active');
        updateModeIndicator();
      }
    };
  }

  // Função para simular autômato com self-loops (repetição 0 ou mais vezes)
  function simulateAutomaton(input) {
    if (!startState || finals.size === 0) {
      return { accepted: false, path: [], error: !startState ? 'Defina um estado inicial!' : 'Defina pelo menos um estado final!' };
    }
    
    // Função recursiva para explorar todos os caminhos possíveis
    function exploreStates(currentState, inputIndex, currentPath) {
      // Se chegou ao fim da string, verificar se está em estado final
      if (inputIndex >= input.length) {
        if (finals.has(currentState)) {
          return { accepted: true, path: [...currentPath] };
        }
        return null;
      }
      
      const currentChar = input[inputIndex];
      
      // Se não há transições deste estado, falha
      if (!transitions[currentState]) {
        return null;
      }
      
      // Verificar se há transição para o caractere atual
      if (transitions[currentState][currentChar]) {
        const nextState = transitions[currentState][currentChar];
        
        // Se é self-loop (mesmo estado), pode consumir múltiplos caracteres iguais
        if (nextState === currentState) {
          // Tentar consumir 0 ou mais caracteres iguais consecutivos
          let maxRepeat = 0;
          for (let i = inputIndex; i < input.length && input[i] === currentChar; i++) {
            maxRepeat++;
          }
          
          // Tentar todas as possibilidades: 0, 1, 2, ..., maxRepeat repetições
          for (let repeat = maxRepeat; repeat >= 0; repeat--) {
            const newPath = [...currentPath];
            
            // Adicionar os self-loops no caminho
            for (let i = 0; i < repeat; i++) {
              newPath.push(currentState);
            }
            
            const result = exploreStates(currentState, inputIndex + repeat, newPath);
            if (result && result.accepted) {
              return result;
            }
          }
          
          return null;
        } else {
          // Transição normal para outro estado
          const newPath = [...currentPath, nextState];
          return exploreStates(nextState, inputIndex + 1, newPath);
        }
      }
      
      // Tentar continuar no mesmo estado se houver self-loops de outros símbolos
      // (isso permite pular caracteres se houver epsilon-transições implícitas)
      
      return null;
    }
    
    const result = exploreStates(startState, 0, [startState]);
    return result || { accepted: false, path: [startState], error: null };
  }

  const simulateBtn = document.getElementById('simulate');
  if (simulateBtn) {
    simulateBtn.onclick = () => {
      const inputField = document.getElementById('af-string');
      const resultField = document.getElementById('af-result');
      
      if (!inputField || !resultField) return;
      
      const input = inputField.value;
      
      const result = simulateAutomaton(input);
      
      if (result.error) {
        resultField.textContent = `Erro: ${result.error}`;
        return;
      }
      
      const pathStr = result.path.join(' → ');
      const finalStates = Array.from(finals).join(', ');
      
      resultField.textContent = 
        `Resultado: ${result.accepted ? 'ACEITA' : 'REJEITA'}\n` +
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
