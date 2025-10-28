// teoriaColas.js
// Requiere: math.js y Chart.js (CDN) en el HTML
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const qAll = s => Array.from(document.querySelectorAll(s));

  // --- Tabs ---
  qAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      qAll('.tab-button').forEach(b => b.classList.remove('active'));
      qAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.target;
      $(target).classList.add('active');
      // accessibility attributes
      qAll('.tab-button').forEach(b => b.setAttribute('aria-selected', b === btn ? 'true' : 'false'));
      qAll('.tab-content').forEach(tc => tc.setAttribute('aria-hidden', !tc.classList.contains('active')));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // chart references
  let charts = {
    mm1: null,
    mmk: null,
    mm1mm: null,
    mmkmm: null
  };

  // ---------- helpers ----------
  function factorial(n) { if (n < 2) return 1; let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }
  function downloadCanvasAsPNG(canvas, filename = 'chart.png') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
  function exportPnCSV(labels, data, filename = 'pn.csv') {
    let csv = 'n,P(n)\n';
    for (let i = 0; i < labels.length; i++) csv += `${labels[i]},${data[i]}\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- M/M/1 ----------
  $('mm1_calc').addEventListener('click', () => {
    const lambda = Number($('mm1_lambda').value);
    const mu = Number($('mm1_mu').value);
    if (!isFinite(lambda) || !isFinite(mu) || mu <= 0) return alert('Parámetros inválidos');
    if (lambda >= mu) return alert('Sistema inestable: λ >= μ. Reduce λ o aumenta μ.');

    const rho = lambda / mu;
    const L = rho / (1 - rho);
    const Lq = rho * rho / (1 - rho);
    const W = 1 / (mu - lambda);
    const Wq = rho / (mu - lambda);

    $('mm1_metrics').innerHTML = `
      <div class="metric"><strong>ρ</strong><div>${rho.toFixed(4)}</div></div>
      <div class="metric"><strong>L</strong><div>${L.toFixed(4)}</div></div>
      <div class="metric"><strong>Lq</strong><div>${Lq.toFixed(4)}</div></div>
      <div class="metric"><strong>W</strong><div>${W.toFixed(4)}</div></div>
      <div class="metric"><strong>Wq</strong><div>${Wq.toFixed(4)}</div></div>
    `;

    $('mm1_explain').innerHTML = `<p>M/M/1 modela un sistema con llegadas Poisson (λ) y servicio exponencial (μ) con un único servidor. Es el caso básico para entender colas.</p>`;
    $('mm1_app').innerHTML = `<p><strong>Dato interesante:</strong> cuando ρ se acerca a 1, L y W crecen muy rápido — el sistema se vuelve congestionado.</p>
      <p><strong>Aplicación:</strong> modelar un servidor único, ventanilla o servicio monohilo; sirve para dimensionar si es necesario agregar servidores.</p>`;

    // P(n) para n=0..N
    const N = 12;
    const labels = Array.from({ length: N + 1 }, (_, i) => i);
    const data = labels.map(n => (1 - rho) * Math.pow(rho, n));

    const ctx = $('mm1_chart').getContext('2d');
    if (charts.mm1) charts.mm1.destroy();
    charts.mm1 = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'P(n)', data, backgroundColor: 'rgba(0,119,182,0.85)', borderRadius: 6 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  });

  qAll('button[data-reset="mm1"]').forEach(b => b.addEventListener('click', () => {
    $('mm1_lambda').value = '0.6'; $('mm1_mu').value = '1.0'; $('mm1_metrics').innerHTML = '';
    if (charts.mm1) { charts.mm1.destroy(); charts.mm1 = null; }
  }));

  $('mm1_download').addEventListener('click', () => {
    const c = $('mm1_chart');
    if (!c) return;
    downloadCanvasAsPNG(c, 'MM1_chart.png');
  });

  // ---------- M/M/k (Erlang C) ----------
  $('mmk_calc').addEventListener('click', () => {
    const lambda = Number($('mmk_lambda').value);
    const mu = Number($('mmk_mu').value);
    const k = Math.max(1, Math.floor(Number($('mmk_k').value) || 1));
    if (!isFinite(lambda) || !isFinite(mu) || mu <= 0) return alert('Parámetros inválidos');

    const rho = lambda / mu;         // total traffic intensity
    const rhoPerServer = rho / k;    // ρ/k

    if (rhoPerServer >= 1) {
      // system overloaded (traffic per server >=1)
      $('mmk_metrics').innerHTML = `<div class="metric"><strong>ρ/k</strong><div>${rhoPerServer.toFixed(4)}</div></div>
        <div class="metric"><strong>Estado</strong><div>Inestable (ρ/k ≥ 1)</div></div>`;
      return alert('Sistema potencialmente inestable (ρ/k >= 1). Incrementa k o reduce λ.');
    }

    // compute p0 robustly
    let sum = 0;
    for (let n = 0; n < k; n++) sum += Math.pow(rho, n) / factorial(n);
    const last = Math.pow(rho, k) / (factorial(k) * (1 - rhoPerServer));
    const p0 = 1 / (sum + last);

    const Lq = (p0 * Math.pow(rho, k) * rhoPerServer) / (factorial(k) * Math.pow(1 - rhoPerServer, 2));
    const L = Lq + rho;
    const Wq = Lq / lambda;
    const W = Wq + 1 / mu;

    $('mmk_metrics').innerHTML = `
      <div class="metric"><strong>ρ/k</strong><div>${rhoPerServer.toFixed(4)}</div></div>
      <div class="metric"><strong>L</strong><div>${L.toFixed(4)}</div></div>
      <div class="metric"><strong>Lq</strong><div>${Lq.toFixed(4)}</div></div>
      <div class="metric"><strong>W</strong><div>${W.toFixed(4)}</div></div>
    `;

    $('mmk_explain').innerHTML = `<p>M/M/k amplía M/M/1 a k servidores. Usamos fórmulas de Erlang C para estimar la probabilidad de espera y Lq.</p>`;
    $('mmk_app').innerHTML = `<p><strong>Dato interesante:</strong> para ρ/k cercano a 1 la espera aumenta exponencialmente.</p><p><strong>Aplicación:</strong> dimensionamiento de centros de atención, colas en balanceadores y clusters de servidores.</p>`;

    // P(n) up to k+8
    const N = k + 8;
    const labels = Array.from({ length: N + 1 }, (_, i) => i);
    const p = [];
    for (let n = 0; n <= N; n++) {
      let pn;
      if (n <= k) pn = (Math.pow(rho, n) / factorial(n)) * p0;
      else pn = (Math.pow(rho, n) / (factorial(k) * Math.pow(k, n - k))) * p0;
      p.push(pn);
    }

    const ctx = $('mmk_chart').getContext('2d');
    if (charts.mmk) charts.mmk.destroy();
    charts.mmk = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'P(n)', data: p, backgroundColor: 'rgba(0,119,182,0.85)', borderRadius: 6 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  });

  qAll('button[data-reset="mmk"]').forEach(b => b.addEventListener('click', () => {
    $('mmk_lambda').value = '2.0'; $('mmk_mu').value = '1.0'; $('mmk_k').value = '3'; $('mmk_metrics').innerHTML = '';
    if (charts.mmk) { charts.mmk.destroy(); charts.mmk = null; }
  }));

  $('mmk_download').addEventListener('click', () => {
    const c = $('mmk_chart');
    if (!c) return;
    downloadCanvasAsPNG(c, 'MMk_chart.png');
  });

  // ---------- M/M/1/M/M (finite source, k=1) ----------
  $('mm1mm_calc').addEventListener('click', () => {
    const lambda = Number($('mm1mm_lambda').value);
    const mu = Number($('mm1mm_mu').value);
    const M = Math.max(1, Math.floor(Number($('mm1mm_M').value) || 1));
    try {
      const res = computeFiniteSourceMMk(M, 1, lambda, mu);
      renderFiniteUI(res, 'mm1mm');
      // chart
      const ctx = $('mm1mm_chart').getContext('2d');
      if (charts.mm1mm) charts.mm1mm.destroy();
      charts.mm1mm = new Chart(ctx, {
        type: 'bar',
        data: { labels: res.p.map((_, i) => i), datasets: [{ label: 'P(n)', data: res.p, backgroundColor: 'rgba(0,119,182,0.85)', borderRadius: 6 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    } catch (e) { alert(e.message); }
  });

  qAll('button[data-reset="mm1mm"]').forEach(b => b.addEventListener('click', () => {
    $('mm1mm_lambda').value = '0.2'; $('mm1mm_mu').value = '1.0'; $('mm1mm_M').value = '10'; $('mm1mm_metrics').innerHTML = '';
    if (charts.mm1mm) { charts.mm1mm.destroy(); charts.mm1mm = null; }
  }));

  $('mm1mm_csv').addEventListener('click', () => {
    const chart = charts.mm1mm;
    if (!chart) return alert('Genere la P(n) primero.');
    exportPnCSV(chart.data.labels, chart.data.datasets[0].data, 'MM1MM_Pn.csv');
  });

  $('mm1mm_download').addEventListener('click', () => {
    const c = $('mm1mm_chart');
    if (!c) return;
    downloadCanvasAsPNG(c, 'MM1MM_chart.png');
  });

  // ---------- M/M/k/M/M (finite source, k servers) ----------
  $('mmkmm_calc').addEventListener('click', () => {
    const lambda = Number($('mmkmm_lambda').value);
    const mu = Number($('mmkmm_mu').value);
    const k = Math.max(1, Math.floor(Number($('mmkmm_k').value) || 1));
    const M = Math.max(1, Math.floor(Number($('mmkmm_M').value) || 1));
    try {
      const res = computeFiniteSourceMMk(M, k, lambda, mu);
      renderFiniteUI(res, 'mmkmm');
      const ctx = $('mmkmm_chart').getContext('2d');
      if (charts.mmkmm) charts.mmkmm.destroy();
      charts.mmkmm = new Chart(ctx, {
        type: 'bar',
        data: { labels: res.p.map((_, i) => i), datasets: [{ label: 'P(n)', data: res.p, backgroundColor: 'rgba(0,119,182,0.85)', borderRadius: 6 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    } catch (e) { alert(e.message); }
  });

  qAll('button[data-reset="mmkmm"]').forEach(b => b.addEventListener('click', () => {
    $('mmkmm_lambda').value = '0.2'; $('mmkmm_mu').value = '0.5'; $('mmkmm_k').value = '3'; $('mmkmm_M').value = '10'; $('mmkmm_metrics').innerHTML = '';
    if (charts.mmkmm) { charts.mmkmm.destroy(); charts.mmkmm = null; }
  }));

  $('mmkmm_csv').addEventListener('click', () => {
    const chart = charts.mmkmm;
    if (!chart) return alert('Genere la P(n) primero.');
    exportPnCSV(chart.data.labels, chart.data.datasets[0].data, 'MMkMM_Pn.csv');
  });

  $('mmkmm_download').addEventListener('click', () => {
    const c = $('mmkmm_chart');
    if (!c) return;
    downloadCanvasAsPNG(c, 'MMkMM_chart.png');
  });

  // ---------- finite-source core function ----------
  function computeFiniteSourceMMk(M_total, k, lambda, mu) {
    if (!Number.isInteger(M_total) || M_total < 1) throw new Error('M_total debe ser entero >= 1');
    if (!Number.isInteger(k) || k < 1) throw new Error('k debe ser entero >= 1');
    if (!(isFinite(lambda) && lambda >= 0)) throw new Error('lambda inválida');
    if (!(isFinite(mu) && mu > 0)) throw new Error('mu inválida');

    const p = new Array(M_total + 1).fill(0);
    const ratios = new Array(M_total + 1).fill(1);

    // ratios[n] = Π_{i=0}^{n-1} (λ_i / μ_{i+1})
    for (let n = 1; n <= M_total; n++) {
      const lambda_i = (M_total - (n - 1)) * lambda; // λ_{n-1}
      const mu_ip1 = Math.min(n, k) * mu;           // μ_n
      ratios[n] = ratios[n - 1] * (lambda_i / mu_ip1);
    }

    const sumRatios = ratios.reduce((a, b) => a + b, 0);
    const p0 = 1 / sumRatios;
    p[0] = p0;
    for (let n = 1; n <= M_total; n++) p[n] = p0 * ratios[n];

    const L = p.reduce((sum, prob, n) => sum + n * prob, 0);
    const Lq = p.reduce((sum, prob, n) => sum + Math.max(0, n - k) * prob, 0);

    let lambda_eff = 0;
    for (let n = 0; n <= M_total - 1; n++) {
      lambda_eff += (M_total - n) * lambda * p[n];
    }

    const W = lambda_eff > 0 ? L / lambda_eff : Infinity;
    const Wq = lambda_eff > 0 ? Lq / lambda_eff : Infinity;
    const P_block = p[M_total];

    return {
      params: { M_total, k, lambda, mu },
      p,
      L: Number(L),
      Lq: Number(Lq),
      lambda_eff: Number(lambda_eff),
      W: Number(W),
      Wq: Number(Wq),
      P_block: Number(P_block)
    };
  }

  // ---------- render helper for finite-source models ----------
  function renderFiniteUI(res, prefix) {
    const metricsDiv = $(prefix + '_metrics');
    metricsDiv.innerHTML = '';
    const items = [
      ['L (en sistema)', res.L],
      ['Lq (en cola)', res.Lq],
      ['λ_eff (efectiva)', res.lambda_eff],
      ['W (tiempo en sistema)', res.W],
      ['Wq (tiempo en cola)', res.Wq],
      ['P_block', res.P_block]
    ];
    items.forEach(it => {
      const d = document.createElement('div');
      d.className = 'metric';
      d.innerHTML = `<strong>${it[0]}</strong><div>${Number(it[1]).toFixed(6)}</div>`;
      metricsDiv.appendChild(d);
    });

    $(prefix + '_explain').innerHTML = `<p>Se calcula la distribución estacionaria P(n) para n=0..M (población finita). Se muestran métricas y probabilidad de bloqueo.</p>`;

    // dato + aplicación (4 variantes adaptadas)
    let dato = '', aplic = '';
    // choose based on P_block and Lq
    if (res.P_block >= 0.2) {
      dato = `<p><strong>Dato interesante:</strong> alta probabilidad de bloqueo (P_block=${res.P_block.toFixed(4)}). Muchas fuentes quedan fuera.</p>`;
      aplic = `<p><strong>Aplicación (Ing. Sistemas):</strong> gestión de licencias concurrentes, control de acceso en redes cerradas o IoT en zonas limitadas; aumentar k o reducir λ por fuente.</p>`;
    } else if (res.Lq > 0.5) {
      dato = `<p><strong>Dato interesante:</strong> cola promedio significativa (Lq=${res.Lq.toFixed(4)}).</p>`;
      aplic = `<p><strong>Aplicación (Ing. Sistemas):</strong> dimensionamiento de servidores, políticas de priorización y colas intermedias (caching, buffering).</p>`;
    } else {
      dato = `<p><strong>Dato interesante:</strong> el sistema opera con baja congestión (P_block baja y Lq reducida).</p>`;
      aplic = `<p><strong>Aplicación (Ing. Sistemas):</strong> diseño para baja latencia; priorizar SLA y monitoreo en tiempo real.</p>`;
    }

    $(prefix + '_app').innerHTML = dato + aplic;
  }
});
