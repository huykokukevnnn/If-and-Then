/**
 * AI Smart Home - Game Giáo Dục Trải Nghiệm & Lập Trình AI
 * Tác giả: Antigravity Code Assistant
 * Công nghệ: Vanilla JS, Web Audio API, SVG Interactivity, Touch/Mouse Event Drawing
 */

// --- 1. HỆ THỐNG ÂM THANH DỰA TRÊN WEB AUDIO API ---
const SoundManager = {
    ctx: null,
    muted: false,

    init() {
        // Khởi tạo AudioContext khi người dùng tương tác lần đầu
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    },

    playBeep(freq = 600, duration = 0.08, type = 'sine') {
        if (this.muted) return;
        this.init();
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            
            gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            console.log("Audio play error", e);
        }
    },

    playSuccess() {
        if (this.muted) return;
        this.init();
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // Đô - Mi - Sol - Đô (C5-E5-G5-C6)
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this.playBeep(freq, 0.25, 'triangle');
            }, i * 80);
        });
    },

    playSwoosh() {
        if (this.muted) return;
        this.init();
        try {
            const bufferSize = this.ctx.sampleRate * 0.4;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            
            // Tạo tiếng ồn trắng (white noise)
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            // Quét tần số lọc từ cao xuống thấp để tạo tiếng gió lướt qua
            filter.frequency.setValueAtTime(3000, this.ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.35);
            
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            
            noise.start();
            noise.stop(this.ctx.currentTime + 0.4);
        } catch (e) {
            this.playBeep(300, 0.3, 'sawtooth');
        }
    },

    playChime() {
        if (this.muted) return;
        this.playBeep(880, 0.15, 'sine');
        setTimeout(() => this.playBeep(1320, 0.25, 'sine'), 100);
    },

    melodyInterval: null,
    melodyNotes: [
        { freq: 261.63, dur: 0.4 }, // C4
        { freq: 329.63, dur: 0.4 }, // E4
        { freq: 392.00, dur: 0.4 }, // G4
        { freq: 440.00, dur: 0.4 }, // A4
        { freq: 523.25, dur: 0.8 }, // C5
        { freq: 440.00, dur: 0.4 }, // A4
        { freq: 392.00, dur: 0.4 }, // G4
        { freq: 329.63, dur: 0.4 }  // E4
    ],
    melodyIndex: 0,

    startRoyaltyFreeMusic() {
        if (this.melodyInterval) return;
        this.melodyIndex = 0;
        this.init();
        
        this.melodyInterval = setInterval(() => {
            if (this.muted) return;
            const note = this.melodyNotes[this.melodyIndex];
            this.playBeep(note.freq, note.dur, 'sine');
            this.melodyIndex = (this.melodyIndex + 1) % this.melodyNotes.length;
        }, 500);
    },

    stopRoyaltyFreeMusic() {
        if (this.melodyInterval) {
            clearInterval(this.melodyInterval);
            this.melodyInterval = null;
        }
    }
};

// --- 2. CẤU HÌNH DỮ LIỆU GAME & TRẠNG THÁI ---
const GameData = {
    // Trạng thái hoạt động của 8 thiết bị ở Phase 1
    deviceStates: {
        fan: false,
        light: false,
        vacuum: false,
        fridge: false,
        ac: false,
        glassdoor: false,
        tv: false,
        speaker: false
    },

    dashboardMetrics: {
        totalCommands: 0,
        successCount: 0,
        activeDevices: 0
    },

    // --- MỚI: Trạng thái môi trường & tự động hóa ---
    isDaytime: true,
    isProgrammed: false,
    environmentInterval: null,
    trashItems: [],
    robotCleaning: false,
    robotTarget: null,

    commandsTestedCount: 0,
    commandsTestedSet: new Set(),
    requiredCommandsToUnlock: 3

    // Giai đoạn 2: Bảng dữ liệu thẻ cột Trái & Phải (Scrambled & Mapped to 8 Devices)
     // Cấu trúc: { "L1": "R3", "L2": "R1", ... }
};

// --- 3. KHỞI TẠO VÀ BẮT ĐẦU APP ---


const App = {
    currentScreen: 'phase1',
    activeDragDot: null,
    dragStartCoords: null,
    tempCable: null,

    init() {
        this.bindGlobalEvents();
        this.initPhase1();
        
        
        // Mặc định cập nhật giao diện Dashboard
        this.updateDashboardUI();

        // --- BẮT ĐẦU CHU KỲ MÔI TRƯỜNG & DRAG DROP ---
        this.startEnvironmentLoop();
        this.setupTrashDragAndDrop();
    },

    // Quản lý chuyển đổi màn hình game mượt mà
    showScreen(screenId) {
        SoundManager.playSwoosh();
        
        // Ẩn tất cả các màn hình
        document.querySelectorAll('.screen-container').forEach(screen => {
            screen.classList.remove('active');
        });

        // Hiển thị màn hình mong muốn
        const targetScreen = document.getElementById(`${screenId}-screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
        }

        // Cập nhật thanh chỉ thị tiến trình (Step Indicators)
        const step1 = document.getElementById('step-indicator-1');
        const step2 = document.getElementById('step-indicator-2');
        
        if (screenId === 'intro' || screenId === 'phase1') {
            step1.classList.add('active');
            step1.classList.remove('completed');
            step2.classList.remove('active', 'completed');
        } else if (screenId === 'phase2') {
            step1.classList.add('completed');
            step1.classList.remove('active');
            step2.classList.add('active');
            step2.classList.remove('completed');
             // Vẽ lại dây nối phòng trường hợp kích thước thay đổi
        } else if (screenId === 'testing') {
            step1.classList.add('completed');
            step2.classList.add('completed');
            step2.classList.remove('active');
        }
    },

    bindGlobalEvents() {

        // Bấm nút chơi lại từ đầu
        document.getElementById('btn-restart-app').addEventListener('click', () => {
            if (confirm("Bạn có muốn chơi lại game từ đầu không?")) {
                this.resetWholeGame();
            }
        });

        // Bấm nút loa bật/tắt âm thanh
        const btnSound = document.getElementById('btn-sound-toggle');
        btnSound.addEventListener('click', () => {
            const isMuted = SoundManager.toggleMute();
            const soundText = document.getElementById('sound-text');
            const soundIcon = document.getElementById('sound-icon');
            
            if (isMuted) {
                soundText.innerText = "Âm thanh: Tắt";
                soundIcon.innerHTML = `<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>`;
            } else {
                soundText.innerText = "Âm thanh: Bật";
                soundIcon.innerHTML = `<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>`;
                SoundManager.playBeep(700, 0.1);
            }
        });

        // Đóng mở Modal Gợi Ý Câu Lệnh
        document.getElementById('btn-show-help').addEventListener('click', () => {
            SoundManager.playBeep(500, 0.08);
            document.getElementById('modal-help-commands').classList.add('active');
        });

        document.getElementById('btn-close-help').addEventListener('click', () => {
            SoundManager.playBeep(400, 0.08);
            document.getElementById('modal-help-commands').classList.remove('active');
        });

        // Đóng modal khi bấm ra ngoài vùng chứa
        document.getElementById('modal-help-commands').addEventListener('click', (e) => {
            if (e.target.id === 'modal-help-commands') {
                document.getElementById('modal-help-commands').classList.remove('active');
            }
        });

        // Bấm vào gợi ý lệnh để chèn tự động vào input chat
        document.querySelectorAll('.help-command-item').forEach(item => {
            item.addEventListener('click', () => {
                const cmd = item.getAttribute('data-cmd');
                document.getElementById('chat-input-field').value = cmd;
                document.getElementById('modal-help-commands').classList.remove('active');
                document.getElementById('chat-input-field').focus();
                SoundManager.playBeep(650, 0.08);
            });
        });

        // Sự kiện resize màn hình vẽ lại dây cáp nối
        window.addEventListener('resize', () => {
            if (this.currentScreen === 'phase2') {
                this.updateConnectionLines();
            }
        });
    },

    // --- GIAI ĐOẠN 1: KHÁM PHÁ AI SMART HOME ---
    initPhase1() {
        const form = document.getElementById('chat-form-input');
        const input = document.getElementById('chat-input-field');
        const micBtn = document.getElementById('btn-mic-input');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;

            // Xử lý gửi tin nhắn của học sinh
            this.appendChatMessage(text, 'user');
            input.value = '';

            // AI phân tích và phản hồi sau 0.6 giây
            setTimeout(() => {
                this.processAICommand(text);
            }, 600);
        });

        // --- KHỞI TẠO BỘ THU ÂM GIỌNG NÓI MICRO (WEB SPEECH API) ---
        if (micBtn) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.lang = 'vi-VN'; // Cài đặt nhận diện tiếng Việt
                recognition.interimResults = false;
                recognition.maxAlternatives = 1;
                
                let micActive = false;

                recognition.onstart = () => { micBtn.classList.add('recording'); input.placeholder = "LUNA đang luôn nghe giọng của bạn..."; };

                recognition.onresult = (event) => {
                    const speechResult = event.results[event.results.length - 1][0].transcript;
                    input.value = speechResult;
                    
                    // Phát tiếng chuông báo nhận diện thành công và tự động submit
                    SoundManager.playChime();
                    setTimeout(() => {
                        form.dispatchEvent(new Event('submit'));
                    }, 500);
                };

                recognition.onerror = (event) => {
                    console.error("Speech recognition error", event.error);
                    
                    if (event.error === 'not-allowed') {
                        micActive = false;
                        micBtn.classList.remove('recording');
                        let errorMsg = "Quyền truy cập Micro bị từ chối. Bạn vui lòng cấp quyền cho trình duyệt truy cập Micro!";
                        this.appendChatMessage(`Hệ thống: ${errorMsg}`, 'system');
                        input.placeholder = "Nhập câu lệnh trực tiếp hoặc ngữ cảnh...";
                        SoundManager.playBeep(300, 0.15, 'sine');
                    }
                };

                recognition.onend = () => {
                    // Nếu chế độ micActive vẫn bật, tự động khởi động lại nhận diện để luôn chờ giọng!
                    if (micActive) {
                        try {
                            recognition.start();
                        } catch (e) {
                            console.error("Lỗi khi khởi động lại nhận dạng giọng nói:", e);
                        }
                    } else {
                        micBtn.classList.remove('recording');
                        input.placeholder = "Nhập câu lệnh trực tiếp hoặc ngữ cảnh...";
                    }
                };

                micBtn.addEventListener('click', () => {
                    micActive = !micActive;
                    if (micActive) {
                        SoundManager.playBeep(800, 0.12, 'sine');
                        recognition.start();
                    } else {
                        recognition.stop();
                    }
                });
            } else {
                // Trình duyệt không hỗ trợ Web Speech API (như Firefox hoặc trình duyệt cũ)
                micBtn.addEventListener('click', () => {
                    alert("Trình duyệt của bạn chưa hỗ trợ tính năng thu âm Web Speech API. Bạn vui lòng sử dụng Google Chrome hoặc Microsoft Edge bản mới, hoặc nhập câu lệnh bằng bàn phím nhé!");
                    SoundManager.playBeep(350, 0.15, 'sine');
                });
            }
        }
    },

    appendChatMessage(text, sender) {
        const logContainer = document.getElementById('chat-history-log');
        if (!logContainer) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${sender}`;

        const timeSpan = `<span class="chat-msg-time">${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>`;

        if (sender === 'user') {
            msgDiv.innerHTML = `<strong>Bạn:</strong> ${text} ${timeSpan}`;
        } else if (sender === 'ai') {
            const formattedText = text.replace(/\n/g, '<br>');
            msgDiv.innerHTML = `<strong>LUNA:</strong> ${formattedText} ${timeSpan}`;
        } else {
            msgDiv.innerHTML = `${text} ${timeSpan}`;
        }

        logContainer.appendChild(msgDiv);
        logContainer.scrollTop = logContainer.scrollHeight;
    },

    processAICommand(text) {
        if (!text) return;
        const trimmedText = text.trim();
        
        // Tách câu lệnh theo các liên từ tiếng Việt: và, đồng thời, rồi, sau đó, dấu phẩy, dấu chấm phẩy
        const subCommands = trimmedText.split(/\s*(?:và|đồng thời|rồi|sau đó|,|;)\s*/gi).filter(Boolean);
        
        let allActions = [];
        let explanations = [];
        let triggeredCount = 0;
        
        subCommands.forEach(subCmd => {
            const result = this.parseSingleCommand(subCmd);
            if (result.triggered) {
                triggeredCount++;
                allActions.push(...result.actions);
                explanations.push(result.explanation);
            }
        });
        
        let reply = "";
        
        if (triggeredCount > 0) {
            // Thực thi đồng thời tất cả các hành động thiết bị
            allActions.forEach(action => {
                this.toggleDevice(action.devName, action.state);
            });
            
            // Tổng hợp và làm sạch các chuỗi giải thích
            const uniqueExplanations = [...new Set(explanations)].filter(Boolean);
            
            if (subCommands.length > 1) {
                reply = `🤖 Trợ Lý LUNA: Thực thi gộp ${triggeredCount} câu lệnh cùng lúc!\n\n` + 
                        uniqueExplanations.map((exp, idx) => `${idx + 1}. ${exp}`).join("\n");
            } else {
                reply = uniqueExplanations[0] || "Đã thực hiện lệnh của bạn.";
            }
            
            SoundManager.playSuccess();
        } else {
            reply = "Tôi đã ghi nhận ý kiến của bạn, nhưng bộ não AI hiện tại chưa được lập trình để hiểu câu lệnh này. Hãy thử câu lệnh trực tiếp như 'Bật quạt', 'Sàn nhà dơ' hoặc bấm 'Gợi Ý' để xem danh sách nhé!";
            SoundManager.playBeep(300, 0.15, 'sine');
        }
        
        this.appendChatMessage(reply, 'ai');
        
        const lunaSpeech = document.getElementById('luna-speech-text');
        if (lunaSpeech) {
            lunaSpeech.innerText = reply;
        }

        // Cập nhật bộ đếm thử nghiệm học sinh tại Phase 1
        if (triggeredCount > 0 && !GameData.commandsTestedSet.has(trimmedText)) {
            GameData.commandsTestedSet.add(trimmedText);
            GameData.commandsTestedCount += triggeredCount;
            
            if (GameData.commandsTestedCount >= GameData.requiredCommandsToUnlock) {
                const btnNext = document.getElementById('btn-to-phase-2');
                if (btnNext) {
                    btnNext.classList.add('ready');
                    btnNext.title = "Tuyệt vời! Bạn đã sẵn sàng bước sang lập trình AI mới!";
                }
            }
        }
    },

    parseSingleCommand(sentenceText) {
        const text = sentenceText.toLowerCase().trim();
        let triggered = false;
        let actions = [];
        let explanation = "";

        // 1. Thiết bị Quạt (fan) - Tắt trước, Bật sau
        if (this.matchKeywords(text, ["tắt quạt", "tat quat", "dừng quạt", "ngừng quạt", "đóng quạt", "dong quat"])) {
            actions.push({ devName: 'fan', state: false });
            explanation = "Đã tắt quạt đứng. Cánh quạt đã ngừng quay.";
            triggered = true;
        } else if (this.matchKeywords(text, ["bật quạt", "bat quat", "mở quạt", "mo quat", "quay quạt"])) {
            actions.push({ devName: 'fan', state: true });
            explanation = "Đã bật quạt đứng! Bạn sẽ thấy cánh quạt bắt đầu xoay tít mát mẻ.";
            triggered = true;
        }
        
        // 2. Thiết bị Đèn LED áp tường (light) - Tắt trước, Bật sau
        else if (this.matchKeywords(text, ["tắt đèn", "tat den", "đóng đèn", "dong den"])) {
            actions.push({ devName: 'light', state: false });
            explanation = "Đã tắt đèn LED áp tường. Căn phòng trở lại bình thường.";
            triggered = true;
        } else if (this.matchKeywords(text, ["bật đèn", "bat den", "mở đèn", "mo den", "bật ánh sáng", "thắp sáng"])) {
            actions.push({ devName: 'light', state: true });
            explanation = "Đèn LED áp tường đã được bật! Hai chùm sáng cone thắp sáng hai bên tường phòng khách.";
            triggered = true;
        }

        // 3. Thiết bị Robot hút bụi (vacuum) - Tắt trước, Bật sau
        else if (this.matchKeywords(text, ["dừng hút", "dung hut", "tắt robot", "tat robot", "dừng robot", "tắt máy hút bụi", "tat may hut bui", "đóng robot", "dong robot", "đóng máy hút bụi", "dong may hut bui"])) {
            actions.push({ devName: 'vacuum', state: false });
            explanation = "Robot hút bụi đã tạm dừng công việc dọn dẹp.";
            triggered = true;
        } else if (this.matchKeywords(text, ["sàn nhà dơ", "san nha do", "sàn nhà bẩn", "san nha ban", "nhà bẩn", "nha ban", "nhà dơ", "nha do", "sàn dơ", "san do", "sàn bẩn", "san ban", "bụi", "bui", "rác", "rac"])) {
            actions.push({ devName: 'vacuum', state: true });
            explanation = "🚨 Phân tích AI: Ngữ cảnh 'Sàn dơ' -> Đã bật Robot hút bụi dọn dẹp sàn nhà dơ bẩn sạch sẽ!";
            triggered = true;
        } else if (this.matchKeywords(text, ["hút bụi", "hut bui", "quét nhà", "quet nha", "dọn dẹp", "don dep", "kích hoạt robot", "bật robot", "bat robot", "mở robot", "mo robot", "bật máy hút bụi", "bat may hut bui", "mở máy hút bụi", "mo may hut bui"])) {
            actions.push({ devName: 'vacuum', state: true });
            explanation = "Robot hút bụi thông minh đang tự trượt đi dọn sàn nhà cho sạch sẽ!";
            triggered = true;
        }

        // 4. Thiết bị Tủ lạnh 2 cánh (fridge) - Đóng/Tắt trước, Mở sau để tránh lỗi đè từ khóa
        else if (this.matchKeywords(text, ["đóng tủ lạnh", "dong tu lanh", "tắt tủ lạnh", "tat tu lanh", "đóng tủ", "dong tu"])) {
            actions.push({ devName: 'fridge', state: false });
            explanation = "Đã đóng khít tủ lạnh để tiết kiệm điện năng cho bạn.";
            triggered = true;
        } else if (this.matchKeywords(text, ["mở tủ lạnh", "mo tu lanh", "tủ lạnh"])) {
            actions.push({ devName: 'fridge', state: true });
            explanation = "Tôi đã mở lật 2 cánh cửa tủ lạnh! Đèn ấm áp cùng thực phẩm mát lạnh bên trong đã lộ diện.";
            triggered = true;
        }

        // 5. Thiết bị Máy lạnh (ac) - Tắt trước, Bật sau
        else if (this.matchKeywords(text, ["tắt máy lạnh", "tat may lanh", "tắt điều hòa", "tat dieu hoa"])) {
            actions.push({ devName: 'ac', state: false });
            explanation = "Máy lạnh treo tường đã tắt. Nắp phả gió đóng lại.";
            triggered = true;
        } else if (this.matchKeywords(text, ["bật máy lạnh", "bat may lanh", "bật điều hòa", "bat dieu hoa"])) {
            actions.push({ devName: 'ac', state: true });
            explanation = "Máy lạnh treo tường đã bật! Luồng sóng gió mát lạnh đang phả xuống phòng khách.";
            triggered = true;
        }

        // 6. Thiết bị Cửa kính trượt ban công (glassdoor) - Tắt/Đóng trước, Mở sau
        else if (this.matchKeywords(text, ["đóng cửa kính", "dong cua kinh", "đóng cửa ban công", "khóa cửa kính", "đóng cửa", "tắt cửa", "tat cua"])) {
            actions.push({ devName: 'glassdoor', state: false });
            explanation = "Hai cánh cửa kính đã trượt khít lại để chắn gió và cách âm.";
            triggered = true;
        } else if (this.matchKeywords(text, ["mở cửa kính", "mo cua kinh", "mở cửa ban công", "mở cửa kính ban công", "hãy mở cửa kính ban công", "mở cửa"])) {
            actions.push({ devName: 'glassdoor', state: true });
            explanation = "Đã trượt mở hai cánh cửa kính cường lực sang hai bên để bạn ngắm ban công gió mát tự nhiên nhé!";
            triggered = true;
        }

        // 7. Thiết bị Tivi treo tường (tv) - Tắt trước, Bật sau
        else if (this.matchKeywords(text, ["tắt tivi", "tat tivi", "tắt tv", "tat tv", "đóng tivi", "dong tivi", "đóng tv", "dong tv"])) {
            actions.push({ devName: 'tv', state: false });
            explanation = "Đã tắt tivi treo tường. Đèn LED chỉ thị đã chuyển sang màu đỏ tắt nguồn.";
            triggered = true;
        } else if (this.matchKeywords(text, ["bật tivi", "bat tivi", "mở tivi", "mo tivi", "bật tv", "mở tv", "tivi", "xem tivi", "xem tv"])) {
            actions.push({ devName: 'tv', state: true });
            explanation = "Tivi đã được bật";
            triggered = true;
        }

        // 8. Thiết bị Loa đứng dạng trụ (speaker) - Tắt trước, Bật sau
        else if (this.matchKeywords(text, ["tắt loa", "tat loa", "tắt nhạc", "tat nhac", "dừng nhạc", "dung nhac"])) {
            actions.push({ devName: 'speaker', state: false });
            explanation = "Đã tắt loa phát nhạc. Viền LED hồng mờ đi và các nốt nhạc ngừng bay.";
            triggered = true;
        } else if (this.matchKeywords(text, ["bật loa", "bat loa", "mở loa", "mo loa", "phát nhạc", "phat nhac", "bật nhạc", "bat nhac", "mở nhạc", "mo nhac", "nghe nhạc", "nghe nhac"])) {
            actions.push({ devName: 'speaker', state: true });
            explanation = "Cột loa đứng dạng trụ đã được bật! Viền LED hồng neon sang trọng sáng bừng và các nốt nhạc bắt đầu bay lơ lửng vô cùng sống động.";
            triggered = true;
        }

        // --- NHÓM NGỮ CẢNH PHỨC TẠP ---
        else if (this.matchKeywords(text, ["nóng quá", "nong qua", "nực quá", "oi bức", "nóng nực", "trời nóng"])) {
            actions.push({ devName: 'fan', state: true }, { devName: 'ac', state: true });
            explanation = "🚨 Phân tích AI: Ngữ cảnh 'Trời nóng' -> Đã bật cả QUẠT ĐỨNG và MÁY LẠNH treo tường cùng một lúc để hạ nhiệt độ phòng nhanh nhất!";
            triggered = true;
        }
        else if (this.matchKeywords(text, ["tối quá", "toi qua", "không thấy đường", "khong thay duong", "không thấy gì"])) {
            actions.push({ devName: 'light', state: true });
            explanation = "🚨 Phân tích AI: Ngữ cảnh 'Thiếu ánh sáng' -> Đã bật hai chiếc ĐÈN LED ÁP TƯỜNG để rọi chùm sáng cone ấm áp rực rỡ!";
            triggered = true;
        }
        else if (this.matchKeywords(text, ["đói bụng", "đói quá", "doi qua", "thèm ăn", "an gi", "ăn gì"])) {
            actions.push({ devName: 'fridge', state: true });
            explanation = "🚨 Phân tích AI: Ngữ cảnh 'Đói bụng' -> Đã tự động MỞ CỬA TỦ LẠNH 2 CÁNH cho bạn dễ dàng lựa chọn thực phẩm!";
            triggered = true;
        }
        else if (this.matchKeywords(text, ["khát nước", "khat nuoc", "khát quá", "khat qua", "uống nước", "uong nuoc", "muốn uống nước", "nước ngọt"])) {
            actions.push({ devName: 'fridge', state: true });
            explanation = "🚨 Phân tích AI: Ngữ cảnh 'Khát nước' -> Đã tự động MỞ CỬA TỦ LẠNH 2 CÁNH thắp sáng cho bạn dễ dàng lấy nước uống giải khát!";
            triggered = true;
        }
        else if (this.matchKeywords(text, ["thư giãn", "thu gian", "relax", "mệt mỏi", "met moi", "căng thẳng", "cang thang", "xả stress"])) {
            actions.push({ devName: 'ac', state: true }, { devName: 'speaker', state: true });
            explanation = "🚨 Phân tích AI: Ngữ cảnh 'Thư giãn' -> Đã bật ĐIỀU HÒA thổi sóng gió mát rượi và khởi động LOA ĐỨNG trụ quẩy nhạc thư thái vô cùng chill!";
            triggered = true;
        }
        else if (this.matchKeywords(text, ["buồn quá", "buon qua", "chán quá", "chan qua", "giải trí", "giai tri", "buồn chán", "buon chan"])) {
            actions.push({ devName: 'tv', state: true }, { devName: 'speaker', state: true });
            explanation = "🚨 Phân tích AI: Ngữ cảnh 'Buồn chán' -> Đã mở màn hình Tivi nhiễu sóng và bật Loa quẩy nhạc nốt bay sinh động!";
            triggered = true;
        }
        else if (this.matchKeywords(text, ["đi ngủ", "di ngu", "ngủ ngon", "ngu ngon", "buồn ngủ", "buon ngu", "tắt hết", "tat het", "tắt tất cả"])) {
            actions.push(
                { devName: 'glassdoor', state: false },
                { devName: 'vacuum', state: false },
                { devName: 'light', state: false },
                { devName: 'tv', state: false },
                { devName: 'speaker', state: false },
                { devName: 'fan', state: false },
                { devName: 'ac', state: true }
            );
            explanation = "🚨 Phân tích AI: Ngữ cảnh 'Đi ngủ / Tắt hết' -> Đã đóng CỬA KÍNH, tắt ĐÈN, TIVI, LOA, QUẠT, ROBOT dọn dẹp và bật ĐIỀU HÒA mát lạnh để bạn có giấc ngủ ngon nhất!";
            triggered = true;
        }

        return { triggered, actions, explanation };
    },

    matchKeywords(text, keywords) {
        return keywords.some(kw => text.includes(kw));
    },

    toggleDevice(devName, forceState) {
        const targetState = forceState !== undefined ? forceState : !GameData.deviceStates[devName];
        GameData.deviceStates[devName] = targetState;

        // Cập nhật giao diện hình vẽ SVG bằng cách thêm bớt CSS Class
        const element = document.getElementById(`device-${devName}`);
        if (element) {
            if (targetState) {
                element.classList.add(`device-${devName}-on`);
            } else {
                element.classList.remove(`device-${devName}-on`);
            }
        }

        // Tự động tối/sáng căn phòng khi bật/tắt đèn
        if (devName === 'light') {
            const containers = document.querySelectorAll('.inner-room-container');
            containers.forEach(container => {
                if (targetState) {
                    container.classList.add('device-light-on');
                } else {
                    container.classList.remove('device-light-on');
                }
            });
        }

        // Tự động cập nhật số liệu Dashboard theo hoạt động
        if (devName === 'ac' && targetState) {
            GameData.dashboardMetrics.temp = 24;
        } else if (devName === 'ac' && !targetState) {
            GameData.dashboardMetrics.temp = 30; // Trở về mặc định
        }

        if (devName === 'vacuum') {
            GameData.dashboardMetrics.air = targetState ? "Tuyệt vời (Sạch)" : "Ngột ngạt";
            if (targetState) this.checkAndRunRobotVacuum();
        }

        if (devName === 'speaker') {
            if (targetState) {
                SoundManager.startRoyaltyFreeMusic();
            } else {
                SoundManager.stopRoyaltyFreeMusic();
            }
        }

        if (devName === 'tv') {
            const tvVideo = document.getElementById('tvVideo');
            if (tvVideo) {
                if (targetState) {
                    tvVideo.loop = true; // Kích hoạt loop vô hạn bằng code JS cho chắc chắn
                    tvVideo.muted = false; // Mở khóa âm thanh để nghe được tiếng của clip!
                    tvVideo.volume = 0.5; // Đặt âm lượng cố định ở mức 50% nghe êm ái hơn
                    tvVideo.play().catch(e => {
                        console.log("Video auto-play blocked with sound, attempting muted: ", e);
                        // Fallback: Nếu trình duyệt quá khắt khe chặn phát tiếng, tắt tiếng để giữ video chạy mượt mà
                        tvVideo.muted = true;
                        tvVideo.play().catch(err => console.log("Muted video play failed: ", err));
                    });
                } else {
                    tvVideo.pause();
                    tvVideo.currentTime = 0;
                }
            }
        }

        if (devName === 'fridge') {
            // Xóa bộ hẹn giờ cũ nếu có
            if (this.fridgeTimer) {
                clearTimeout(this.fridgeTimer);
                this.fridgeTimer = null;
            }

            if (targetState) {
                // Nếu tủ lạnh đang mở, đặt hẹn giờ 5 giây tự động đóng & cảnh báo
                this.fridgeTimer = setTimeout(() => {
                    // Tự động đóng tủ lạnh
                    this.toggleDevice('fridge', false);
                    
                    

                    // LUNA đưa ra tin nhắn cảnh báo
                    const alertMsg = "Trợ Lý LUNA: Cảnh báo 🚨! Cửa tủ lạnh đã mở quá 5 giây. Tôi đã tự động đóng khít tủ lạnh để tiết kiệm điện năng.";
                    this.appendChatMessage(alertMsg, 'luna');
                    
                    // Phát giọng nói LUNA phản hồi (nếu có Web Speech)
                    if ('speechSynthesis' in window) {
                        const utterance = new SpeechSynthesisUtterance("Cảnh báo. Tủ lạnh mở quá lâu đã tự động đóng.");
                        utterance.lang = 'vi-VN';
                        window.speechSynthesis.speak(utterance);
                    }
                }, 5000);
            }
        }

        this.updateDashboardUI();

        // Tự động đồng bộ hóa trạng thái nút xanh ở tab Test
        if (this.currentScreen === 'testing') {
            this.updateTestButtonsActiveState();
        }
    },

    updateDashboardUI() {
        const temp = document.getElementById('dash-temp');
        const air = document.getElementById('dash-air');
        const lock = document.getElementById('dash-lock');
        
        if (temp) temp.textContent = GameData.dashboardMetrics.temp;
        if (air) {
            air.textContent = GameData.dashboardMetrics.air;
            air.style.fill = GameData.dashboardMetrics.air === "Ngột ngạt" ? "var(--neon-pink)" : "var(--neon-green)";
        }
        if (lock) {
            lock.textContent = GameData.dashboardMetrics.lock;
            lock.style.fill = GameData.dashboardMetrics.lock === "ĐANG KHÓA" ? "var(--neon-pink)" : "var(--neon-green)";
        }
    },

    // --- GIAI ĐOẠN 2: TỰ TAY LẬP TRÌNH AI MỚI ---
    initPhase2() {
        // Render danh sách thẻ hai cột trái và phải
        

        // Nút xóa tất cả kết nối
        document.getElementById('btn-clear-connections').addEventListener('click', () => {
            SoundManager.playBeep(350, 0.12, 'sawtooth');
            this.clearAllConnections();
        });

        // Nút gửi nộp bộ nhớ lập trình AI
        document.getElementById('btn-submit-programming').addEventListener('click', () => {
            const connectedCount = Object.keys(GameData.connections).length;
            if (connectedCount < 8) {
                alert(`Bạn mới chỉ nối được ${connectedCount} / 8 liên kết thôi. Hãy hoàn thành tất cả 8 câu nói để huấn luyện AI mới nhé!`);
                SoundManager.playBeep(300, 0.2, 'sawtooth');
                return;
            }

            // Tiến hành chuyển giao diện sang giai đoạn Test
            SoundManager.playSuccess();
            this.switchToTestingPhase();
        });

        // Bấm nút quay lại lập trình từ màn Test
        document.getElementById('btn-back-to-programming').addEventListener('click', () => {
            this.showScreen('phase2');
        });

        // Bấm nút hoàn thành vinh danh cuối cùng
        document.getElementById('btn-finish-celebration').addEventListener('click', () => {
            SoundManager.playSuccess();
            document.getElementById('modal-congrats-celebration').classList.add('active');
        });

        // Nút restart trên modal congrats
        document.getElementById('btn-restart-from-congrats').addEventListener('click', () => {
            document.getElementById('modal-congrats-celebration').classList.remove('active');
            this.resetWholeGame();
        });

        // Bắt đầu lắng nghe kéo thả
        this.setupDragAndDropLogic();
    },

    clearAllConnections() {
        
        this.updateConnectionLines();
    },

    // --- GIAI ĐOẠN 2 - THỬ NGHIỆM AI TỰ HUẤN LUYỆN (TESTING) ---
    

    // THỰC THI CÂU LỆNH SAU KHI ĐƯỢC HUẤN LUYỆN (Chạy dạng trigger bật/tắt song song)
    executeCustomAICommand(leftId, utteranceText) {
        const rightId = GameData.connections[leftId];
        const rightCard = GameData.rightCards.find(c => c.id === rightId);

        if (!rightCard) {
            alert("Câu lệnh này chưa được lập trình dây kết nối!");
            return;
        }

        const actionKey = rightCard.actionKey;
        const devName = this.getDeviceFromActionKey(actionKey);
        const targetState = !GameData.deviceStates[devName];
        
        // 1. Chạy âm thanh click phản hồi
        SoundManager.playSuccess();

        // 2. Chạy logic kích hoạt thiết bị tương ứng (Giữ nguyên thiết bị cũ để chạy song song)
        let runExplanation = "";

        // Ánh xạ các chức năng của thiết bị dạng toggle bật/tắt
        this.toggleDevice(devName, targetState);

        if (targetState) {
            if (actionKey === 'fan_on') runExplanation = "Tôi đã cho xoay CÁNH QUẠT ĐIỆN.";
            else if (actionKey === 'ac_on') runExplanation = "Tôi đã bật ĐIỀU HÒA thổi gió mát lạnh.";
            else if (actionKey === 'light_on') runExplanation = "Tôi đã thắp sáng các ĐÈN LED ÁP TƯỜNG.";
            else if (actionKey === 'fridge_open') runExplanation = "Tôi đã MỞ CỬA TỦ LẠNH 2 CÁNH ấm áp thức ăn.";
            else if (actionKey === 'glassdoor_open') runExplanation = "Tôi đã trượt mở hai cánh CỬA KÍNH BAN CÔNG.";
            else if (actionKey === 'vacuum_on') runExplanation = "Tôi đã kích hoạt ROBOT HÚT BỤI chạy dọn dẹp.";
            else if (actionKey === 'tv_on') runExplanation = "Tivi đã được bật";
            else if (actionKey === 'speaker_on') runExplanation = "Tôi đã bật Loa trụ quẩy nhạc nốt bay lơ lửng.";
        } else {
            if (actionKey === 'fan_on') runExplanation = "Tôi đã tắt CÁNH QUẠT ĐIỆN.";
            else if (actionKey === 'ac_on') runExplanation = "Tôi đã tắt ĐIỀU HÒA.";
            else if (actionKey === 'light_on') runExplanation = "Tôi đã tắt các ĐÈN LED ÁP TƯỜNG.";
            else if (actionKey === 'fridge_open') runExplanation = "Tôi đã ĐÓNG CỬA TỦ LẠNH 2 CÁNH.";
            else if (actionKey === 'glassdoor_open') runExplanation = "Tôi đã đóng hai cánh CỬA KÍNH BAN CÔNG.";
            else if (actionKey === 'vacuum_on') runExplanation = "Tôi đã dừng ROBOT HÚT BỤI dọn dẹp.";
            else if (actionKey === 'tv_on') runExplanation = "Tôi đã tắt màn hình TIVI.";
            else if (actionKey === 'speaker_on') runExplanation = "Tôi đã dừng phát nhạc của LOA đứng.";
        }

        // 3. Phản hồi đầy hóm hỉnh của AI LUNA
        // Kiểm tra xem học sinh có nối đúng chức năng logic thông thường không
        const isStandardMatch = 
            (leftId === 'L1' && actionKey === 'fan_on') ||
            (leftId === 'L2' && actionKey === 'ac_on') ||
            (leftId === 'L3' && actionKey === 'light_on') ||
            (leftId === 'L4' && actionKey === 'fridge_open') ||
            (leftId === 'L5' && actionKey === 'glassdoor_open') ||
            (leftId === 'L6' && actionKey === 'vacuum_on') ||
            (leftId === 'L7' && actionKey === 'tv_on') ||
            (leftId === 'L8' && actionKey === 'speaker_on');

        let robotResponse = "";
        if (isStandardMatch) {
            robotResponse = `🤖 Trí tuệ nhân tạo mới thông báo: Nhận tín hiệu câu nói "${utteranceText}". Thực thi hành động: ${runExplanation}. Bạn đã dạy tôi một bài học logic rất chuẩn xác!`;
        } else {
            // Phản hồi hài hước khi học sinh nối chéo sáng tạo
            robotResponse = `🤪 Haha! Bạn đã lập trình cho tôi rằng khi nghe câu "${utteranceText}" thì tôi phải: ${runExplanation}. Tôi thực hiện chính xác những gì bạn dạy đó! Thật là sáng tạo hết nấc!`;
        }

        // Thay đổi avatar text của LUNA
        document.getElementById('luna-speech-text').innerText = robotResponse;
        
        // Tạo hiệu ứng nảy nhẹ quả cầu LUNA biểu cảm
        const orb = document.getElementById('luna-orb-element');
        if (orb) {
            orb.style.transform = 'scale(1.2) translateY(-10px)';
            setTimeout(() => {
                orb.style.transform = '';
            }, 500);
        }
    },

    // --- HÀM TÁI LẬP TRÌNH & ĐẶT LẠI GAME TOÀN DIỆN ---
    resetWholeGame() {
        // Trả hình vẽ SVG phòng về lại container Giai đoạn 1 ban đầu
        

        // Khôi phục tất cả biến trạng thái về mặc định
        GameData.deviceStates = {
            fan: false,
            light: false,
            vacuum: false,
            fridge: false,
            ac: false,
            glassdoor: false,
            tv: false,
            speaker: false
        };
        GameData.dashboardMetrics = {
            temp: 30, air: "Ngột ngạt", lock: "ĐANG KHÓA", speaker: "ĐANG TẮT"
        };
        GameData.commandsTestedCount = 0;
        GameData.commandsTestedSet.clear();
        GameData.connections = {};
        SoundManager.stopRoyaltyFreeMusic();
        if (this.fridgeTimer) {
            clearTimeout(this.fridgeTimer);
            this.fridgeTimer = null;
        }
        const tvVideo = document.getElementById('tvVideo');
        if (tvVideo) {
            tvVideo.pause();
            tvVideo.currentTime = 0;
        }

        // Xóa các CSS Class kích hoạt trong hình vẽ SVG thiết bị
        for (let dev in GameData.deviceStates) {
            const el = document.getElementById(`device-${dev}`);
            if (el) {
                el.classList.remove(`device-${dev}-on`);
            }
        }
        
        const containers = document.querySelectorAll('.inner-room-container');
        containers.forEach(container => {
            container.classList.remove('device-light-on');
        });
        
        const rvc = document.getElementById('room-viewport-container');
        if (rvc) rvc.className = 'room-viewport';
        
        
        
        // Cập nhật giao diện Dashboard về mặc định
        this.updateDashboardUI();

        // Reset giao diện Chat Console
        const log = document.getElementById('chat-history-log');
        if (log) {
            log.innerHTML = `
                <div class="chat-msg system">Hệ thống Smart Home AI đã được khởi tạo thành công!</div>
                <div class="chat-msg ai">
                    <strong>LUNA:</strong> Chào mừng bạn đã quay lại! Hãy nhập các câu nói như "Bật quạt", "Sàn nhà dơ", "Nóng quá",... để khám phá nhé!
                    <span class="chat-msg-time">Vừa xong</span>
                </div>
            `;
        }

        // Khóa nút sang Giai đoạn 2
        const btnNext = document.getElementById('btn-to-phase-2');
        if (btnNext) {
            btnNext.classList.remove('ready');
            btnNext.title = "";
        }

        // Reset LUNA speech text
        const lst = document.getElementById('luna-speech-text');
        if (lst) lst.innerText = "Chào mừng bạn đã vào nhà! Tôi là bộ não AI kết nối các thiết bị. Hãy gõ một câu lệnh bên dưới để tôi hỗ trợ bạn nhé!";

        // Reset bảng nối dây (xáo trộn lại từ đầu)
        this.renderMatchingCards();
        this.updateConnectionLines();

        // Chuyển màn hình về Intro
        this.showScreen('phase1');
    },

    playActionSound(action) {
        if (action === 'click') {
            SoundManager.playBeep(600, 0.08, 'sine');
        }
    },

    // --- PHẦN TỰ ĐỘNG HÓA (MÔI TRƯỜNG & ROBOT) ---

    startEnvironmentLoop() {
        // Cứ 2 phút (120000ms) đảo ngày/đêm một lần
        const CYCLE_TIME = 120000; 

        GameData.environmentInterval = setInterval(() => {
            GameData.isDaytime = !GameData.isDaytime;
            this.updateEnvironmentUI();
        }, CYCLE_TIME);

        this.updateEnvironmentUI();
    },

    updateEnvironmentUI() {
        const timeIcon = document.getElementById('env-time-icon');
        const timeText = document.getElementById('env-time-text');
        const tempText = document.getElementById('env-temp-text');
        
        
        
        

        const dimOverlay = document.getElementById('roomDimOverlay');
        
        if (GameData.isDaytime) {
            // BAN NGÀY
            if(timeIcon) { timeIcon.textContent = '☀️'; timeText.textContent = 'Ban ngày'; tempText.textContent = '32°C'; }
                        if(dimOverlay) dimOverlay.style.opacity = "0";

            // Nếu đang bật đèn tự động thì tắt đèn
            if (GameData.deviceStates.light) {
                this.toggleDevice('light', false);
            }

        } else {
            // BAN ĐÊM
            if(timeIcon) { timeIcon.textContent = '🌙'; timeText.textContent = 'Ban đêm'; tempText.textContent = '22°C'; }
                        if(dimOverlay) dimOverlay.style.opacity = "0.65";

            // Tự động bật đèn
            setTimeout(() => {
                    if (!GameData.deviceStates.light) {
                        this.toggleDevice('light', true);
                    }
                }, 5000); // 5 giây sau khi chuyển đêm thì bật đèn
        }
    },

    setupTrashDragAndDrop() {
        window.appHandleDragStart = (e, type) => {
            e.dataTransfer.setData('text/plain', type);
            e.dataTransfer.effectAllowed = 'copy';
        };

        const testRoomViewport = document.getElementById('room-viewport-container');
        if(!testRoomViewport) return;

        testRoomViewport.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            testRoomViewport.style.border = "2px dashed #10b981";
        });

        testRoomViewport.addEventListener('dragleave', (e) => {
            e.preventDefault();
            testRoomViewport.style.border = "none";
        });

        testRoomViewport.addEventListener('drop', (e) => {
            e.preventDefault();
            testRoomViewport.style.border = "none";
            
            const trashType = e.dataTransfer.getData('text/plain');
            if(!trashType) return;

            const rect = testRoomViewport.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 1000;
            const y = 350 + Math.random() * 70;

            this.spawnTrash(trashType, x, y);
        });
    },

    spawnTrash(type, x, y) {
        const id = 'trash_' + Date.now();
        GameData.trashItems.push({ id, type, x, y });
        this.renderTrash();
        
        this.checkAndRunRobotVacuum();
    },

    renderTrash() {
        const layer = document.getElementById('trash-layer');
        if(!layer) return;
        layer.innerHTML = '';
        
        const emojis = {
            'tissue': '🧻',
            'plastic_bag': '🛍️',
            'cup': '🥤',
            'bottle': '🧴'
        };

        GameData.trashItems.forEach(item => {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", item.x);
            text.setAttribute("y", item.y);
            text.setAttribute("font-size", "24");
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("id", item.id);
            text.textContent = emojis[item.type] || '🗑️';
            layer.appendChild(text);
        });
    },

    checkAndRunRobotVacuum() {
        if (GameData.robotCleaning || GameData.trashItems.length === 0) return;
        
        if (!GameData.deviceStates.vacuum) {
            this.toggleDevice('vacuum', true);
        }

        this.processNextTrashItem();
    },

    processNextTrashItem() {
        if (GameData.trashItems.length === 0) {
            setTimeout(() => {
                const robotEl = document.getElementById('device-vacuum');
                if(robotEl) {
                    robotEl.style.transition = "transform 3s ease-in-out";
                    robotEl.style.transform = "translate(0px, 0px)";
                }
                if (GameData.deviceStates.vacuum) {
                    this.toggleDevice('vacuum', false);
                }
                GameData.robotCleaning = false;
            }, 5000);
            return;
        }

        GameData.robotCleaning = true;
        const targetTrash = GameData.trashItems[0];
        GameData.robotTarget = targetTrash.id;

        const robotEl = document.getElementById('device-vacuum');
        if (!robotEl) return;

        const testRoomViewport = document.getElementById('room-viewport-container') || document.querySelector('.inner-room-container');
        const rect = testRoomViewport.getBoundingClientRect();
        const scaleX = rect.width / 1000;
        const scaleY = rect.height / 450;

        const dx = (targetTrash.x - 200) * scaleX;
        const dy = (targetTrash.y - 380) * scaleY;

        robotEl.style.transition = "transform 3s ease-in-out";
        robotEl.style.transform = `translate(${dx}px, ${dy}px)`;

        setTimeout(() => {
            GameData.trashItems.shift();
            this.renderTrash();
            this.processNextTrashItem();
        }, 3100);
    }
};


document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
