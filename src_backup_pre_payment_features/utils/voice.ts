/**
 * Web Speech API를 활용한 PWA 한국어/영어 음성 합성(TTS) 유틸리티
 */
export const playVoiceGuidance = (text: string, _lang: 'ko' | 'en' = 'ko') => {
  // 1. 안내방송은 태블릿(Kiosk) 모드에서만 재생 가능하게 필터링
  const hash = window.location.hash.toLowerCase();
  const isKioskMode = hash.includes('kiosk') || hash === '#kiosk';
  if (!isKioskMode) {
    return;
  }

  // 2. 한국어 모드에서도 항상 영어로 재생하도록 설정 및 한영 매핑
  const englishTranslations: Record<string, string> = {
    "데이터베이스 초기화가 완료되었습니다.": "Database initialization complete.",
    "비밀번호가 확인되었습니다. 매장 설정 모드가 활성화되었습니다.": "Password confirmed. Settings mode activated.",
    "비밀번호가 일치하지 않습니다.": "Incorrect password.",
    "매장 권한이 잠금 상태로 전환되었습니다.": "Store permissions locked.",
    "비밀번호 변경이 완료되었습니다.": "Password changed successfully.",
    "보안 영역 인증이 완료되었습니다.": "Security zone unlocked.",
    "비밀번호가 올바르지 않습니다.": "Incorrect password.",
    "보안 영역이 잠금 상태로 전환되었습니다.": "Security zone locked.",
    "인증번호가 발송되었습니다.": "Verification code sent.",
    "인증번호가 틀렸습니다.": "Incorrect verification code.",
    "요청하신 기부 단체 기부가 승인되었습니다.": "Requested charity donation has been approved.",
    "요청하신 스탬프 캐시 사용이 승인되었습니다.": "Requested stamp cash usage has been approved.",
    "요청하신 기부 단체 기부가 거절되었습니다.": "Requested charity donation has been rejected.",
    "요청하신 스탬프 캐시 사용이 거절되었습니다.": "Requested stamp cash usage has been rejected."
  };

  let textToPlay = text;
  if (englishTranslations[text]) {
    textToPlay = englishTranslations[text];
  } else {
    // 부분 매칭 체크
    for (const [kr, en] of Object.entries(englishTranslations)) {
      if (text.includes(kr)) {
        textToPlay = text.replace(kr, en);
        break;
      }
    }
  }

  if ('speechSynthesis' in window) {
    try {
      // 진행 중인 모든 음성 합성 중단
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(textToPlay);
      utterance.lang = 'en-US'; // 항상 영어로 재생
      utterance.rate = 1.0;     // 영어 표준 속도
      utterance.pitch = 1.0;    // 톤 표준 설정
      utterance.volume = 1.0;   // 볼륨 최대

      // 크롬 및 모바일 브라우저 대응을 위해 영어 목소리 명시적 매칭 시도
      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = voices.find(v => 
        v.lang.toLowerCase().includes('en') || v.lang.toLowerCase().includes('us')
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn('음성 안내 재생 실패:', error);
    }
  } else {
    console.warn('SpeechSynthesis가 이 브라우저에서 지원되지 않습니다.');
  }
};
