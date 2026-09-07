/**
 * ======================================================
 * SDRconnect Web Interface - Script Principal
 * Comunicação via WebSocket + Renderização de Áudio/Espectro
 * ======================================================
 */

// ---- CONSTANTES ----
const WS_URL = 'ws://localhost:5454';
const WATERFALL_LINES = 100;

// ---- ELEMENTOS DOM ----
// Interface / Sidebar
const sidebar = document.getElementById('sidebar');
const btnToggle = document.getElementById('btn-toggle-sidebar');

// Status e Conexão
const statusLabel = document.getElementById('status-label');
const statusIndicator = document.getElementById('status-indicator');
const btnConnect = document.getElementById('btn-connect');
const btnDisconnect = document.getElementById('btn-disconnect');
const globalTooltip = document.getElementById('global-tooltip');

// Controles de Rádio
const selDevice = document.getElementById('sel-device');
const selChannel = document.getElementById('sel-channel');
const freqInput = document.getElementById('freq-input');
const btnSetFreq = document.getElementById('btn-set-freq');
const selDemod = document.getElementById('sel-demod');
const filterBw = document.getElementById('filter-bw');
const lnaGain = document.getElementById('lna-gain');
const chkAudioStream = document.getElementById('chk-audio-stream');
const chkIqStream = document.getElementById('chk-iq-stream');
const chkSpectrumStream = document.getElementById('chk-spectrum-stream');
const audioVolume = document.getElementById('audio-volume');
const chkMute = document.getElementById('chk-mute');
const chkSquelch = document.getElementById('chk-squelch');

// Gravação e Perfis
const btnRecordIq = document.getElementById('btn-record-iq');
const btnRecordAudio = document.getElementById('btn-record-audio');
const btnStopRecord = document.getElementById('btn-stop-record');
const profileName = document.getElementById('profile-name');
const btnApplyProfile = document.getElementById('btn-apply-profile');

// Abas
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Espectro e Waterfall
const spectrumCanvas = document.getElementById('spectrum-canvas');
const waterfallCanvas = document.getElementById('waterfall-canvas');
const spectrumInfo = document.getElementById('spectrum-info');
const freqMin = document.getElementById('freq-min');
const freqMax = document.getElementById('freq-max');
const freqCenter = document.getElementById('freq-center');

// Áudio Player
const btnPlayAudio = document.getElementById('btn-play-audio');
const btnStopAudio = document.getElementById('btn-stop-audio');
const audioPlayerVolume = document.getElementById('audio-player-volume');
const volumeLabel = document.getElementById('volume-label');
const audioStatus = document.getElementById('audio-status');

// Métricas
const metricFrequency = document.getElementById('metric-frequency');
const metricSampleRate = document.getElementById('metric-sample-rate');
const metricFilterBw = document.getElementById('metric-filter-bw');
const metricDemod = document.getElementById('metric-demod');
const metricLna = document.getElementById('metric-lna');
const metricOverload = document.getElementById('metric-overload');
const metricStreaming = document.getElementById('metric-streaming');
const metricDevice = document.getElementById('metric-device');
const audioSignalPower = document.getElementById('audio-signal-power');
const audioSignalSnr = document.getElementById('audio-signal-snr');
const audioRdsPs = document.getElementById('audio-rds-ps');
const audioRdsText = document.getElementById('audio-rds-text');

// Aba Avançado
const propKey = document.getElementById('prop-key');
const propValue = document.getElementById('prop-value');
const btnSetProp = document.getElementById('btn-set-prop');
const btnGetProp = document.getElementById('btn-get-prop');
const cmdJson = document.getElementById('cmd-json');
const btnSendJson = document.getElementById('btn-send-json');

// Botões Avançados
const btnDeviceStreamOn = document.getElementById('btn-device-stream-on');
const btnDeviceStreamOff = document.getElementById('btn-device-stream-off');
const btnEnableAudioLimiter = document.getElementById('btn-enable-audio-limiter');
const btnEnableAgc = document.getElementById('btn-enable-agc');
const btnEnableNr = document.getElementById('btn-enable-nr');
const btnEnableRds = document.getElementById('btn-enable-rds');

// Log
const logContainer = document.getElementById('log-container');

// ---- VARIÁVEIS DE ESTADO ----
let ws = null;
let isConnected = false;
let audioContext = null;
let audioBuffer = null;
let audioSource = null;
let isPlaying = false;
let spectrumData = [];
let waterfallData = [];
let waterfallLineIndex = 0;
let spectrumBinCount = 0;
let currentDevice = 'primary';
let deviceList = [];
let streamStatus = {
    audio: false,
    iq: false,
    spectrum: false,
    device: false  // Novo: status do stream do dispositivo
};
let canvasWidth = 800;
let canvasHeight = 200;
let i18nReady = false;

// ---- INICIALIZAÇÃO ----
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    try {
        await initializeI18n();
        i18nReady = true;
        
        setupSidebarToggle();
        setupTabs();
        setupEventListeners();
        initSpectrumCanvas();

        addLog('info', getTranslation('log.interface_loaded'));
        addLog('info', getTranslation('log.click_connect'));
        addLog('info', getTranslation('log.ensure_running'));
        addLog('info', getTranslation('log.url_configured', { url: WS_URL }));
    } catch (error) {
        console.error('Erro ao inicializar aplicação:', error);
        addLog('info', 'Interface loaded. Waiting for connection.');
        addLog('info', 'Click "Connect" to start communication with SDRconnect.');
        addLog('info', 'Make sure SDRconnect is running and the WebSocket API is active.');
        addLog('info', 'URL configured: ' + WS_URL);
    }
}

// ---- FUNÇÃO AUXILIAR DE TRADUÇÃO ----
function getTranslation(key, params = {}) {
    try {
        if (i18nReady && i18n && i18n.isLoaded) {
            return i18n.t(key, params);
        }
        return key;
    } catch (e) {
        return key;
    }
}

// ---- INICIALIZAÇÃO I18N ----
async function initializeI18n() {
    try {
        await i18n.loadLanguage();
        updateAllI18nElements();

        const langSelector = document.getElementById('lang-selector');
        if (langSelector) {
            langSelector.value = i18n.getLanguage();
            langSelector.addEventListener('change', async (e) => {
                await i18n.setLanguage(e.target.value);
                updateAllI18nElements();
                updateDynamicTexts();
                updateSpectrumInfo();
            });
        }

        i18n.observe(() => {
            updateAllI18nElements();
            updateDynamicTexts();
            updateSpectrumInfo();
        });
    } catch (error) {
        console.error('Erro ao inicializar i18n:', error);
    }
}

function updateAllI18nElements() {
    if (!i18nReady) return;
    updateI18nElements(i18n);
}

function updateDynamicTexts() {
    if (!i18nReady) return;
    
    if (isConnected) {
        statusLabel.textContent = getTranslation('header.connected');
    } else {
        statusLabel.textContent = getTranslation('header.disconnected');
    }

    document.querySelectorAll('.metric-label').forEach(el => {
        const key = el.dataset.i18nLabel;
        if (key) {
            el.textContent = getTranslation(key);
        }
    });

    const profileInput = document.getElementById('profile-name');
    if (profileInput) {
        const placeholderKey = profileInput.dataset.i18nPlaceholder;
        if (placeholderKey) {
            profileInput.placeholder = getTranslation(placeholderKey);
        }
    }

    document.querySelectorAll('.info-tip[data-i18n-tooltip]').forEach(tip => {
        const key = tip.dataset.i18nTooltip;
        const textEl = tip.querySelector('.tooltip-text');
        if (textEl && key) {
            textEl.textContent = getTranslation(key);
        }
    });
}

function updateSpectrumInfo() {
    if (!i18nReady) return;
    if (spectrumData.length === 0) {
        spectrumInfo.textContent = getTranslation('spectrum.fft_waiting');
    } else {
        spectrumInfo.textContent = getTranslation('spectrum.fft_bins', { bins: spectrumBinCount });
    }
}

// ---- CONFIGURAÇÕES DE UI ----
function setupSidebarToggle() {
    btnToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        btnToggle.textContent = '☰';
    });
}

function setupTabs() {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });
}

// ---- CONFIGURAR EVENT LISTENERS ----
function setupEventListeners() {
    // Conexão
    btnConnect.addEventListener('click', connectWebSocket);
    btnDisconnect.addEventListener('click', disconnectWebSocket);

    // Controles principais
    btnSetFreq.addEventListener('click', () => setProperty('device_vfo_frequency', freqInput.value));
    selDemod.addEventListener('change', () => setProperty('demodulator', selDemod.value));
    filterBw.addEventListener('change', () => setProperty('filter_bandwidth', filterBw.value));
    lnaGain.addEventListener('change', () => setProperty('lna_state', lnaGain.value));

    selChannel.addEventListener('change', () => {
        currentDevice = selChannel.value;
        addLog('info', getTranslation('log.channel_changed', { channel: currentDevice }));
        getProperty('device_vfo_frequency');
        getProperty('demodulator');
        getProperty('filter_bandwidth');
        getProperty('lna_state');
        // Atualiza status do stream para o novo canal
        getProperty('started');
    });

    // Áudio e Stream
    chkAudioStream.addEventListener('change', () => {
        const val = chkAudioStream.checked;
        sendCommand('audio_stream_enable', val ? 'true' : 'false');
        streamStatus.audio = val;
        const status = val ? getTranslation('log.audio_stream_enabled_true') : getTranslation('log.audio_stream_enabled_false');
        addLog('info', getTranslation('log.audio_stream_enabled', { status }));
        updateStreamingMetric();
    });

    audioVolume.addEventListener('input', () => {
        setProperty('audio_volume_percent', audioVolume.value);
    });

    chkMute.addEventListener('change', () => {
        setProperty('audio_mute', chkMute.checked ? 'true' : 'false');
    });

    chkSquelch.addEventListener('change', () => {
        setProperty('squelch_enable', chkSquelch.checked ? 'true' : 'false');
    });

    // Streaming IQ e Espectro
    chkIqStream.addEventListener('change', () => {
        const val = chkIqStream.checked;
        sendCommand('iq_stream_enable', val ? 'true' : 'false');
        streamStatus.iq = val;
        const status = val ? getTranslation('log.audio_stream_enabled_true') : getTranslation('log.audio_stream_enabled_false');
        addLog('info', getTranslation('log.iq_stream_enabled', { status }));
        updateStreamingMetric();
    });

    chkSpectrumStream.addEventListener('change', () => {
        const val = chkSpectrumStream.checked;
        sendCommand('spectrum_enable', val ? 'true' : 'false');
        streamStatus.spectrum = val;
        const status = val ? getTranslation('log.audio_stream_enabled_true') : getTranslation('log.audio_stream_enabled_false');
        addLog('info', getTranslation('log.spectrum_stream_enabled', { status }));
        updateStreamingMetric();
    });

    // Gravação
    btnRecordIq.addEventListener('click', () => sendCommand('start_recording', 'iq'));
    btnRecordAudio.addEventListener('click', () => sendCommand('start_recording', 'audio'));
    btnStopRecord.addEventListener('click', () => sendCommand('stop_recording', ''));

    // Perfil
    btnApplyProfile.addEventListener('click', () => {
        if (profileName.value) {
            sendCommand('apply_device_profile', profileName.value);
        }
    });

    // Dispositivo
    selDevice.addEventListener('change', () => {
        if (selDevice.value) {
            sendCommand('selected_device', selDevice.value);
        }
    });
    document.getElementById('btn-refresh-devices').addEventListener('click', refreshDevices);

    // Player de Áudio
    btnPlayAudio.addEventListener('click', playAudio);
    btnStopAudio.addEventListener('click', stopAudio);
    audioPlayerVolume.addEventListener('input', () => {
        volumeLabel.textContent = audioPlayerVolume.value + '%';
        if (audioContext && audioSource && audioSource.gainNode) {
            audioSource.gainNode.gain.value = audioPlayerVolume.value / 100;
        }
    });

    // Avançado
    btnSetProp.addEventListener('click', () => setProperty(propKey.value, propValue.value));
    btnGetProp.addEventListener('click', () => getProperty(propKey.value));
    btnSendJson.addEventListener('click', sendRawJson);

    // Botões rápidos da aba avançada
    if (btnEnableAudioLimiter) {
        btnEnableAudioLimiter.addEventListener('click', () => {
            setProperty('audio_limiters', 'true');
            addLog('info', '🔇 Audio Limiter ativado');
        });
    }
    
    if (btnEnableAgc) {
        btnEnableAgc.addEventListener('click', () => {
            setProperty('agc_enable', 'true');
            addLog('info', '📈 AGC ativado');
        });
    }
    
    if (btnEnableNr) {
        btnEnableNr.addEventListener('click', () => {
            setProperty('noise_reduction_enable', 'true');
            addLog('info', '🔊 Noise Reduction ativado');
        });
    }
    
    if (btnEnableRds) {
        btnEnableRds.addEventListener('click', () => {
            setProperty('rds_enable', 'true');
            addLog('info', '📻 RDS ativado');
        });
    }

    // Botões de Stream do Dispositivo (Aba Avançada)
    if (btnDeviceStreamOn) {
        btnDeviceStreamOn.addEventListener('click', () => {
            sendCommand('device_stream_enable', 'true');
            streamStatus.device = true;
            addLog('info', '▶ Device Stream iniciado');
            updateStreamingMetric();
            // Atualiza o status após um pequeno delay
            setTimeout(() => getProperty('started'), 100);
        });
    }
    
    if (btnDeviceStreamOff) {
        btnDeviceStreamOff.addEventListener('click', () => {
            sendCommand('device_stream_enable', 'false');
            streamStatus.device = false;
            addLog('info', '⏹ Device Stream parado');
            updateStreamingMetric();
            // Atualiza o status após um pequeno delay
            setTimeout(() => getProperty('started'), 100);
        });
    }

    // Tooltip Global
    setupGlobalTooltips();
}

// ---- ATUALIZAR MÉTRICA DE STREAMING ----
function updateStreamingMetric() {
    // Verifica se algum stream está ativo
    const isStreaming = streamStatus.audio || streamStatus.iq || streamStatus.spectrum || streamStatus.device;
    
    if (isStreaming) {
        const activeStreams = [];
        if (streamStatus.device) activeStreams.push('Device');
        if (streamStatus.audio) activeStreams.push('Áudio');
        if (streamStatus.spectrum) activeStreams.push('Espectro');
        if (streamStatus.iq) activeStreams.push('IQ');
        
        metricStreaming.textContent = '▶ ' + activeStreams.join(' + ');
    } else {
        metricStreaming.textContent = getTranslation('metrics.streaming_stopped');
    }
}

// ---- TOOLTIP GLOBAL ----
function setupGlobalTooltips() {
    document.querySelectorAll('.info-tip').forEach(tip => {
        const textEl = tip.querySelector('.tooltip-text');
        if (!textEl) return;

        tip.addEventListener('mouseenter', () => {
            const rect = tip.getBoundingClientRect();
            const tooltipKey = tip.dataset.i18nTooltip;
            let tooltipText = textEl.textContent.trim();
            if (tooltipKey) {
                tooltipText = getTranslation(tooltipKey);
            }
            globalTooltip.textContent = tooltipText;

            let left = rect.right + 12;
            let top = rect.top + (rect.height / 2) - 20;

            if (left + 250 > window.innerWidth) {
                left = rect.left - 252;
                globalTooltip.style.setProperty('--arrow-side', 'right');
            }

            if (top < 8) top = 8;
            if (top + 80 > window.innerHeight) top = window.innerHeight - 90;

            globalTooltip.style.left = left + 'px';
            globalTooltip.style.top = top + 'px';
            globalTooltip.classList.add('visible');
        });

        tip.addEventListener('mouseleave', () => {
            globalTooltip.classList.remove('visible');
        });
    });
}

// ---- WEB SOCKET ----
function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        addLog('warn', getTranslation('log.already_connected'));
        return;
    }
    addLog('info', getTranslation('log.connecting'));
    updateStatus('connecting');

    ws = new WebSocket(WS_URL);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
        isConnected = true;
        updateStatus('connected');
        addLog('success', getTranslation('log.connected'));
        btnConnect.style.display = 'none';
        btnDisconnect.style.display = 'inline-flex';
        updateDynamicTexts();

        getProperty('valid_devices');

        if (chkAudioStream.checked) sendCommand('audio_stream_enable', 'true');
        if (chkSpectrumStream.checked) sendCommand('spectrum_enable', 'true');
        if (chkIqStream.checked) sendCommand('iq_stream_enable', 'true');

        getProperty('device_vfo_frequency');
        getProperty('demodulator');
        getProperty('filter_bandwidth');
        getProperty('lna_state');
        getProperty('audio_volume_percent');
        getProperty('signal_power');
        getProperty('signal_snr');
        getProperty('started'); // Busca o status inicial do stream
    };

    ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
            handleBinaryMessage(event.data);
        } else {
            handleTextMessage(event.data);
        }
    };

    ws.onclose = () => {
        isConnected = false;
        updateStatus('disconnected');
        addLog('warn', getTranslation('log.connection_closed'));
        btnConnect.style.display = 'inline-flex';
        btnDisconnect.style.display = 'none';
        ws = null;
        updateDynamicTexts();
    };

    ws.onerror = (error) => {
        addLog('error', getTranslation('log.websocket_error', { error: error.message || 'Desconhecido' }));
    };
}

function disconnectWebSocket() {
    if (ws) {
        ws.close();
        ws = null;
    }
    isConnected = false;
    updateStatus('disconnected');
    btnConnect.style.display = 'inline-flex';
    btnDisconnect.style.display = 'none';
    updateDynamicTexts();
}

// ---- ENVIO DE COMANDOS ----
function sendCommand(eventType, value, property = '') {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        addLog('error', getTranslation('log.not_connected'));
        return;
    }
    const msg = {
        event_type: eventType,
        property: property || '',
        value: String(value)
    };
    if (currentDevice && eventType !== 'selected_device') {
        msg.device = currentDevice;
    }
    ws.send(JSON.stringify(msg));
    addLog('json', `→ ${JSON.stringify(msg)}`);
}

function setProperty(prop, value) {
    sendCommand('set_property', value, prop);
}

function getProperty(prop) {
    sendCommand('get_property', '', prop);
}

function sendRawJson() {
    try {
        const data = JSON.parse(cmdJson.value);
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            addLog('error', getTranslation('log.not_connected'));
            return;
        }
        ws.send(JSON.stringify(data));
        addLog('json', `→ ${cmdJson.value}`);
    } catch (e) {
        addLog('error', getTranslation('log.invalid_json', { error: e.message }));
    }
}

function refreshDevices() {
    getProperty('valid_devices');
}

// ---- TRATAMENTO DE MENSAGENS ----
function handleTextMessage(data) {
    try {
        const msg = JSON.parse(data);
        addLog('json', `← ${data}`);

        if (msg.event_type === 'property_changed' || msg.event_type === 'get_property_response') {
            updateUIProperty(msg.property, msg.value, msg.device);
        }

        if (msg.property === 'valid_devices' && msg.value) {
            const devices = msg.value.split(',').map(s => s.trim()).filter(s => s);
            deviceList = devices;
            const currentVal = selDevice.value;
            selDevice.innerHTML = '';

            devices.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                selDevice.appendChild(opt);
            });

            if (currentVal && devices.includes(currentVal)) {
                selDevice.value = currentVal;
            } else if (devices.length > 0) {
                selDevice.value = devices[0];
                sendCommand('selected_device', devices[0]);
            }
            addLog('info', getTranslation('log.devices_available', { devices: devices.join(', ') }));
        }
    } catch (e) {
        addLog('error', getTranslation('log.json_parse_error', { error: e.message }));
    }
}

function handleBinaryMessage(buffer) {
    const view = new DataView(buffer, 0, 2);
    const payloadType = view.getUint16(0, true);
    const data = new Uint8Array(buffer.slice(2));

    switch (payloadType) {
        case 1:
        case 4:
            processAudioData(data);
            break;
        case 2:
        case 5:
            addLog('binary', getTranslation('log.iq_data_received', { bytes: data.length }));
            break;
        case 3:
        case 6:
            processSpectrumData(data);
            break;
        default:
            addLog('binary', getTranslation('log.unknown_payload', {
                type: payloadType,
                bytes: data.length
            }));
    }
}

// ---- PROCESSAMENTO DE ÁUDIO ----
function processAudioData(data) {
    const samples = new Int16Array(data.buffer);
    const floatData = new Float32Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
        floatData[i] = samples[i] / 32768.0;
    }

    if (isPlaying && audioContext) {
        const buffer = audioContext.createBuffer(2, floatData.length / 2, 48000);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        for (let i = 0; i < floatData.length / 2; i++) {
            left[i] = floatData[i * 2];
            right[i] = floatData[i * 2 + 1];
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;

        const gainNode = audioContext.createGain();
        gainNode.gain.value = audioPlayerVolume.value / 100;

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        source.start();

        source.gainNode = gainNode;

        if (audioSource) {
            try { audioSource.stop(); } catch (e) { /* ignore */ }
        }
        audioSource = source;
        audioStatus.textContent = getTranslation('audio.playing');
    }
}

function playAudio() {
    if (!audioContext) {
        audioContext = new(window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    isPlaying = true;
    audioStatus.textContent = getTranslation('audio.preparing');
    addLog('info', getTranslation('log.audio_started'));
}

function stopAudio() {
    isPlaying = false;
    if (audioSource) {
        try { audioSource.stop(); } catch (e) { /* ignore */ }
        audioSource = null;
    }
    audioStatus.textContent = getTranslation('audio.stopped');
    addLog('info', getTranslation('log.audio_stopped'));
}

// ---- PROCESSAMENTO DE ESPECTRO ----
function processSpectrumData(data) {
    const bins = new Uint8Array(data);
    spectrumData = Array.from(bins);
    spectrumBinCount = bins.length;

    spectrumInfo.textContent = getTranslation('spectrum.fft_bins', { bins: bins.length });
    drawSpectrum();
    updateWaterfall(bins);
}

function drawSpectrum() {
    const canvas = spectrumCanvas;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    
    let width = canvas.clientWidth || rect.width - 24 || 800;
    width = Math.max(100, width);
    let height = canvas.clientHeight || 200;
    height = Math.max(50, height);
    
    canvas.width = width;
    canvas.height = height;
    canvasWidth = width;
    canvasHeight = height;

    ctx.clearRect(0, 0, width, height);

    if (spectrumData.length === 0) {
        ctx.fillStyle = '#1a2a3a';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#4a6a8a';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(getTranslation('spectrum.waiting_data'), width / 2, height / 2);
        return;
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0a121e');
    gradient.addColorStop(1, '#060a12');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const step = Math.max(1, Math.floor(spectrumData.length / width));
    ctx.beginPath();
    ctx.strokeStyle = '#7ab7ef';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#4a8aba';
    ctx.shadowBlur = 4;

    for (let i = 0; i < width; i++) {
        const idx = Math.min(i * step, spectrumData.length - 1);
        const val = spectrumData[idx] || 0;
        const x = i;
        const y = height - (val / 255) * (height - 20) - 10;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(74, 138, 186, 0.3)');
    grad.addColorStop(1, 'rgba(74, 138, 186, 0.05)');
    ctx.fillStyle = grad;
    ctx.fill();
}

// ---- WATERFALL (COM ROLAGEM CONTÍNUA) ----
function updateWaterfall(bins) {
    try {
        const canvas = waterfallCanvas;
        const ctx = canvas.getContext('2d');
        const rect = canvas.parentElement.getBoundingClientRect();
        
        let width = canvas.clientWidth || rect.width - 24 || 800;
        width = Math.max(100, width);
        let height = canvas.clientHeight || 120;
        height = Math.max(30, height);
        
        canvas.width = width;
        canvas.height = height;

        if (!bins || bins.length === 0) {
            ctx.fillStyle = '#060a12';
            ctx.fillRect(0, 0, width, height);
            return;
        }

        if (waterfallData.length === 0) {
            for (let i = 0; i < WATERFALL_LINES; i++) {
                waterfallData.push(new Uint8Array(width).fill(0));
            }
            waterfallLineIndex = 0;
        }

        if (waterfallData.length > 0 && waterfallData[0].length !== width) {
            waterfallData = waterfallData.map(line => {
                const newLine = new Uint8Array(width);
                const copyLength = Math.min(line.length, width);
                for (let i = 0; i < copyLength; i++) {
                    newLine[i] = line[i] || 0;
                }
                return newLine;
            });
        }

        const newLine = new Uint8Array(width);
        const step = Math.max(1, Math.floor(bins.length / width));
        for (let i = 0; i < width; i++) {
            const idx = Math.min(i * step, bins.length - 1);
            newLine[i] = bins[idx] || 0;
        }

        waterfallData[waterfallLineIndex % WATERFALL_LINES] = newLine;
        waterfallLineIndex = (waterfallLineIndex + 1) % WATERFALL_LINES;

        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        for (let y = 0; y < height; y++) {
            const progress = y / height;
            let sourceIndex;
            
            if (waterfallLineIndex > 0) {
                sourceIndex = (waterfallLineIndex - 1 - Math.floor(progress * WATERFALL_LINES) + WATERFALL_LINES) % WATERFALL_LINES;
            } else {
                sourceIndex = (WATERFALL_LINES - 1 - Math.floor(progress * WATERFALL_LINES)) % WATERFALL_LINES;
            }
            
            if (sourceIndex >= 0 && sourceIndex < waterfallData.length) {
                const line = waterfallData[sourceIndex];
                if (line) {
                    for (let x = 0; x < width; x++) {
                        const val = line[x] || 0;
                        const idx = (y * width + x) * 4;

                        const r = Math.min(255, val * 1.2);
                        const g = Math.min(255, val * 0.8);
                        const b = Math.min(255, (255 - val) * 0.9);

                        data[idx] = r;
                        data[idx + 1] = g;
                        data[idx + 2] = b;
                        data[idx + 3] = 255;
                    }
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
    } catch (error) {
        console.error('Erro no updateWaterfall:', error);
    }
}

// ---- INICIALIZAR CANVAS ----
function initSpectrumCanvas() {
    try {
        const canvas = spectrumCanvas;
        const rect = canvas.parentElement.getBoundingClientRect();
        
        let width = canvas.clientWidth || rect.width - 24 || 800;
        width = Math.max(100, width);
        let height = canvas.clientHeight || 200;
        height = Math.max(50, height);
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0a121e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#4a6a8a';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(getTranslation('spectrum.waiting_data'), canvas.width / 2, canvas.height / 2);

        const wfCanvas = waterfallCanvas;
        const wfRect = wfCanvas.parentElement.getBoundingClientRect();
        
        let wfWidth = wfCanvas.clientWidth || wfRect.width - 24 || 800;
        wfWidth = Math.max(100, wfWidth);
        let wfHeight = wfCanvas.clientHeight || 120;
        wfHeight = Math.max(30, wfHeight);
        
        wfCanvas.width = wfWidth;
        wfCanvas.height = wfHeight;
        const wfCtx = wfCanvas.getContext('2d');
        wfCtx.fillStyle = '#060a12';
        wfCtx.fillRect(0, 0, wfCanvas.width, wfCanvas.height);
        
        waterfallData = [];
        waterfallLineIndex = 0;
        
        spectrumInfo.textContent = getTranslation('spectrum.fft_waiting');
    } catch (error) {
        console.error('Erro ao inicializar canvas:', error);
    }
}

// ---- ATUALIZAR UI ----
function updateUIProperty(prop, value, device) {
    const dev = device || 'primary';
    if (dev !== currentDevice && currentDevice !== 'all') return;

    switch (prop) {
        case 'device_vfo_frequency':
            freqInput.value = value;
            metricFrequency.textContent = formatFrequency(value);
            freqCenter.textContent = formatFrequency(value);
            break;
        case 'demodulator':
            selDemod.value = value;
            metricDemod.textContent = value;
            break;
        case 'filter_bandwidth':
            filterBw.value = value;
            metricFilterBw.textContent = formatFrequency(value);
            break;
        case 'lna_state':
            lnaGain.value = value;
            metricLna.textContent = value;
            break;
        case 'audio_volume_percent':
            audioVolume.value = value;
            break;
        case 'audio_mute':
            chkMute.checked = value === 'true';
            break;
        case 'squelch_enable':
            chkSquelch.checked = value === 'true';
            break;
        case 'device_sample_rate':
            metricSampleRate.textContent = formatFrequency(value);
            break;
        case 'overload':
            metricOverload.textContent = value === 'true' ? getTranslation('metrics.overload_yes') : getTranslation('metrics.overload_no');
            break;
        case 'signal_power':
            audioSignalPower.textContent = value + ' dB';
            break;
        case 'signal_snr':
            audioSignalSnr.textContent = value + ' dB';
            break;
        case 'rds_ps':
            audioRdsPs.textContent = value || '--';
            break;
        case 'rds_radiotext':
            audioRdsText.textContent = value || '--';
            break;
        case 'active_device':
            metricDevice.textContent = value;
            break;
        case 'started':
            // Atualiza o status do stream do dispositivo
            streamStatus.device = value === 'true';
            updateStreamingMetric();
            break;
        default:
            break;
    }
}

// ---- UTILITÁRIOS ----
function formatFrequency(hz) {
    const num = parseFloat(hz);
    if (isNaN(num)) return hz;
    if (num >= 1e9) return (num / 1e9).toFixed(3) + ' GHz';
    if (num >= 1e6) return (num / 1e6).toFixed(3) + ' MHz';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + ' kHz';
    return num + ' Hz';
}

function updateStatus(state) {
    statusIndicator.className = '';
    switch (state) {
        case 'connected':
            statusIndicator.classList.add('status-connected');
            statusLabel.textContent = getTranslation('header.connected');
            break;
        case 'connecting':
            statusIndicator.classList.add('status-connecting');
            statusLabel.textContent = getTranslation('header.connecting');
            break;
        case 'disconnected':
        default:
            statusIndicator.classList.add('status-disconnected');
            statusLabel.textContent = getTranslation('header.disconnected');
            break;
    }
}

function addLog(type, message) {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry type-${type}`;
    entry.innerHTML = `<span class="time">[${time}]</span> ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;

    while (logContainer.children.length > 200) {
        logContainer.removeChild(logContainer.firstChild);
    }
}

// ---- REDIMENSIONAMENTO ----
window.addEventListener('resize', () => {
    initSpectrumCanvas();
    if (spectrumData.length) drawSpectrum();
});
