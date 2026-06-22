/**
 * Web Speech API를 활용한 PWA 음성 안내 유틸리티.
 */
export const playVoiceGuidance = (text: string, lang: 'ko' | 'en' = 'ko') => {
  const hash = window.location.hash.toLowerCase();
  const isKioskMode = hash.includes('kiosk') || hash === '#kiosk';
  if (!isKioskMode) {
    return;
  }

  const koreanToEnglish: Record<string, string> = {
    '데이터베이스 초기화가 완료되었습니다.': 'Database initialization complete.',
    '비밀번호가 확인되었습니다. 매장 설정 모드가 활성화되었습니다.': 'Password confirmed. Settings mode activated.',
    '비밀번호가 일치하지 않습니다.': 'Incorrect password.',
    '비밀번호가 올바르지 않습니다.': 'Incorrect password.',
    '매장 권한이 잠금 상태로 전환되었습니다.': 'Store permissions locked.',
    '비밀번호 변경이 완료되었습니다.': 'Password changed successfully.',
    '보안 영역 인증이 완료되었습니다.': 'Security zone unlocked.',
    '보안 영역이 잠금 상태로 전환되었습니다.': 'Security zone locked.',
    '인증번호가 발송되었습니다.': 'Verification code sent.',
    '인증번호가 틀렸습니다.': 'Incorrect verification code.',
    '요청하신 기부 단체 기부가 승인되었습니다.': 'Requested charity donation has been approved.',
    '요청하신 스탬프 캐시 사용이 승인되었습니다.': 'Requested stamp cash usage has been approved.',
    '요청하신 기부 단체 기부가 거절되었습니다.': 'Requested charity donation has been rejected.',
    '요청하신 스탬프 캐시 사용이 거절되었습니다.': 'Requested stamp cash usage has been rejected.'
  };

  const englishToKorean = Object.fromEntries(
    Object.entries(koreanToEnglish).map(([ko, en]) => [en, ko])
  );

  const replaceKnownPhrases = (source: string, dictionary: Record<string, string>) => {
    if (dictionary[source]) return dictionary[source];

    let result = source;
    for (const [from, to] of Object.entries(dictionary)) {
      if (result.includes(from)) {
        result = result.replace(from, to);
      }
    }
    return result;
  };

  const hasHangul = /[가-힣]/.test(text);
  const textToPlay =
    lang === 'en'
      ? replaceKnownPhrases(text, koreanToEnglish)
      : replaceKnownPhrases(text, englishToKorean);
  const voiceLang = /[가-힣]/.test(textToPlay) || (lang === 'ko' && hasHangul) ? 'ko-KR' : 'en-US';

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(textToPlay);
      utterance.lang = voiceLang;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith(voiceLang.toLowerCase().slice(0, 2)));
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
