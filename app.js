// Configuración
const UPDATE_INTERVAL = 60000; // 60 segundos
const TARGET_PALETAS = 1350;
const SACOS_PER_PALETA = 30;
const TARGET_SACOS_MIN = 8.0;
const MAX_CHART_POINTS = 120; // 2 horas a 1 punto por minuto

// Estado
let state = {
    sacosMin: 7.2,
    paletasHora: 456,
    paletasHoy: 1248,
    sacosAcumulados: 0, // para contar cuando llega a 30
    oee: 78,
    isAlertActive: false,
    historyLabels: [],
    historyData: [],
    alertCount: 0
};

// Elementos DOM
const elements = {
    clock: document.getElementById('clock'),
    sacosMin: document.getElementById('sacosMin'),
    paletasHora: document.getElementById('paletasHora'),
    paletasHoy: document.getElementById('paletasHoy'),
    oeeValue: document.getElementById('oeeValue'),
    paletasHoyProgress: document.getElementById('paletasHoyProgress'),
    paletasHoyPercent: document.getElementById('paletasHoyPercent'),
    objetivoProducido: document.getElementById('objetivoProducido'),
    objetivoFaltan: document.getElementById('objetivoFaltan'),
    sacosMinCard: document.getElementById('sacosMinCard'),
    notificationBadge: document.getElementById('notificationBadge'),
    alertOverlay: document.getElementById('alertOverlay'),
    closeAlertBtn: document.getElementById('closeAlertBtn'),
    paradasTbody: document.getElementById('paradasTbody')
};

// Gráficos
let productionChart;
let statusChart;

// Inicialización
function init() {
    updateClock();
    setInterval(updateClock, 1000);

    initCharts();
    generateInitialData();
    updateDOM();

    // Iniciar simulación
    setInterval(simulateData, UPDATE_INTERVAL);

    // Event Listeners
    elements.closeAlertBtn.addEventListener('click', closeAlert);
}

// Reloj en tiempo real
function updateClock() {
    const now = new Date();
    elements.clock.textContent = now.toLocaleTimeString('es-ES');
}

// Generar datos iniciales para el gráfico (últimas 2 horas)
function generateInitialData() {
    const now = new Date();
    for (let i = MAX_CHART_POINTS; i > 0; i--) {
        const time = new Date(now.getTime() - i * 60000);
        state.historyLabels.push(`${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`);
        
        // Simular valores entre 5 y 8, con algunas caídas
        let val = 6 + Math.random() * 2;
        if (i > 30 && i < 40) val = val - 3; // Simular una caída anterior
        state.historyData.push(val.toFixed(1));
    }
    productionChart.update();
}

// Motor de simulación
function simulateData() {
    // 1. Generar nuevos sacos por minuto (0 a 9)
    // Favorecer valores cercanos a 7-8 para normalidad, ocasionalmente caer
    let newSacosMin = 0;
    const rand = Math.random();
    
    if (rand > 0.15) {
        // Operación normal
        newSacosMin = 6.5 + Math.random() * 2.5; 
    } else if (rand > 0.05) {
        // Baja producción
        newSacosMin = 2 + Math.random() * 4;
    } else {
        // Falla / Parada
        newSacosMin = 0;
    }
    
    newSacosMin = Math.round(newSacosMin * 10) / 10;
    if(newSacosMin > 9) newSacosMin = 9.0;
    
    state.sacosMin = newSacosMin;

    // 2. Acumular sacos para Paletas Hoy
    state.sacosAcumulados += state.sacosMin;
    if (state.sacosAcumulados >= SACOS_PER_PALETA) {
        const nuevasPaletas = Math.floor(state.sacosAcumulados / SACOS_PER_PALETA);
        state.paletasHoy += nuevasPaletas;
        state.sacosAcumulados = state.sacosAcumulados % SACOS_PER_PALETA;
    }

    // 3. Calcular Paletas por Hora
    state.paletasHora = Math.round((state.sacosMin * 60) / SACOS_PER_PALETA);

    // 4. Calcular OEE (suavemente)
    const oeeTarget = (state.sacosMin / TARGET_SACOS_MIN) * 100;
    const smoothedOee = state.oee + (oeeTarget - state.oee) * 0.1;
    state.oee = Math.min(95, Math.max(60, smoothedOee)); // Rango 60-95

    // 5. Lógica de Alertas
    if (state.sacosMin === 0) {
        if (!state.isAlertActive) {
            triggerAlert();
        }
    } else {
        if (state.isAlertActive) {
            resolveAlert();
        }
    }

    // 6. Actualizar Gráfico
    const now = new Date();
    state.historyLabels.push(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    state.historyData.push(state.sacosMin);

    if (state.historyLabels.length > MAX_CHART_POINTS) {
        state.historyLabels.shift();
        state.historyData.shift();
    }
    
    // Cambiar color del gráfico si es 0
    productionChart.data.datasets[0].borderColor = state.sacosMin === 0 ? '#ef4444' : '#10b981';
    productionChart.update();

    // 7. Actualizar DOM
    updateDOM();
}

function updateDOM() {
    // Métricas principales
    elements.sacosMin.textContent = state.sacosMin.toFixed(1);
    elements.paletasHora.textContent = state.paletasHora;
    elements.paletasHoy.textContent = state.paletasHoy.toLocaleString();
    elements.oeeValue.textContent = Math.round(state.oee) + '%';

    // Colores condicionales sacos/min
    if (state.sacosMin === 0) {
        elements.sacosMin.className = 'text-red';
    } else if (state.sacosMin < 5) {
        elements.sacosMin.className = 'text-warning'; // Asumiendo que definiremos esto si es necesario
        elements.sacosMin.style.color = 'var(--color-orange)';
    } else {
        elements.sacosMin.className = '';
        elements.sacosMin.style.color = '';
    }

    // Progreso Objetivo
    const percent = Math.min(100, Math.round((state.paletasHoy / TARGET_PALETAS) * 100));
    const faltan = Math.max(0, TARGET_PALETAS - state.paletasHoy);
    
    elements.paletasHoyProgress.style.width = percent + '%';
    elements.paletasHoyPercent.textContent = percent + '%';
    
    elements.objetivoProducido.textContent = `${state.paletasHoy.toLocaleString()} (${percent}%)`;
    elements.objetivoFaltan.textContent = `${faltan.toLocaleString()} (${100-percent}%)`;
}

function triggerAlert() {
    state.isAlertActive = true;
    state.alertCount++;
    elements.sacosMinCard.classList.add('alert');
    elements.notificationBadge.classList.remove('hidden');
    elements.alertOverlay.classList.remove('hidden');
    
    // Add to history
    addStopToHistory();
}

function resolveAlert() {
    state.isAlertActive = false;
    elements.sacosMinCard.classList.remove('alert');
}

function closeAlert() {
    elements.alertOverlay.classList.add('hidden');
}

function addStopToHistory() {
    const now = new Date();
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><span class="dot" style="background: var(--color-red);"></span></td>
        <td>${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}</td>
        <td>--:--</td>
        <td>En curso</td>
        <td>Desconocida</td>
        <td>Caída de flujo</td>
    `;
    elements.paradasTbody.prepend(tr);
    // Keep only last 5
    if(elements.paradasTbody.children.length > 5) {
        elements.paradasTbody.removeChild(elements.paradasTbody.lastChild);
    }
}

// Configuración de Chart.js
function initCharts() {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // Gráfico de Producción (Línea)
    const ctxProd = document.getElementById('productionChart').getContext('2d');
    productionChart = new Chart(ctxProd, {
        type: 'line',
        data: {
            labels: state.historyLabels,
            datasets: [
                {
                    label: 'Producción Real',
                    data: state.historyData,
                    borderColor: '#10b981',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: 'Objetivo',
                    data: Array(MAX_CHART_POINTS).fill(TARGET_SACOS_MIN),
                    borderColor: '#64748b',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    borderColor: '#334155',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 10,
                    grid: { color: '#1e293b' },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { maxTicksLimit: 6 }
                }
            },
            animation: { duration: 0 } // Desactivar animación para actualizaciones suaves en tiempo real
        }
    });

    // Gráfico de Estado (Doughnut)
    const ctxStatus = document.getElementById('statusChart').getContext('2d');
    statusChart = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['Operación', 'Parada', 'Falla', 'Cambio/Setup'],
            datasets: [{
                data: [82, 10, 6, 2],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'],
                borderWidth: 0,
                cutout: '80%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
}

// Iniciar app cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);
