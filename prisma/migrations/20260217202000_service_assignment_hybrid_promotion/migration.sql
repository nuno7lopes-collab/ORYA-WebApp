UPDATE app_v3.services s
SET assignment_mode = 'PROFESSIONAL_AND_RESOURCE'::app_v3."ReservationAssignmentMode"
WHERE EXISTS (
    SELECT 1
    FROM app_v3.service_professionals spl
    WHERE spl.service_id = s.id
  )
  AND EXISTS (
    SELECT 1
    FROM app_v3.service_resources srl
    WHERE srl.service_id = s.id
  )
  AND s.assignment_mode <> 'PROFESSIONAL_AND_RESOURCE'::app_v3."ReservationAssignmentMode";
