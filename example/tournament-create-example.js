/**
 * 간소화된 본선 토너먼트 생성 예제
 */

// 예시: 조별 진출
const tournament = {
  "leagueId": 1,
  "name": "본선 토너먼트",
  "order": 2,
  "type": "TOURNAMENT",
  "options": {
    "matchFormat": {
      "gamesRequired": 7,
      "setsRequired": 4
    },
    "bracketType": "UPPER",
    "seeding": {
      "type": "GROUP_RANK",
      "qualificationCriteria": {
        "rankCutoff": 2  // 각 조별 상위 2위까지 진출
      }
    }
  }
};

/**
 * 토너먼트 진출 인원 자동 계산 방식:
 * 
 * 1. 4개 조에서 각 2명씩 진출 = 총 8명 => 자동으로 8강(2^3) 토너먼트 생성
 * 2. 5개 조에서 각 2명씩 진출 = 총 10명 => 자동으로 16강(2^4) 토너먼트 생성 (6자리는 부전승)
 * 3. 8개 조에서 각 2명씩 진출 = 총 16명 => 자동으로 16강(2^4) 토너먼트 생성
 * 4. 9개 조에서 각 3명씩 진출 = 총 27명 => 자동으로 32강(2^5) 토너먼트 생성 (5자리는 부전승)
 */

// API 호출 예제
const createTournament = async (tournamentData) => {
  try {
    const response = await fetch('http://localhost:3000/stages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_TOKEN_HERE'
      },
      body: JSON.stringify(tournamentData)
    });
    
    const data = await response.json();
    console.log('토너먼트 생성 성공:', data);
    return data;
  } catch (error) {
    console.error('토너먼트 생성 실패:', error);
    throw error;
  }
};

// 사용 예시
// createTournament(tournament);  // 토너먼트 생성 