
const timer = document.getElementById("timer");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const phase = document.getElementById("phase");

const workMin = document.getElementById("workMin");
const workSec = document.getElementById("workSec");
const restMin = document.getElementById("restMin");
const restSec = document.getElementById("restSec");

const inputs = [workMin, workSec, restMin, restSec];

let workTime = 300;
let restTime = 30;

let remainingTime = workTime * 1000;
let isTraining = true;
let intervalId = null;
let hasStarted = false;

// 新增：結束時間與零秒顯示期限
let endTime = 0;
let zeroUntil = 0;


let audioContext = null;

let wakeLock = null;

// 保持螢幕常亮
async function requestWakeLock() {
    if (!("wakeLock" in navigator)) return;
    if (wakeLock && !wakeLock.released) return;

    try {
        wakeLock = await navigator.wakeLock.request("screen");

        if (intervalId === null) {
            await releaseWakeLock();
        }
    } catch (error) {
        console.log("無法保持螢幕常亮", error);
    }
}

// 解除螢幕常亮
async function releaseWakeLock() {
    if (wakeLock !== null) {
        const lock = wakeLock;
        wakeLock = null;
        await lock.release();
    }
}

// 回到網頁時重新取得螢幕常亮權限
document.addEventListener("visibilitychange", function () {
    if (
        document.visibilityState === "visible" &&
        intervalId !== null
    ) {
        requestWakeLock();
    }
});


// 初始化音訊
function initAudio() {
    if (audioContext === null) {
        audioContext = new (
            window.AudioContext || window.webkitAudioContext
        )();
    }

    if (audioContext.state === "suspended") {
        audioContext.resume().catch(console.error);
    }
}

// 產生蜂鳴聲
function beep(frequency, duration, delay = 0) {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "square";
    oscillator.frequency.value = frequency;

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    const start = audioContext.currentTime + delay;
    const end = start + duration;

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.5, start + 0.01);
    gain.gain.setValueAtTime(0.5, end - 0.02);
    gain.gain.linearRampToValueAtTime(0, end);

    oscillator.start(start);
    oscillator.stop(end);
}

// 訓練開始音效
function playStartSound() {
    beep(1000, 0.8);
}

// 訓練結束音效
function playEndSound() {
    beep(1400, 0.2, 0);
    beep(1400, 0.2, 0.3);
    beep(1400, 0.2, 0.6);
}


// 讀取使用者設定
function readSettings() {
    if (inputs.some(input =>
        !input.checkValidity() ||
        !Number.isInteger(Number(input.value))
    )) {
        return false;
    }

    const work = Number(workMin.value) * 60
               + Number(workSec.value);

    const rest = Number(restMin.value) * 60
               + Number(restSec.value);

    if (work <= 0 || rest <= 0) {
        return false;
    }

    workTime = work;
    restTime = rest;

    return true;
}

// 鎖定或解鎖設定
function lockSettings(locked) {
    inputs.forEach(input => {
        input.disabled = locked;
    });
}

// 更新畫面
function updateDisplay() {
    const totalSeconds = Math.ceil(remainingTime / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    timer.textContent =
        String(minutes).padStart(2, "0") + ":" +
        String(seconds).padStart(2, "0");

    phase.textContent = isTraining ? "訓練時間" : "休息時間";
    document.body.classList.toggle("rest", !isTraining);
}

// 切換階段

function switchPhase() {
    isTraining = !isTraining;

    const duration = isTraining ? workTime : restTime;

    endTime += duration * 1000;
}


// 計算剩餘時間
function tick() {
    const now = performance.now();

    // 階段結束時切換

    let switched = false;

    while (now >= endTime) {
        zeroUntil = endTime + 200;
        switchPhase();
        switched = true;
    }

    if (switched) {
        if (isTraining) {
            playStartSound();
        } else {
            playEndSound();
        }
    }


    remainingTime = Math.max(0, endTime - now);

    // 短暫顯示 00:00
    if (now < zeroUntil) {
        timer.textContent = "00:00";
        return;
    }

    updateDisplay();
}

// 開始計時

function startTimer() {
    if (!hasStarted) {
        if (!readSettings()) {
            alert("請輸入有效且大於零的訓練與休息時間");
            return;
        }

        initAudio();

        remainingTime = workTime * 1000;
        hasStarted = true;
        lockSettings(true);

        playStartSound();
    } else {
        initAudio();
    }

    endTime = performance.now() + remainingTime;
    zeroUntil = 0;

    intervalId = setInterval(tick, 20);
    requestWakeLock();

    startBtn.textContent = "暫停";
    tick();
}


// 暫停計時
function pauseTimer() {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
        tick();
    }

    zeroUntil = 0;
    startBtn.textContent = "繼續";
    updateDisplay();
    releaseWakeLock();
}

// 開始、暫停、繼續
startBtn.addEventListener("click", function () {
    if (intervalId === null) {
        startTimer();
    } else {
        pauseTimer();
    }
});

// 重設計時器
resetBtn.addEventListener("click", function () {
    pauseTimer();

    hasStarted = false;
    isTraining = true;
    remainingTime = workTime * 1000;
    zeroUntil = 0;

    lockSettings(false);

    startBtn.textContent = "開始";
    updateDisplay();
});

// 修改設定時同步更新畫面

inputs.forEach(input => {
    input.addEventListener("input", function () {
        if (!hasStarted && readSettings()) {
            remainingTime = workTime * 1000;
            updateDisplay();
        }
    });

    // 離開輸入框時，自動補上 0
    input.addEventListener("blur", function () {
        if (input.value === "") {
            input.value = "0";
        }
    });
});


updateDisplay();
