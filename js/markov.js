// markov.js
// Requiere: math.js y Chart.js cargados en HTML
(() => {
  // DOM refs
  const el = id => document.getElementById(id);
  const btnGenerate = el('btnGenerate');
  const btnLoadExample = el('btnLoadExample');
  const btnNormalize = el('btnNormalize');
  const btnCalculate = el('btnCalculate');
  const btnReset = el('btnReset');

  const matrixContainer = el('matrixContainer');
  const vectorContainer = el('vectorContainer');
  const panelResults = el('panel-results');
  const stepsTableContainer = el('stepsTableContainer');
  const interpretation = el('interpretation');
  const application = el('application');
  const chartCanvas = el('markovChart');

  let chartInstance = null;

  // helper: create grid inputs for matrix and vector
  function createMatrixInputs(n) {
    matrixContainer.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'matrix-grid';
    for (let i = 0; i < n; i++) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'matrix-row';
      for (let j = 0; j < n; j++) {
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.01';
        input.min = 0;
        input.max = 1;
        input.value = (i === j ? 0.6 : (0.4 / (n - 1))).toFixed(2);
        input.id = `p_${i}_${j}`;
        rowDiv.appendChild(input);
      }
      grid.appendChild(rowDiv);
    }
    matrixContainer.appendChild(grid);
  }

  function createVectorInputs(n) {
    vectorContainer.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'vector-grid';
    for (let i = 0; i < n; i++) {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.01';
      input.min = 0;
      input.max = 1;
      input.value = (1 / n).toFixed(2);
      input.id = `s0_${i}`;
      div.appendChild(input);
    }
    vectorContainer.appendChild(div);
  }

  // generate based on numEstados
  btnGenerate.addEventListener('click', () => {
    const n = Math.min(8, Math.max(2, parseInt(el('numEstados').value || 3)));
    createMatrixInputs(n);
    createVectorInputs(n);
    btnCalculate.disabled = false;
    panelResults.style.display = 'none';
    stepsTableContainer.innerHTML = '';
    interpretation.innerHTML = '';
    application.innerHTML = '';
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  });

  // load example matrix for quick test
  btnLoadExample.addEventListener('click', () => {
    const n = 3;
    el('numEstados').value = n;
    el('numPasos').value = 4;
    btnGenerate.click();
    setTimeout(() => {
      const values = [
        [0.7, 0.2, 0.1],
        [0.3, 0.4, 0.3],
        [0.2, 0.3, 0.5]
      ];
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          el(`p_${i}_${j}`).value = values[i][j];
      el('s0_0').value = 1;
      el('s0_1').value = 0;
      el('s0_2').value = 0;
    }, 60);
  });

  // normalize rows in-place
  btnNormalize.addEventListener('click', () => {
    const inputs = matrixContainer.querySelectorAll('input');
    if (!inputs.length) return alert('Genere la matriz primero.');
    const firstRowCount = matrixContainer.querySelector('.matrix-row').children.length;
    const n = firstRowCount;
    for (let i = 0; i < n; i++) {
      let row = [];
      for (let j = 0; j < n; j++) row.push(Number(el(`p_${i}_${j}`).value) || 0);
      const s = row.reduce((a, b) => a + b, 0);
      if (s === 0) {
        row = row.map(() => 1 / n);
      } else {
        row = row.map(v => v / s);
      }
      for (let j = 0; j < n; j++) el(`p_${i}_${j}`).value = row[j].toFixed(6);
    }
    alert('Filas normalizadas.');
  });

  // reset everything
  btnReset.addEventListener('click', () => {
    matrixContainer.innerHTML = '';
    vectorContainer.innerHTML = '';
    panelResults.style.display = 'none';
    stepsTableContainer.innerHTML = '';
    interpretation.innerHTML = '';
    application.innerHTML = '';
    btnCalculate.disabled = true;
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  });

  // main calculate function
  btnCalculate.addEventListener('click', () => {
    const n = Math.min(8, Math.max(2, parseInt(el('numEstados').value || 3)));
    const pasos = Math.min(10, Math.max(1, parseInt(el('numPasos').value || 3)));

    const P = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = parseFloat(el(`p_${i}_${j}`).value);
        if (!isFinite(v) || v < 0) return alert(`Valor inválido en P[${i + 1},${j + 1}].`);
        P[i][j] = v;
      }
    }

    for (let i = 0; i < n; i++) {
      const s = P[i].reduce((a, b) => a + b, 0);
      if (Math.abs(s - 1) > 1e-6) {
        const ok = confirm(`Fila ${i + 1} suma ${s.toFixed(6)} (≠ 1). ¿Desea normalizarla automáticamente?`);
        if (ok) {
          if (s === 0) P[i] = P[i].map(() => 1 / n);
          else P[i] = P[i].map(v => v / s);
          for (let j = 0; j < n; j++) el(`p_${i}_${j}`).value = P[i][j].toFixed(6);
        } else return alert('Corrija las filas y vuelva a calcular.');
      }
    }

    const S0 = [];
    for (let i = 0; i < n; i++) {
      const v = parseFloat(el(`s0_${i}`).value);
      if (!isFinite(v) || v < 0) return alert(`Valor inválido en S₀[${i + 1}].`);
      S0.push(v);
    }
    const sumS0 = S0.reduce((a, b) => a + b, 0);
    if (sumS0 === 0) return alert('El vector inicial no puede ser todo ceros.');
    const S0norm = S0.map(x => x / sumS0);

    const states = [];
    states.push(S0norm);
    let curr = S0norm.slice();
    for (let step = 1; step <= pasos; step++) {
      const next = Array(n).fill(0);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          next[j] += curr[i] * P[i][j];
      states.push(next);
      curr = next;
    }

    let pi = Array(n).fill(1 / n);
    for (let t = 0; t < 300; t++) pi = math.multiply(pi, P);
    pi = pi.map(x => Number(x));

    renderStepsTable(states);
    drawGroupedBars(states, pi);
    renderInterpretation(states, pi);
    renderApplication(states);

    panelResults.style.display = 'block';
    panelResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function renderStepsTable(states) {
    const n = states[0].length;
    let html = `<table class="steps-table"><thead><tr><th>Paso</th>`;
    for (let j = 0; j < n; j++) html += `<th>Estado ${j + 1}</th>`;
    html += `</tr></thead><tbody>`;
    states.forEach((vec, idx) => {
      html += `<tr><td>S${idx}</td>` + vec.map(v => `<td>${Number(v).toFixed(4)}</td>`).join('') + `</tr>`;
    });
    html += `</tbody></table>`;
    stepsTableContainer.innerHTML = html;
  }

  function drawGroupedBars(states) {
    const n = states[0].length;
    const labels = states.map((_, i) => `S${i}`);
    const datasets = [];
    for (let j = 0; j < n; j++) {
      const color = `hsl(${(j * 60) % 360} 70% 45%)`;
      datasets.push({
        label: `Estado ${j + 1}`,
        data: states.map(s => Number(s[j])),
        backgroundColor: color,
        borderRadius: 6
      });
    }
    const ctx = chartCanvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true, max: 1 } }
      }
    });
  }

  function renderInterpretation(states, pi) {
    const last = states[states.length - 1].map(v => Number(v));
    const maxProb = Math.max(...last);
    const dominant = last.indexOf(maxProb) + 1;
    const converged = last.every((v, i) => Math.abs(v - pi[i]) < 0.02);
    let html = `<p>Tras ${states.length - 1} pasos, la distribución es: [${last.map(v=>v.toFixed(4)).join(', ')}].</p>`;
    html += `<p>Estado más probable: <strong>Estado ${dominant}</strong> (p=${maxProb.toFixed(3)}).</p>`;
    html += converged
      ? `<p>Observación: la distribución se aproxima al vector estacionario (convergencia aparente).</p>`
      : `<p>Observación: aún no converge completamente al vector estacionario; pruebe aumentar el número de pasos.</p>`;
    html += `<p><small>Vector estacionario aproximado π: [${pi.map(v=>Number(v).toFixed(4)).join(', ')}]</small></p>`;
    interpretation.innerHTML = html;
  }

  // --- NUEVO: Aplicación de Ingeniería de Sistemas dinámica ---
  function renderApplication(states) {
    const last = states[states.length - 1].map(v => Number(v));
    const dominant = last.indexOf(Math.max(...last)) + 1;

    const casos = {
  1: `<p><strong>Dato interesante:</strong> este patrón refleja un sistema con alta fidelidad, donde los usuarios tienden a permanecer en el mismo estado o regresar con frecuencia.</p>
      <p><strong>Aplicación en Ing. de Sistemas:</strong> permite analizar la <strong>retención de usuarios en plataformas digitales</strong>, optimizando estrategias de recomendación y usabilidad en sitios web o apps.</p>`,

  2: `<p><strong>Dato interesante:</strong> la transición dominante sugiere un entorno donde los estados cambian con frecuencia, mostrando dinamismo en el comportamiento del sistema.</p>
      <p><strong>Aplicación en Ing. de Sistemas:</strong> útil para modelar <strong>flujos de navegación o comunicación entre módulos</strong>, como en sistemas distribuidos o aplicaciones educativas interactivas.</p>`,

  3: `<p><strong>Dato interesante:</strong> el sistema alcanza una distribución estable, indicando equilibrio y regularidad en las transiciones.</p>
      <p><strong>Aplicación en Ing. de Sistemas:</strong> aplicable en el <strong>análisis de rendimiento y balanceo de carga</strong> de servidores, asegurando una operación constante y eficiente.</p>`,

  4: `<p><strong>Dato interesante:</strong> la tendencia apunta hacia un estado de baja actividad o inactividad del sistema.</p>
      <p><strong>Aplicación en Ing. de Sistemas:</strong> útil para detectar <strong>pérdida de usuarios o periodos de baja demanda</strong>, ayudando a implementar estrategias de reactivación o mantenimiento preventivo.</p>`
};


    application.innerHTML = casos[dominant] || `<p>Modelo general sin predominancia clara: puede representar un sistema con comportamiento equilibrado o aleatorio.</p>`;
  }

  // auto demo
  window.addEventListener('load', () => {
    el('numEstados').value = 3;
    el('numPasos').value = 4;
    btnGenerate.click();
  });
})();
