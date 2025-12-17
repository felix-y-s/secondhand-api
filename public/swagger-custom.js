/**
 * Swagger UI JWT 자동 갱신 스크립트
 *
 * 기능:
 * 1. Access Token 만료 1분 전 자동 갱신
 * 2. Refresh Token으로 새 Access Token 발급
 * 3. Swagger UI에 자동으로 새 토큰 적용
 * 4. 토큰 상태를 UI에 표시
 */

(function () {
  'use strict';

  let refreshTimer = null;
  let tokenExpiryTime = null;

  /**
   * JWT 토큰 디코딩 (페이로드 추출)
   */
  function decodeJWT(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('JWT 디코딩 실패:', error);
      return null;
    }
  }

  /**
   * 토큰 만료 시간 계산
   */
  function getTokenExpiry(token) {
    const payload = decodeJWT(token);
    if (!payload || !payload.exp) {
      return null;
    }
    return payload.exp * 1000; // 밀리초로 변환
  }

  /**
   * Refresh Token으로 새 Access Token 발급
   */
  async function refreshAccessToken(refreshToken) {
    try {
      const response = await fetch('/api/v1/users/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${refreshToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('토큰 갱신 실패');
      }

      const data = await response.json();
      return data.data.accessToken;
    } catch (error) {
      console.error('토큰 갱신 중 오류:', error);
      showNotification('토큰 갱신 실패. 다시 로그인해주세요.', 'error');
      return null;
    }
  }

  /**
   * Swagger UI에 새 Access Token 적용
   */
  function updateSwaggerAuth(accessToken) {
    // Swagger UI의 인증 정보 업데이트
    const ui = window.ui;
    if (!ui) {
      console.error('Swagger UI를 찾을 수 없습니다.');
      return;
    }

    // Access Token 업데이트
    ui.preauthorizeApiKey('access-token', accessToken);

    // localStorage에도 저장 (persistAuthorization 활용)
    const authData = JSON.parse(localStorage.getItem('authorized') || '{}');
    authData['access-token'] = {
      name: 'access-token',
      schema: { type: 'http', in: 'header' },
      value: accessToken,
    };
    localStorage.setItem('authorized', JSON.stringify(authData));

    showNotification('Access Token이 자동으로 갱신되었습니다.', 'success');
  }

  /**
   * 알림 표시
   */
  function showNotification(message, type = 'info') {
    // Swagger UI 상단에 알림 표시
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      background-color: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      border-radius: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      z-index: 9999;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // 3초 후 알림 제거
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * 토큰 상태 표시 UI 추가
   */
  function addTokenStatusUI() {
    const statusBar = document.createElement('div');
    statusBar.id = 'token-status-bar';
    statusBar.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 15px;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      border-radius: 4px;
      font-size: 12px;
      z-index: 9998;
      display: none;
    `;
    document.body.appendChild(statusBar);
  }

  /**
   * 토큰 상태 업데이트
   */
  function updateTokenStatus(expiryTime) {
    const statusBar = document.getElementById('token-status-bar');
    if (!statusBar || !expiryTime) return;

    const now = Date.now();
    const remaining = expiryTime - now;

    if (remaining > 0) {
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      statusBar.textContent = `토큰 만료까지: ${minutes}분 ${seconds}초`;
      statusBar.style.display = 'block';
    } else {
      statusBar.textContent = '토큰 만료됨';
      statusBar.style.backgroundColor = '#f44336';
    }
  }

  /**
   * 자동 갱신 타이머 설정
   */
  function setupAutoRefresh(accessToken, refreshToken) {
    // 기존 타이머 제거
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }

    // 기존 상태 업데이트 인터벌 제거
    if (window.tokenStatusInterval) {
      clearInterval(window.tokenStatusInterval);
    }

    // 토큰 만료 시간 계산
    tokenExpiryTime = getTokenExpiry(accessToken);
    if (!tokenExpiryTime) {
      console.error('토큰 만료 시간을 가져올 수 없습니다.');
      showNotification('토큰 만료 시간을 확인할 수 없습니다.', 'error');
      return;
    }

    const expiryDate = new Date(tokenExpiryTime);
    const now = new Date();
    const remainingMinutes = Math.floor((tokenExpiryTime - now.getTime()) / 60000);

    console.log('토큰 자동 갱신 활성화:', {
      만료시간: expiryDate.toLocaleString('ko-KR'),
      남은시간: `${remainingMinutes}분`,
      현재시간: now.toLocaleString('ko-KR'),
    });

    // 1초마다 토큰 상태 업데이트 (전역 변수로 저장하여 나중에 정리 가능)
    window.tokenStatusInterval = setInterval(() => {
      updateTokenStatus(tokenExpiryTime);
    }, 1000);

    // 즉시 한 번 업데이트
    updateTokenStatus(tokenExpiryTime);

    // 만료 1분 전에 갱신 (Access Token 유효기간이 15분이므로 14분 후 갱신)
    const refreshTime = tokenExpiryTime - Date.now() - 60000; // 1분 전

    console.log('자동 갱신 예정 시간:', {
      갱신까지_남은_밀리초: refreshTime,
      갱신까지_남은_분: Math.floor(refreshTime / 60000),
      갱신_예정_시간: new Date(Date.now() + refreshTime).toLocaleString('ko-KR'),
    });

    if (refreshTime > 0) {
      refreshTimer = setTimeout(async () => {
        console.log('Access Token 자동 갱신 시작...');
        const newAccessToken = await refreshAccessToken(refreshToken);

        if (newAccessToken) {
          updateSwaggerAuth(newAccessToken);
          // 새 토큰으로 다시 타이머 설정
          setupAutoRefresh(newAccessToken, refreshToken);
        } else {
          if (window.tokenStatusInterval) {
            clearInterval(window.tokenStatusInterval);
          }
          showNotification('토큰 갱신 실패. 다시 로그인해주세요.', 'error');
        }
      }, refreshTime);

      console.log('자동 갱신 타이머 설정 완료');
    } else {
      console.warn('토큰이 이미 만료되었거나 곧 만료됩니다.');
      showNotification('토큰이 곧 만료됩니다. 새로 로그인해주세요.', 'error');
    }
  }

  /**
   * Swagger UI 인증 변경 감지
   */
  function monitorAuthChanges() {
    let lastAuthState = localStorage.getItem('authorized');

    // localStorage 폴링 방식으로 변경 감지 (더 안정적)
    setInterval(() => {
      const currentAuthState = localStorage.getItem('authorized');

      // localStorage가 변경되었는지 확인
      if (currentAuthState !== lastAuthState) {
        console.log('localStorage 인증 정보 변경 감지');
        lastAuthState = currentAuthState;

        const authData = JSON.parse(currentAuthState || '{}');
        const accessTokenData = authData['access-token'];
        const refreshTokenData = authData['refresh-token'];

        if (accessTokenData?.value && refreshTokenData?.value) {
          console.log('새 토큰 설정 감지됨');
          setupAutoRefresh(accessTokenData.value, refreshTokenData.value);
          showNotification('JWT 자동 갱신이 활성화되었습니다.', 'info');
        } else if (!accessTokenData?.value || !refreshTokenData?.value) {
          console.log('토큰이 제거되거나 불완전함');
          if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
          }
          const statusBar = document.getElementById('token-status-bar');
          if (statusBar) {
            statusBar.style.display = 'none';
          }
        }
      }
    }, 1000); // 1초마다 체크

    // Authorize 버튼 클릭 이벤트 감지
    document.addEventListener('click', (e) => {
      const target = e.target;

      // Authorize 또는 Close 버튼 클릭 감지
      if (
        target.classList.contains('btn') &&
        (target.textContent.includes('Authorize') ||
         target.textContent.includes('Close') ||
         target.textContent.includes('Logout'))
      ) {
        console.log('인증 관련 버튼 클릭 감지:', target.textContent);

        // 버튼 클릭 후 조금 기다렸다가 토큰 확인
        setTimeout(() => {
          checkAndActivateTokens();
        }, 500);
      }
    }, true); // capture phase에서 감지

    console.log('인증 변경 감지 시작됨');
  }

  /**
   * 초기화
   */
  function init() {
    console.log('Swagger JWT 자동 갱신 스크립트 초기화 시작...');

    // CSS 애니메이션 추가
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);

    // 토큰 상태 UI 추가
    addTokenStatusUI();

    // 인증 변경 감지 시작
    monitorAuthChanges();

    // 페이지 로드 시 기존 토큰 확인
    checkAndActivateTokens();

    console.log('Swagger JWT 자동 갱신 스크립트 로드됨');
  }

  /**
   * 기존 토큰 확인 및 활성화 (재시도 로직 포함)
   */
  function checkAndActivateTokens() {
    const authData = JSON.parse(localStorage.getItem('authorized') || '{}');
    const accessTokenData = authData['access-token'];
    const refreshTokenData = authData['refresh-token'];

    if (accessTokenData?.value && refreshTokenData?.value) {
      console.log('기존 토큰 발견:', {
        accessToken: accessTokenData.value.substring(0, 20) + '...',
        refreshToken: refreshTokenData.value.substring(0, 20) + '...',
      });
      setupAutoRefresh(accessTokenData.value, refreshTokenData.value);
      showNotification('JWT 자동 갱신이 활성화되었습니다.', 'info');
    } else {
      console.log('저장된 토큰이 없습니다. Authorize 버튼을 통해 토큰을 설정해주세요.');
    }
  }

  /**
   * Swagger UI 완전 로드 대기
   */
  function waitForSwaggerUI(callback, maxAttempts = 20) {
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;

      // Swagger UI 객체 확인
      if (window.ui && document.querySelector('.swagger-ui')) {
        console.log(`Swagger UI 로드 완료 (시도 횟수: ${attempts})`);
        clearInterval(checkInterval);
        callback();
      } else if (attempts >= maxAttempts) {
        console.warn('Swagger UI 로드 시간 초과');
        clearInterval(checkInterval);
        // 시간 초과되어도 초기화 시도
        callback();
      }
    }, 300); // 300ms마다 체크
  }

  // Swagger UI가 로드될 때까지 대기
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      waitForSwaggerUI(init);
    });
  } else {
    // 이미 로드된 경우 Swagger UI 대기
    waitForSwaggerUI(init);
  }
})();
