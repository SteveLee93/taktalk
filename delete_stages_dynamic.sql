-- 스테이지 17부터 38까지 순차적으로 삭제하는 동적 스크립트
-- MySQL에서 다음과 같이 실행:
-- source delete_stages_dynamic.sql

DELIMITER $$

DROP PROCEDURE IF EXISTS delete_stages$$
CREATE PROCEDURE delete_stages(IN start_id INT, IN end_id INT)
BEGIN
  DECLARE current_id INT;
  SET current_id = start_id;
  
  WHILE current_id <= end_id DO
    SELECT CONCAT('처리 중: 스테이지 ID ', current_id) AS 'Info';
    
    -- 1. 매치의 next_match_id를 NULL로 설정
    SET @sql1 = CONCAT('UPDATE `match` SET next_match_id = NULL WHERE stage_id = ', current_id);
    PREPARE stmt1 FROM @sql1;
    EXECUTE stmt1;
    DEALLOCATE PREPARE stmt1;
    
    -- 2. 매치 데이터 삭제
    SET @sql2 = CONCAT('DELETE FROM `match` WHERE stage_id = ', current_id);
    PREPARE stmt2 FROM @sql2;
    EXECUTE stmt2;
    DEALLOCATE PREPARE stmt2;
    
    -- 3. 스테이지 삭제
    SET @sql3 = CONCAT('DELETE FROM `stage` WHERE id = ', current_id);
    PREPARE stmt3 FROM @sql3;
    EXECUTE stmt3;
    DEALLOCATE PREPARE stmt3;
    
    SELECT CONCAT('완료: 스테이지 ID ', current_id, ' 삭제됨') AS 'Result';
    
    SET current_id = current_id + 1;
  END WHILE;
  
  SELECT CONCAT('모든 스테이지(', start_id, '-', end_id, ') 삭제 완료') AS 'Final Result';
END$$

DELIMITER ;

-- 스테이지 17부터 38까지 삭제 프로시저 호출
CALL delete_stages(17, 38); 