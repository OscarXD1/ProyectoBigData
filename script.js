const URL = './model/';

let recognizer;
let isListening = false;
let historyLog = [];
let lastLog = { label: '', time: 0 };

const dangerLabels = ["VIDRIO ROTO", "PERROS LADRANDO", "PUERTA AZOTANDO"];

// Inicializar iconos
lucide.createIcons();

// Elementos del DOM
const statusPill = document.getElementById('statusPill');
const pillText = document.getElementById('pillText');
const alertCard = document.getElementById('alertCard');
const cardHeader = document.getElementById('cardHeader');
const cardTitle = document.getElementById('cardTitle');
const cardIcon = document.getElementById('cardIcon');
const infoLabel = document.getElementById('infoLabel');
const infoValue = document.getElementById('infoValue');
const confidenceText1 = document.getElementById('confidenceText1');
const confidenceText2 = document.getElementById('confidenceText2');
const progressCircle = document.getElementById('progressCircle');
const progressBar = document.getElementById('progressBar');
const toggleBtn = document.getElementById('toggleBtn');
const toggleIcon = document.getElementById('toggleIcon');
const toggleText = document.getElementById('toggleText');
const historyBtn = document.getElementById('historyBtn');
const historyModal = document.getElementById('historyModal');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const historyBody = document.getElementById('historyBody');

async function initModel() {
  try {
    recognizer = speechCommands.create(
      'BROWSER_FFT',
      undefined,
      URL + 'model.json',
      URL + 'metadata.json'
    );
    await recognizer.ensureModelLoaded();
    
    // Habilitar el botón
    toggleBtn.disabled = false;
    toggleText.innerText = 'Iniciar monitoreo';
  } catch (err) {
    console.error("Error loading model:", err);
    toggleText.innerText = 'Error al cargar';
  }
}

function updateConfidenceUI(percent) {
  confidenceText1.innerText = percent;
  confidenceText2.innerText = percent;
  progressBar.style.width = percent + '%';
  
  const circumference = 2 * Math.PI * 32;
  const offset = circumference - (percent / 100) * circumference;
  progressCircle.style.strokeDasharray = `${circumference}`;
  progressCircle.style.strokeDashoffset = offset;
}

function setStatus(status, label, conf) {
  // Limpiar clases
  alertCard.classList.remove('safe', 'danger');
  cardHeader.classList.remove('safe', 'danger');
  
  if (status === 'danger') {
    alertCard.classList.add('danger');
    cardHeader.classList.add('danger');
    
    cardTitle.innerText = "SONIDO SOSPECHOSO DETECTADO";
    infoLabel.innerText = "Posible:";
    
    // Actualizar icono (Lucide replace tag)
    const newIcon = document.createElement('i');
    newIcon.setAttribute('data-lucide', 'triangle-alert');
    newIcon.style.width = '20px';
    newIcon.style.height = '20px';
    cardHeader.replaceChild(newIcon, cardHeader.firstElementChild);
    lucide.createIcons({ root: cardHeader });
    
  } else {
    alertCard.classList.add('safe');
    cardHeader.classList.add('safe');
    
    cardTitle.innerText = "ÁREA SEGURA";
    infoLabel.innerText = "Estado actual:";
    
    const newIcon = document.createElement('i');
    newIcon.setAttribute('data-lucide', 'shield-check');
    newIcon.style.width = '20px';
    newIcon.style.height = '20px';
    cardHeader.replaceChild(newIcon, cardHeader.firstElementChild);
    lucide.createIcons({ root: cardHeader });
  }
  
  infoValue.innerText = label;
  updateConfidenceUI(conf);
}

function addToHistory(alertName, conf) {
  const now = Date.now();
  if (lastLog.label !== alertName || now - lastLog.time > 5000) {
    const timeStr = new Date().toLocaleTimeString();
    
    historyLog.unshift({
      id: now,
      time: timeStr,
      alert: alertName,
      confidence: conf
    });
    
    lastLog = { label: alertName, time: now };
    renderHistory();
  }
}

function renderHistory() {
  if (historyLog.length === 0) {
    historyBody.innerHTML = '<div class="empty-history">No hay alertas registradas aún.</div>';
    return;
  }
  
  let html = '';
  historyLog.forEach(item => {
    html += `
      <div class="history-item">
        <div class="history-info">
          <span class="history-alert">${item.alert}</span>
          <span class="history-time">${item.time}</span>
        </div>
        <div class="info-label">${item.confidence}% conf.</div>
      </div>
    `;
  });
  historyBody.innerHTML = html;
}

async function toggleListening() {
  if (!recognizer) return;

  if (isListening) {
    recognizer.stopListening();
    isListening = false;
    
    statusPill.classList.remove('active');
    pillText.innerText = 'Micrófono inactivo';
    
    toggleText.innerText = 'Iniciar monitoreo';
    
    const newIcon = document.createElement('i');
    newIcon.setAttribute('data-lucide', 'play');
    newIcon.style.width = '18px';
    newIcon.style.height = '18px';
    toggleBtn.replaceChild(newIcon, toggleBtn.firstElementChild);
    lucide.createIcons({ root: toggleBtn });

    setStatus('safe', 'Ninguno', 0);
  } else {
    isListening = true;
    
    statusPill.classList.add('active');
    pillText.innerText = 'Micrófono activo';
    
    toggleText.innerText = 'Detener';
    
    const newIcon = document.createElement('i');
    newIcon.setAttribute('data-lucide', 'square');
    newIcon.style.width = '18px';
    newIcon.style.height = '18px';
    toggleBtn.replaceChild(newIcon, toggleBtn.firstElementChild);
    lucide.createIcons({ root: toggleBtn });

    const classLabels = recognizer.wordLabels();

    recognizer.listen(result => {
      const scores = result.scores;
      let maxScore = 0;
      let bestLabel = '';

      for (let i = 0; i < classLabels.length; i++) {
        if (scores[i] > maxScore) {
          maxScore = scores[i];
          bestLabel = classLabels[i];
        }
      }

      const percentage = Math.round(maxScore * 100);
      
      if (percentage > 50) {
        if (dangerLabels.includes(bestLabel)) {
          let alertName = bestLabel;
          if (bestLabel === "VIDRIO ROTO") alertName = "Ventana rota";
          else if (bestLabel === "PERROS LADRANDO") alertName = "Perro ladrando";
          else if (bestLabel === "PUERTA AZOTANDO") alertName = "Puerta forzada";
          
          setStatus('danger', alertName, percentage);
          addToHistory(alertName, percentage);
        } else {
          setStatus('safe', "Ambiente tranquilo", percentage);
        }
      }
    }, {
      includeSpectrogram: true,
      probabilityThreshold: 0.75,
      invokeCallbackOnNoiseAndUnknown: true,
      overlapFactor: 0.5
    });
  }
}

// Event Listeners
toggleBtn.addEventListener('click', toggleListening);
historyBtn.addEventListener('click', () => historyModal.classList.add('show'));
closeHistoryBtn.addEventListener('click', () => historyModal.classList.remove('show'));

// Inicializar stroke offset
updateConfidenceUI(0);

// Iniciar carga
initModel();
