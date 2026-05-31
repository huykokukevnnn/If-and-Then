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
        temp: 30,
        air: "Ngột ngạt",
        lock: "ĐANG KHÓA",
        speaker: "ĐANG TẮT"
    },

    commandsTestedCount: 0,
    commandsTestedSet: new Set(),
    requiredCommandsToUnlock: 3,

    // Giai đoạn 2: Bảng dữ liệu thẻ cột Trái & Phải (Scrambled & Mapped to 8 Devices)
    leftCards: [
        { id: "L1", text: "Bật quạt thổi mát", icon: "💨" },
        { id: "L2", text: "Hôm nay trời nóng quá", icon: "☀️" },
        { id: "L3", text: "Tối quá không thấy đường", icon: "🌙" },
        { id: "L4", text: "Hôm nay ăn gì nhỉ?", icon: "🍎" },
        { id: "L5", text: "Hãy mở cửa kính ban công", icon: "🚪" },
        { id: "L6", text: "Sàn nhà dơ quá đi", icon: "🧹" },
        { id: "L7", text: "Bật tivi xem tin tức", icon: "📺" },
        { id: "L8", text: "Bật loa phát nhạc giải trí", icon: "🎵" }
    ],

    rightCards: [
        { id: "R1", actionKey: "fan_on", text: "Cánh quạt quay thổi gió", desc: "Quạt đứng quay tít" },
        { id: "R2", actionKey: "ac_on", text: "Điều hòa thổi gió mát lạnh", desc: "Máy lạnh thổi sóng gió" },
        { id: "R3", actionKey: "light_on", text: "Bật đèn LED áp tường thắp sáng", desc: "Hai đèn LED áp tường thắp sáng" },
        { id: "R4", actionKey: "fridge_open", text: "Mở cửa tủ lạnh tìm đồ ăn", desc: "Cửa tủ lạnh 2 cánh mở lật phát sáng" },
        { id: "R5", actionKey: "glassdoor_open", text: "Cửa kính trượt mở ra ban công", desc: "Hai cánh kính trượt mở sang hai bên" },
        { id: "R6", actionKey: "vacuum_on", text: "Robot chạy trượt đi hút bụi", desc: "Robot hút bụi trượt đi dọn dẹp" },
        { id: "R7", actionKey: "tv_on", text: "Mở màn hình Tivi nhiễu sóng", desc: "Tivi hoạt động hiển thị nhiễu trắng đen" },
        { id: "R8", actionKey: "speaker_on", text: "Loa dạng trụ quẩy nhạc nốt bay", desc: "Cột LED loa sáng và nốt nhạc bay lên" }
    ],

    // Mối liên kết lập trình do học sinh nối (Left ID -> Right ID)
    connections: {} // Cấu trúc: { "L1": "R3", "L2": "R1", ... }
};

// --- 3. KHỞI TẠO VÀ BẮT ĐẦU APP ---
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

const App = {
    currentScreen: 'intro',
    activeDragDot: null,
    dragStartCoords: null,
    tempCable: null,

    init() {
        this.bindGlobalEvents();
        this.initPhase1();
        this.initPhase2();
        
        // Mặc định cập nhật giao diện Dashboard
        this.updateDashboardUI();
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
            this.updateConnectionLines(); // Vẽ lại dây nối phòng trường hợp kích thước thay đổi
        } else if (screenId === 'testing') {
            step1.classList.add('completed');
            step2.classList.add('completed');
            step2.classList.remove('active');
        }
    },

    bindGlobalEvents() {
        // Sự kiện gõ cửa vào nhà ở màn hình Intro
        document.getElementById('svg-front-door').addEventListener('click', () => {
            SoundManager.playChime();
            
            // Thêm hiệu ứng flash cửa
            const door = document.getElementById('svg-front-door');
            door.style.filter = "drop-shadow(0 0 30px #ffffff)";
            
            setTimeout(() => {
                door.style.filter = "";
                this.showScreen('phase1');
            }, 600);
        });

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

        // Bấm nút chuyển giai đoạn 2
        document.getElementById('btn-to-phase-2').addEventListener('click', () => {
            this.showScreen('phase2');
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

                recognition.onstart = () => {
                    micBtn.classList.add('recording');
                    input.placeholder = "LUNA đang luôn nghe giọng của bạn...";
                    SoundManager.playBeep(800, 0.12, 'sine');
                };

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
        if (this.matchKeywords(text, ["tắt quạt", "tat quat", "dừng quạt", "ngừng quạt"])) {
            actions.push({ devName: 'fan', state: false });
            explanation = "Đã tắt quạt đứng. Cánh quạt đã ngừng quay.";
            triggered = true;
        } else if (this.matchKeywords(text, ["bật quạt", "bat quat", "mở quạt", "mo quat", "quay quạt"])) {
            actions.push({ devName: 'fan', state: true });
            explanation = "Đã bật quạt đứng! Bạn sẽ thấy cánh quạt bắt đầu xoay tít mát mẻ.";
            triggered = true;
        }
        
        // 2. Thiết bị Đèn LED áp tường (light) - Tắt trước, Bật sau
        else if (this.matchKeywords(text, ["tắt đèn", "tat den"])) {
            actions.push({ devName: 'light', state: false });
            explanation = "Đã tắt đèn LED áp tường. Căn phòng trở lại bình thường.";
            triggered = true;
        } else if (this.matchKeywords(text, ["bật đèn", "bat den", "mở đèn", "mo den", "bật ánh sáng", "thắp sáng"])) {
            actions.push({ devName: 'light', state: true });
            explanation = "Đèn LED áp tường đã được bật! Hai chùm sáng cone thắp sáng hai bên tường phòng khách.";
            triggered = true;
        }

        // 3. Thiết bị Robot hút bụi (vacuum) - Tắt trước, Bật sau
        else if (this.matchKeywords(text, ["dừng hút", "dung hut", "tắt robot", "tat robot", "dừng robot", "tắt máy hút bụi", "tat may hut bui"])) {
            actions.push({ devName: 'vacuum', state: false });
            explanation = "Robot hút bụi đã tạm dừng công việc dọn dẹp.";
            triggered = true;
        } else if (this.matchKeywords(text, ["sàn nhà dơ", "san nha do", "sàn nhà bẩn", "san nha ban", "nhà bẩn", "nha ban", "nhà dơ", "nha do", "sàn dơ", "san do", "sàn bẩn", "san ban", "bụi", "bui", "rác", "rac"])) {
            actions.push({ devName: 'vacuum', state: true });
            explanation = "🚨 Phân tích AI: Ngữ cảnh 'Sàn dơ' -> Đã bật Robot hút bụi dọn dẹp sàn nhà dơ bẩn sạch sẽ!";
            triggered = true;
        } else if (this.matchKeywords(text, ["hút bụi", "hut bui", "quét nhà", "quet nha", "dọn dẹp", "don dep", "kích hoạt robot"])) {
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
        else if (this.matchKeywords(text, ["tắt tivi", "tat tivi", "tắt tv", "tat tv"])) {
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

        // Tự động cập nhật số liệu Dashboard theo hoạt động
        if (devName === 'ac' && targetState) {
            GameData.dashboardMetrics.temp = 24;
        } else if (devName === 'ac' && !targetState) {
            GameData.dashboardMetrics.temp = 30; // Trở về mặc định
        }

        if (devName === 'vacuum') {
            GameData.dashboardMetrics.air = targetState ? "Tuyệt vời (Sạch)" : "Ngột ngạt";
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
                    tvVideo.play().catch(e => console.log("Video auto-play blocked: ", e));
                } else {
                    tvVideo.pause();
                    tvVideo.currentTime = 0;
                }
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
        this.renderMatchingCards();

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

    renderMatchingCards() {
        const leftCol = document.getElementById('left-cards-column');
        const rightCol = document.getElementById('right-cards-column');
        
        leftCol.innerHTML = '';
        rightCol.innerHTML = '';

        // Thuật toán xáo trộn Fisher-Yates ngẫu nhiên khoa học
        const shuffle = (array) => {
            const arr = [...array];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        };

        // Xáo trộn độc lập 2 cột để tạo sự ngẫu nhiên tối đa đúng như yêu cầu
        const shuffledLeft = shuffle(GameData.leftCards);
        const shuffledRight = shuffle(GameData.rightCards);

        // Tạo thẻ bên trái (Speech Commands)
        shuffledLeft.forEach(card => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'matching-card';
            cardDiv.id = `card-${card.id}`;
            cardDiv.setAttribute('data-side', 'left');
            cardDiv.setAttribute('data-id', card.id);
            
            cardDiv.innerHTML = `
                <div class="card-content-desc">
                    <span style="font-size: 1.15rem; margin-right: 6px;">${card.icon}</span>
                    <span>"${card.text}"</span>
                </div>
                <div class="connector-dot" id="dot-${card.id}" data-id="${card.id}" data-side="left"></div>
            `;
            leftCol.appendChild(cardDiv);
        });

        // Tạo thẻ bên phải (Device Actions)
        shuffledRight.forEach(card => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'matching-card';
            cardDiv.id = `card-${card.id}`;
            cardDiv.setAttribute('data-side', 'right');
            cardDiv.setAttribute('data-id', card.id);
            cardDiv.setAttribute('data-key', card.actionKey);
            
            cardDiv.innerHTML = `
                <div class="card-content-desc">
                    <div style="font-size:0.9rem; font-weight:700;">${card.text}</div>
                    <div style="font-size:0.75rem; color:rgba(15,23,42,0.45); margin-top:2px;">${card.desc}</div>
                </div>
                <div class="connector-dot" id="dot-${card.id}" data-id="${card.id}" data-side="right"></div>
            `;
            rightCol.appendChild(cardDiv);
        });
    },

    // Quản lý kéo thả mượt mà trên PC (Mouse) và Tablet (Touch)
    setupDragAndDropLogic() {
        const container = document.getElementById('matching-drag-container');
        const svg = document.getElementById('connections-svg');

        // Lắng nghe sự kiện bắt đầu ấn nút hoặc chạm ngón tay vào chốt Trái
        container.addEventListener('mousedown', (e) => this.handleDragStart(e, false));
        container.addEventListener('touchstart', (e) => this.handleDragStart(e, true), { passive: false });

        // Lắng nghe di chuyển kéo dây
        window.addEventListener('mousemove', (e) => this.handleDragMove(e, false));
        window.addEventListener('touchmove', (e) => this.handleDragMove(e, true), { passive: false });

        // Lắng nghe thả tay ra kết thúc kéo
        window.addEventListener('mouseup', (e) => this.handleDragEnd(e, false));
        window.addEventListener('touchend', (e) => this.handleDragEnd(e, true));
    },

    handleDragStart(e, isTouch) {
        const target = e.target;
        // Chỉ cho phép bắt đầu kéo từ Chốt Tròn thuộc cột TRÁI
        if (!target.classList.contains('connector-dot') || target.getAttribute('data-side') !== 'left') {
            return;
        }

        if (isTouch) e.preventDefault(); // Ngăn cuộn trang trên tablet khi đang kéo dây

        const dotId = target.getAttribute('data-id');
        
        // Nếu chốt trái này đã có dây nối trước đó, hãy xóa dây cũ đó đi
        if (GameData.connections[dotId]) {
            delete GameData.connections[dotId];
            this.playActionSound('click');
            this.updateConnectionLines();
        }

        const coords = this.getDotCenter(target);

        this.activeDragDot = target;
        this.dragStartCoords = coords;

        // Phát tiếng beep nhẹ khi bắt đầu kéo
        SoundManager.playBeep(650, 0.05, 'sine');

        // Tạo sợi dây mờ vẽ nháp ban đầu
        this.createTempCable(coords.x, coords.y);
    },

    handleDragMove(e, isTouch) {
        if (!this.activeDragDot) return;
        if (isTouch) e.preventDefault(); // Ngăn cuộn màn hình khi đang vẽ dây

        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
        const clientY = isTouch ? e.touches[0].clientY : e.clientY;
        
        const container = document.getElementById('matching-drag-container');
        const containerRect = container.getBoundingClientRect();
        
        const currX = clientX - containerRect.left;
        const currY = clientY - containerRect.top;

        // Vẽ cập nhật uốn lượn Bezier cho dây kéo nháp
        this.updateTempCable(this.dragStartCoords.x, this.dragStartCoords.y, currX, currY);

        // Hiệu ứng "hút dính nam châm (snapping)" nếu rê chuột đến gần chốt phải
        const dotsRight = document.querySelectorAll('.matching-column.right .connector-dot');
        dotsRight.forEach(dot => {
            const dotCoords = this.getDotCenter(dot);
            const dist = Math.hypot(currX - dotCoords.x, currY - dotCoords.y);
            
            if (dist < 35) { // Snapping range 35px
                dot.style.transform = 'scale(1.4)';
                dot.style.backgroundColor = '#ffffff';
            } else {
                dot.style.transform = '';
                dot.style.backgroundColor = '';
            }
        });
    },

    handleDragEnd(e, isTouch) {
        if (!this.activeDragDot) return;

        // Tháo dây nháp
        if (this.tempCable) {
            this.tempCable.remove();
            this.tempCable = null;
        }

        // Tìm chốt bên phải gần nhất để nối
        const leftDotId = this.activeDragDot.getAttribute('data-id');
        let clientX, clientY;

        if (isTouch) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const container = document.getElementById('matching-drag-container');
        const containerRect = container.getBoundingClientRect();
        const endX = clientX - containerRect.left;
        const endY = clientY - containerRect.top;

        // Quét tìm chốt phải snap gần nhất
        const dotsRight = document.querySelectorAll('.matching-column.right .connector-dot');
        let targetRightDot = null;
        let minDistance = 35; // Khoảng cách snap nam châm

        dotsRight.forEach(dot => {
            const dotCoords = this.getDotCenter(dot);
            const dist = Math.hypot(endX - dotCoords.x, endY - dotCoords.y);
            
            // Hoàn trả thiết kế của dot
            dot.style.transform = '';
            dot.style.backgroundColor = '';

            if (dist < minDistance) {
                targetRightDot = dot;
                minDistance = dist;
            }
        });

        if (targetRightDot) {
            const rightDotId = targetRightDot.getAttribute('data-id');
            
            // Ghi nhận liên kết thành công (đảm bảo 1-1, tháo liên kết cũ nếu có)
            for (let leftKey in GameData.connections) {
                if (GameData.connections[leftKey] === rightDotId) {
                    delete GameData.connections[leftKey];
                }
            }

            GameData.connections[leftDotId] = rightDotId;
            SoundManager.playChime();
        } else {
            // Thả hụt, tháo dây không lưu
            SoundManager.playBeep(350, 0.1, 'sine');
        }

        this.activeDragDot = null;
        this.dragStartCoords = null;

        // Vẽ lại toàn bộ dây cáp đã lưu
        this.updateConnectionLines();
    },

    getDotCenter(dotElement) {
        const container = document.getElementById('matching-drag-container');
        const containerRect = container.getBoundingClientRect();
        const dotRect = dotElement.getBoundingClientRect();
        
        return {
            x: (dotRect.left + dotRect.width / 2) - containerRect.left,
            y: (dotRect.top + dotRect.height / 2) - containerRect.top
        };
    },

    createTempCable(x1, y1) {
        const svg = document.getElementById('connections-svg');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'neon-cable temp');
        path.setAttribute('d', `M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x1 + 60} ${y1}, ${x1} ${y1}`);
        svg.appendChild(path);
        this.tempCable = path;
    },

    updateTempCable(x1, y1, x2, y2) {
        if (!this.tempCable) return;
        const controlOffset = Math.max(80, Math.abs(x2 - x1) * 0.5);
        const d = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
        this.tempCable.setAttribute('d', d);
    },

    updateConnectionLines() {
        const svg = document.getElementById('connections-svg');
        // Xóa sạch các đường dẫn cũ
        svg.innerHTML = '';

        // Gỡ các class active connected cũ của thẻ
        document.querySelectorAll('.matching-card').forEach(card => {
            card.classList.remove('connected-left', 'connected-right');
        });
        document.querySelectorAll('.connector-dot').forEach(dot => {
            dot.classList.remove('connected');
        });

        let activeCount = 0;

        // Duyệt vẽ từng liên kết được lưu trữ
        for (let leftId in GameData.connections) {
            const rightId = GameData.connections[leftId];
            
            const dotLeft = document.getElementById(`dot-${leftId}`);
            const dotRight = document.getElementById(`dot-${rightId}`);
            
            if (dotLeft && dotRight) {
                activeCount++;
                
                // Đánh dấu thiết kế thẻ đã được nối dây
                document.getElementById(`card-${leftId}`).classList.add('connected-left');
                document.getElementById(`card-${rightId}`).classList.add('connected-right');
                
                dotLeft.classList.add('connected');
                dotRight.classList.add('connected');

                // Lấy tọa độ hai tâm chốt tròn
                const start = this.getDotCenter(dotLeft);
                const end = this.getDotCenter(dotRight);

                // Đường vẽ neon
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('class', 'neon-cable');
                
                // Uốn cong sợi dây sang trọng
                const controlOffset = Math.max(100, Math.abs(end.x - start.x) * 0.6);
                const d = `M ${start.x} ${start.y} C ${start.x + controlOffset} ${start.y}, ${end.x - controlOffset} ${end.y}, ${end.x} ${end.y}`;
                
                path.setAttribute('d', d);
                
                // Phối màu sắc gradient sặc sỡ cho mỗi sợi dây nối khác nhau
                const colors = ['var(--neon-cyan)', 'var(--neon-purple)', 'var(--neon-pink)', 'var(--neon-green)', 'var(--neon-orange)', 'var(--neon-yellow)'];
                const strokeColor = colors[(activeCount - 1) % colors.length];
                path.setAttribute('stroke', strokeColor);
                path.style.filter = `drop-shadow(0 0 5px ${strokeColor})`;

                svg.appendChild(path);
            }
        }

        // Cập nhật số liên kết lên badge
        const badgeCount = document.getElementById('connections-count');
        badgeCount.textContent = activeCount;

        const btnSubmit = document.getElementById('btn-submit-programming');
        if (activeCount === 8) {
            btnSubmit.style.opacity = '1';
            btnSubmit.style.pointerEvents = 'auto';
            btnSubmit.classList.add('pulse-lock');
            btnSubmit.innerHTML = `Hoàn thành Lập trình & Đi Test thử AI 🚀`;
        } else {
            btnSubmit.style.opacity = '0.5';
            btnSubmit.style.pointerEvents = 'none';
            btnSubmit.classList.remove('pulse-lock');
            btnSubmit.innerHTML = `Hãy nối đủ 8 dây để tiến hành`;
        }
    },

    clearAllConnections() {
        GameData.connections = {};
        this.updateConnectionLines();
    },

    // --- GIAI ĐOẠN 2 - THỬ NGHIỆM AI TỰ HUẤN LUYỆN (TESTING) ---
    switchToTestingPhase() {
        // Chuyển hình vẽ SVG phòng bên trong (từ container Giai đoạn 1) sang container Giai đoạn Test
        this.migrateRoomSVG('inner-room-container-test');

        // Reset lại toàn bộ thiết bị đang chạy về OFF để bắt đầu test thuần khiết
        for (let dev in GameData.deviceStates) {
            this.toggleDevice(dev, false);
        }

        // Tạo danh sách 6 nút bấm lệnh nhanh cho học sinh test tại cột bên phải
        this.renderTestCommandsGrid();

        // Tạo bảng mô tả quy tắc lập trình tùy biến
        this.renderCustomRulesTable();

        // Hiển thị màn hình test
        this.showScreen('testing');
    },

    migrateRoomSVG(targetContainerId) {
        const svg = document.querySelector('.inner-room-svg');
        const targetContainer = document.getElementById(targetContainerId);
        
        if (svg && targetContainer) {
            targetContainer.appendChild(svg);
        }
    },

    renderTestCommandsGrid() {
        const container = document.getElementById('test-quick-commands-container');
        container.innerHTML = '';

        // Hiển thị các nút nói nhanh từ các câu lập trình kéo dây
        GameData.leftCards.forEach(card => {
            const btn = document.createElement('button');
            btn.className = 'btn-quick-test';
            btn.id = `btn-test-${card.id}`;
            btn.innerHTML = `
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                Nói: "${card.text}"
            `;
            
            btn.addEventListener('click', () => {
                this.executeCustomAICommand(card.id, card.text);
            });
            container.appendChild(btn);
        });

        // Bổ sung thêm 2 nút nói tắt độc lập để cưỡng chế reset Tivi và Tủ lạnh về ban đầu
        const extraCommands = [
            { id: "tv_off", text: "Tắt tivi", devName: "tv" },
            { id: "fridge_close", text: "Đóng tủ lạnh", devName: "fridge" }
        ];

        extraCommands.forEach(cmd => {
            const btn = document.createElement('button');
            btn.className = 'btn-quick-test';
            btn.id = `btn-test-${cmd.id}`;
            btn.innerHTML = `
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                Nói: "${cmd.text}"
            `;
            
            btn.addEventListener('click', () => {
                // Hệ thống cưỡng chế reset thiết bị về trạng thái Tắt ban đầu
                SoundManager.playSuccess();
                this.toggleDevice(cmd.devName, false);
                
                const reply = cmd.devName === 'tv'
                    ? `🤖 Trợ Lý LUNA: Nhận tín hiệu câu nói "${cmd.text}". Đã tắt tivi treo tường. Đèn LED chỉ thị đã chuyển sang màu đỏ tắt nguồn.`
                    : `🤖 Trợ Lý LUNA: Nhận tín hiệu câu nói "${cmd.text}". Đã đóng khít tủ lạnh để tiết kiệm điện năng cho bạn.`;
                
                document.getElementById('luna-speech-text').innerText = reply;
            });
            container.appendChild(btn);
        });

        // Cập nhật trạng thái kích hoạt của các nút kiểm thử ngay lập tức
        this.updateTestButtonsActiveState();
    },

    getDeviceFromActionKey(actionKey) {
        switch (actionKey) {
            case 'fan_on': return 'fan';
            case 'ac_on': return 'ac';
            case 'light_on': return 'light';
            case 'fridge_open': return 'fridge';
            case 'glassdoor_open': return 'glassdoor';
            case 'vacuum_on': return 'vacuum';
            case 'tv_on': return 'tv';
            case 'speaker_on': return 'speaker';
            default: return '';
        }
    },

    updateTestButtonsActiveState() {
        GameData.leftCards.forEach(card => {
            const btn = document.getElementById(`btn-test-${card.id}`);
            if (!btn) return;

            const rightId = GameData.connections[card.id];
            const rightCard = GameData.rightCards.find(c => c.id === rightId);
            if (rightCard) {
                const devName = this.getDeviceFromActionKey(rightCard.actionKey);
                const isDeviceOn = GameData.deviceStates[devName];
                if (isDeviceOn) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            } else {
                btn.classList.remove('active');
            }
        });
    },

    renderCustomRulesTable() {
        const tbody = document.getElementById('custom-rules-table-body');
        tbody.innerHTML = '';

        for (let leftId in GameData.connections) {
            const rightId = GameData.connections[leftId];
            
            const leftCard = GameData.leftCards.find(c => c.id === leftId);
            const rightCard = GameData.rightCards.find(c => c.id === rightId);

            if (leftCard && rightCard) {
                const row = document.createElement('div');
                row.className = 'rule-item-row';
                row.innerHTML = `
                    <span class="rule-item-speech">"${leftCard.text}"</span>
                    <span class="rule-item-arrow-icon">&gt;&gt;</span>
                    <span class="rule-item-action">${rightCard.text}</span>
                `;
                tbody.appendChild(row);
            }
        }
    },

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
        this.migrateRoomSVG('inner-room-container');

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
        
        const rvc = document.getElementById('room-viewport-container');
        if (rvc) rvc.className = 'room-viewport';
        
        const trvc = document.getElementById('test-room-viewport-container');
        if (trvc) trvc.className = 'room-viewport';
        
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
        this.showScreen('intro');
    },

    playActionSound(action) {
        if (action === 'click') {
            SoundManager.playBeep(600, 0.08, 'sine');
        }
    }
};
