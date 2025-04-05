-- 사용자 더미데이터
INSERT INTO user (username, password, nickname, email, phone) VALUES
('player1', '$2b$10$abcd', '김탁구', 'player1@test.com', '010-1111-1111'),
('player2', '$2b$10$abcd', '이탁구', 'player2@test.com', '010-1111-1112'),
('player3', '$2b$10$abcd', '박탁구', 'player3@test.com', '010-1111-1113'),
('player4', '$2b$10$abcd', '최탁구', 'player4@test.com', '010-1111-1114'),
('player5', '$2b$10$abcd', '정탁구', 'player5@test.com', '010-1111-1115'),
('player6', '$2b$10$abcd', '강탁구', 'player6@test.com', '010-1111-1116'),
('player7', '$2b$10$abcd', '조탁구', 'player7@test.com', '010-1111-1117'),
('player8', '$2b$10$abcd', '윤탁구', 'player8@test.com', '010-1111-1118'),
('player9', '$2b$10$abcd', '장탁구', 'player9@test.com', '010-1111-1119'),
('player10', '$2b$10$abcd', '임탁구', 'player10@test.com', '010-1111-1120'),
('player11', '$2b$10$abcd', '한탁구', 'player11@test.com', '010-1111-1121'),
('player12', '$2b$10$abcd', '신탁구', 'player12@test.com', '010-1111-1122'),
('player13', '$2b$10$abcd', '권탁구', 'player13@test.com', '010-1111-1123'),
('player14', '$2b$10$abcd', '황탁구', 'player14@test.com', '010-1111-1124'),
('player15', '$2b$10$abcd', '안탁구', 'player15@test.com', '010-1111-1125'),
('player16', '$2b$10$abcd', '송탁구', 'player16@test.com', '010-1111-1126'),
('operator1', '$2b$10$abcd', '운영자1', 'operator1@test.com', '010-2222-1111'),
('operator2', '$2b$10$abcd', '운영자2', 'operator2@test.com', '010-2222-1112'),
('admin1', '$2b$10$abcd', '관리자1', 'admin1@test.com', '010-3333-1111'),
('admin2', '$2b$10$abcd', '관리자2', 'admin2@test.com', '010-3333-1112');

-- 리그 더미데이터
INSERT INTO league (
  creator_id, name, city, district, venue, time, 
  tablecount, prize, description, minskilllevel, 
  maxskilllevel, maxplayers, contact, hashtags, createdat
) VALUES (
  17, -- operator1의 ID
  '2024 봄 탁구대회',
  '서울시',
  '강남구',
  '강남탁구장',
  '매주 토요일 14:00-18:00',
  4,
  '우승: 50만원, 준우승: 30만원, 3위: 10만원',
  '2024년 봄 시즌 아마추어 탁구 대회입니다.',
  '3',
  '7',
  16,
  '010-2222-1111',
  'amateur,pingpong,2024spring',
  NOW()
);

-- 리그 운영진 더미데이터
INSERT INTO league_operator (league_id, user_id)
SELECT 1, id FROM user WHERE username IN ('operator1', 'operator2');

-- 리그 참가자 더미데이터 (16명)
INSERT INTO league_participant (league_id, user_id, status, skilllevel)
SELECT 
  1, 
  id, 
  'APPROVED',
  CASE 
    WHEN id <= 4 THEN '7'
    WHEN id <= 8 THEN '6'
    WHEN id <= 12 THEN '5'
    ELSE '4'
  END
FROM user 
WHERE username LIKE 'player%'
LIMIT 16; 