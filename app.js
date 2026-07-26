const els = {
  micBtn: document.getElementById("micBtn"),
  status: document.getElementById("status"),
  sourceText: document.getElementById("sourceText"),
  translatedText: document.getElementById("translatedText"),
  targetLang: document.getElementById("targetLang"),
  targetLabel: document.getElementById("targetLabel"),
  ttsToggle: document.getElementById("ttsToggle"),
  historyList: document.getElementById("historyList"),
  clearHistory: document.getElementById("clearHistory"),
  manualText: document.getElementById("manualText"),
  manualSendBtn: document.getElementById("manualSendBtn"),
  sourceLabel: document.getElementById("sourceLabel"),
  swapBtn: document.getElementById("swapBtn"),
  directionText: document.getElementById("directionText"),

  settingsBtn: document.getElementById("settingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  emailInput: document.getElementById("emailInput"),
  glossaryToggle: document.getElementById("glossaryToggle"),
  newTermKo: document.getElementById("newTermKo"),
  newTermEn: document.getElementById("newTermEn"),
  addTermBtn: document.getElementById("addTermBtn"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
};

const LANG_NAMES = {
  en: "영어", ja: "일본어", "zh-CN": "중국어", vi: "베트남어",
  es: "스페인어", ru: "러시아어", th: "태국어", fr: "프랑스어", de: "독일어",
};

// 음성 인식 / 음성 출력에 쓰이는 지역 코드 (MyMemory 언어 코드와는 별개)
const LOCALE = {
  en: "en-US", ja: "ja-JP", "zh-CN": "zh-CN", vi: "vi-VN",
  es: "es-ES", ru: "ru-RU", th: "th-TH", fr: "fr-FR", de: "de-DE",
};

let state = {
  email: localStorage.getItem("mmEmail") || "",
  useGlossary: localStorage.getItem("useGlossary") !== "false",
  targetLang: localStorage.getItem("targetLang") || "en",
  ttsOn: localStorage.getItem("ttsOn") !== "false",
  reversed: localStorage.getItem("reversed") === "true",
};

els.targetLang.value = state.targetLang;
els.ttsToggle.checked = state.ttsOn;

function updateDirectionUI() {
  const foreignName = LANG_NAMES[state.targetLang] || state.targetLang;
  if (state.reversed) {
    els.directionText.textContent = `${foreignName}→한국어`;
    els.sourceLabel.textContent = `${foreignName} (인식됨)`;
    els.targetLabel.textContent = "번역 (한국어)";
    els.manualText.placeholder = "또는 외국어를 직접 입력해서 한국어로 번역";
  } else {
    els.directionText.textContent = `한국어→${foreignName}`;
    els.sourceLabel.textContent = "한국어 (인식됨)";
    els.targetLabel.textContent = `번역 (${foreignName})`;
    els.manualText.placeholder = "또는 직접 입력해서 번역 (음성인식 안 될 때)";
  }
}
updateDirectionUI();

// ---------- 음성 인식 (한국어 ↔ 외국어 STT, 방향에 따라 전환) ----------
const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;

function currentRecognitionLang() {
  return state.reversed ? (LOCALE[state.targetLang] || "en-US") : "ko-KR";
}

function setupRecognition() {
  if (!SpeechRecognitionImpl) {
    els.status.textContent = "이 브라우저는 음성 인식을 지원하지 않습니다 (iPhone Safari 등). 아래 입력창에 직접 타이핑해서 번역하세요.";
    els.micBtn.disabled = true;
    return null;
  }
  const r = new SpeechRecognitionImpl();
  r.lang = currentRecognitionLang();
  r.continuous = true;
  r.interimResults = true;

  r.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const transcript = res[0].transcript;
      if (res.isFinal) {
        els.sourceText.textContent = transcript;
        translateAndSpeak(transcript.trim());
      } else {
        interim += transcript;
      }
    }
    if (interim) els.sourceText.textContent = interim;
  };

  r.onerror = (e) => {
    els.status.textContent = `오류: ${e.error}`;
  };

  r.onend = () => {
    if (listening) {
      // 브라우저가 자동 종료시키는 경우가 있어 계속 듣기 위해 재시작
      r.start();
    }
  };

  return r;
}

els.micBtn.addEventListener("click", () => {
  if (!recognition) recognition = setupRecognition();
  if (!recognition) return;

  if (listening) {
    listening = false;
    recognition.stop();
    els.micBtn.classList.remove("listening");
    els.status.textContent = "대기 중";
    releaseWakeLock();
  } else {
    listening = true;
    recognition.start();
    els.micBtn.classList.add("listening");
    els.status.textContent = "듣는 중...";
    requestWakeLock();
  }
});

// ---------- 화면 꺼짐 방지 (수업 중 화면이 잠들지 않도록) ----------
let wakeLock = null;

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch (e) {
    // 지원하지 않거나 배터리 세이버 등으로 거부된 경우 조용히 무시
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

// 화면을 껐다 켜거나 앱을 전환했다가 돌아오면 wake lock이 풀리므로 재요청
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && listening) {
    requestWakeLock();
  }
});

// ---------- 번역 (MyMemory 무료 API, 키 불필요) ----------
// https://mymemory.translated.net/doc/spec.php
async function translateAndSpeak(sourceTextRaw) {
  if (!sourceTextRaw) return;

  const sourceLang = state.reversed ? state.targetLang : "ko";
  const outputLang = state.reversed ? "ko" : state.targetLang;

  // 용어 힌트 삽입은 한국어→외국어 방향에서만 안정적으로 동작합니다
  // (반대 방향은 테스트 결과 번역이 오히려 깨지는 경우가 있어 적용하지 않음)
  const textForApi = !state.reversed && state.useGlossary
    ? annotateWithGlossary(sourceTextRaw)
    : sourceTextRaw;

  try {
    els.status.textContent = "번역 중...";
    const params = new URLSearchParams({
      q: textForApi,
      langpair: `${sourceLang}|${outputLang}`,
    });
    if (state.email) params.set("de", state.email);

    const resp = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`);

    if (!resp.ok) {
      throw new Error(`API 오류 (${resp.status})`);
    }

    const data = await resp.json();
    if (data.responseStatus && Number(data.responseStatus) !== 200) {
      throw new Error(data.responseDetails || "번역 서비스 오류");
    }

    let translated = data.responseData.translatedText;
    translated = cleanupHintArtifacts(translated);

    els.translatedText.textContent = translated;
    addToHistory(sourceTextRaw, translated);
    els.status.textContent = listening ? "듣는 중..." : "대기 중";

    if (state.ttsOn) {
      const ttsLang = state.reversed ? "ko-KR" : (LOCALE[state.targetLang] || state.targetLang);
      speak(translated, ttsLang);
    }
  } catch (err) {
    console.error(err);
    els.status.textContent = "번역 실패 — 네트워크 또는 일일 사용량 한도를 확인하세요.";
  }
}

// 힌트로 삽입한 대괄호가 번역 결과에 그대로 남는 경우 정리
function cleanupHintArtifacts(text) {
  return text.replace(/\[[^\]]*\]/g, "").replace(/\s{2,}/g, " ").trim();
}

// ---------- 음성 출력 (TTS) ----------
function speak(text, langCode) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = langCode;
  window.speechSynthesis.speak(utter);
}

// ---------- 기록 ----------
function addToHistory(ko, translated) {
  const li = document.createElement("li");
  li.innerHTML = `<div class="h-tr">${escapeHtml(translated)}</div><div class="h-ko">${escapeHtml(ko)}</div>`;
  els.historyList.prepend(li);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

els.clearHistory.addEventListener("click", () => {
  els.historyList.innerHTML = "";
});

// ---------- 설정 ----------
function openSettings() {
  els.emailInput.value = state.email;
  els.glossaryToggle.checked = state.useGlossary;
  els.settingsModal.classList.remove("hidden");
}
function closeSettings() {
  els.settingsModal.classList.add("hidden");
}

els.settingsBtn.addEventListener("click", openSettings);
els.closeSettingsBtn.addEventListener("click", closeSettings);

els.saveSettingsBtn.addEventListener("click", () => {
  state.email = els.emailInput.value.trim();
  state.useGlossary = els.glossaryToggle.checked;
  localStorage.setItem("mmEmail", state.email);
  localStorage.setItem("useGlossary", String(state.useGlossary));
  closeSettings();
  els.status.textContent = "설정이 저장되었습니다.";
});

els.addTermBtn.addEventListener("click", () => {
  const ko = els.newTermKo.value.trim();
  const en = els.newTermEn.value.trim();
  if (!ko || !en) return;
  addCustomTerm(ko, en);
  els.newTermKo.value = "";
  els.newTermEn.value = "";
  els.status.textContent = `용어 추가됨: ${ko} → ${en}`;
});

function stopListeningIfActive() {
  if (listening) {
    listening = false;
    if (recognition) recognition.stop();
    els.micBtn.classList.remove("listening");
    els.status.textContent = "대기 중";
    releaseWakeLock();
  }
  recognition = null; // 언어가 바뀌었으므로 다음 시작 시 새로 생성
}

els.targetLang.addEventListener("change", () => {
  state.targetLang = els.targetLang.value;
  localStorage.setItem("targetLang", state.targetLang);
  updateDirectionUI();
  stopListeningIfActive();
});

els.swapBtn.addEventListener("click", () => {
  state.reversed = !state.reversed;
  localStorage.setItem("reversed", String(state.reversed));
  updateDirectionUI();
  stopListeningIfActive();
});

els.ttsToggle.addEventListener("change", () => {
  state.ttsOn = els.ttsToggle.checked;
  localStorage.setItem("ttsOn", String(state.ttsOn));
});

// ---------- 텍스트 직접 입력 (음성인식 미지원 기기용 대체 수단) ----------
function sendManualText() {
  const text = els.manualText.value.trim();
  if (!text) return;
  els.sourceText.textContent = text;
  translateAndSpeak(text);
  els.manualText.value = "";
}

els.manualSendBtn.addEventListener("click", sendManualText);
els.manualText.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendManualText();
});

// 음성 인식 미지원 브라우저(예: iPhone Safari)는 처음부터 안내 + 마이크 비활성화
if (!SpeechRecognitionImpl) {
  els.micBtn.disabled = true;
  els.status.textContent = "이 브라우저는 음성 인식을 지원하지 않습니다. 아래 입력창에 직접 타이핑해서 번역하세요.";
}

