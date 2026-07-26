// 필라테스 / 물리치료 전문용어 사전
// 번역 전 한국어 문장에 영어 힌트를 삽입해 Google 번역의 정확도를 높이는 데 사용됩니다.
// term: 인식할 한국어 표현, hint: 번역기에 힌트로 줄 영어 전문용어
const DEFAULT_GLOSSARY = [
  // 해부학 / 코어
  { term: "코어", hint: "core" },
  { term: "골반저근", hint: "pelvic floor" },
  { term: "척추 중립", hint: "neutral spine" },
  { term: "골반 중립", hint: "neutral pelvis" },
  { term: "견갑골", hint: "scapula" },
  { term: "흉곽", hint: "rib cage" },
  { term: "횡격막", hint: "diaphragm" },
  { term: "복횡근", hint: "transverse abdominis" },
  { term: "다열근", hint: "multifidus" },
  { term: "고관절", hint: "hip joint" },
  { term: "천장관절", hint: "sacroiliac joint" },
  { term: "요추", hint: "lumbar spine" },
  { term: "흉추", hint: "thoracic spine" },
  { term: "경추", hint: "cervical spine" },
  { term: "근막", hint: "fascia" },

  // 움직임
  { term: "신전", hint: "extension" },
  { term: "굴곡", hint: "flexion" },
  { term: "회전", hint: "rotation" },
  { term: "측면 굴곡", hint: "lateral flexion" },
  { term: "외전", hint: "abduction" },
  { term: "내전", hint: "adduction" },
  { term: "배측굴곡", hint: "dorsiflexion" },
  { term: "저측굴곡", hint: "plantarflexion" },
  { term: "안정화", hint: "stabilization" },
  { term: "가동성", hint: "mobility" },
  { term: "유연성", hint: "flexibility" },
  { term: "정렬", hint: "alignment" },
  { term: "이완", hint: "relaxation" },
  { term: "수축", hint: "contraction" },
  { term: "늘리다", hint: "lengthen" },

  // 호흡
  { term: "흡기", hint: "inhale" },
  { term: "호기", hint: "exhale" },

  // 필라테스 기구
  { term: "리포머", hint: "reformer" },
  { term: "캐딜락", hint: "cadillac" },
  { term: "체어", hint: "wunda chair" },
  { term: "바렐", hint: "barrel" },
  { term: "스파인 코렉터", hint: "spine corrector" },
  { term: "매트", hint: "mat" },
  { term: "스트랩", hint: "straps" },
  { term: "스프링", hint: "springs" },
  { term: "풋바", hint: "footbar" },
  { term: "헤드레스트", hint: "headrest" },
  { term: "캐리지", hint: "carriage" },

  // 필라테스 동작명
  { term: "롤업", hint: "roll-up" },
  { term: "롤다운", hint: "roll-down" },
  { term: "헌드레드", hint: "the hundred" },
  { term: "티저", hint: "teaser" },
  { term: "스완", hint: "swan" },
  { term: "사이드 킥", hint: "side kick" },
  { term: "플랭크", hint: "plank" },
  { term: "브릿지", hint: "bridge" },
  { term: "임프린트", hint: "imprint" },
  { term: "파워하우스", hint: "powerhouse" },

  // 일반 PT / 컨디셔닝
  { term: "자세", hint: "posture" },
  { term: "균형", hint: "balance" },
  { term: "근력", hint: "muscle strength" },
  { term: "지구력", hint: "endurance" },
  { term: "협응", hint: "coordination" },
  { term: "대칭", hint: "symmetry" },
  { term: "비대칭", hint: "asymmetry" },
  { term: "통증", hint: "pain" },
  { term: "긴장", hint: "tension" },
  { term: "압박", hint: "compression" },
  { term: "견인", hint: "traction" },
  { term: "부상", hint: "injury" },
  { term: "재활", hint: "rehabilitation" },
  { term: "근육 불균형", hint: "muscle imbalance" },
  { term: "관절가동범위", hint: "range of motion" },
  { term: "고유수용성감각", hint: "proprioception" },
];

// 사용자 정의 용어(localStorage) + 기본 용어를 합쳐서 반환
function getGlossary() {
  const custom = JSON.parse(localStorage.getItem("customGlossary") || "[]");
  return [...custom, ...DEFAULT_GLOSSARY];
}

function addCustomTerm(term, hint) {
  const custom = JSON.parse(localStorage.getItem("customGlossary") || "[]");
  custom.unshift({ term, hint });
  localStorage.setItem("customGlossary", JSON.stringify(custom));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 텍스트에 필라테스/PT 용어 사전 항목이 몇 개나 포함되는지 셉니다
// (음성인식 후보 중 어떤 것이 더 그럴듯한지 고르는 데 사용)
function countGlossaryMatches(text) {
  const terms = getGlossary();
  let count = 0;
  for (const { term } of terms) {
    if (text.includes(term)) count++;
  }
  return count;
}

// 긴 용어부터 먼저 치환해서 부분 중복 매칭을 방지합니다 (예: "측면 굴곡" vs "굴곡")
function annotateWithGlossary(text) {
  const terms = getGlossary().slice().sort((a, b) => b.term.length - a.term.length);
  let result = text;
  for (const { term, hint } of terms) {
    if (result.includes(term)) {
      const re = new RegExp(escapeRegex(term), "g");
      result = result.replace(re, `${term}[${hint}]`);
    }
  }
  return result;
}
