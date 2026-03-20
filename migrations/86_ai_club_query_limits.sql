-- Update AI query function: 5000 row limit, 60 second timeout
CREATE OR REPLACE FUNCTION execute_club_scoped_query(
  p_club_id uuid,
  p_sql     text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wrapped text;
  v_result  json;
BEGIN
  SET LOCAL statement_timeout = '60000'; -- 60 seconds

  v_wrapped := format(
    $q$
    WITH
      athletes            AS (SELECT id, first_name, last_name, date_of_birth, gender, ussa_number, fis_license, household_id, created_at                FROM athletes            WHERE club_id = %1$L),
      registrations       AS (SELECT id, athlete_id, sub_program_id, season_id, status, payment_status, registration_date, created_at                    FROM registrations       WHERE club_id = %1$L AND deleted_at IS NULL),
      seasons             AS (SELECT id, name, start_date, end_date, status, is_current                                                                  FROM seasons             WHERE club_id = %1$L),
      programs            AS (SELECT id, name, season_id, status, is_active                                                                              FROM programs            WHERE club_id = %1$L AND deleted_at IS NULL),
      sub_programs        AS (SELECT id, name, program_id, season_id, registration_fee, max_capacity, status, is_active                                  FROM sub_programs        WHERE club_id = %1$L AND deleted_at IS NULL),
      households          AS (SELECT id, primary_email, phone, city, state, created_at                                                                   FROM households          WHERE club_id = %1$L),
      household_guardians AS (SELECT id, household_id, user_id, is_primary                                                                               FROM household_guardians WHERE club_id = %1$L),
      profiles            AS (SELECT id, email, first_name, last_name, phone, role                                                                       FROM profiles            WHERE club_id = %1$L),
      orders              AS (SELECT id, household_id, season_id, total_amount, status, created_at                                                       FROM orders              WHERE club_id = %1$L),
      waivers             AS (SELECT id, title, required, season_id, status                                                                              FROM waivers             WHERE club_id = %1$L),
      events              AS (SELECT id, title, event_type, start_at, end_at, location, season_id, program_id                                            FROM events              WHERE club_id = %1$L),
      messages            AS (SELECT id, subject, sender_id, season_id, sent_at, direct_email_count                                                     FROM messages            WHERE club_id = %1$L),
      coaches             AS (SELECT id, first_name, last_name, email, phone, is_active                                                                  FROM coaches             WHERE club_id = %1$L),
      groups              AS (SELECT id, name, sub_program_id, age_min, age_max                                                                          FROM groups              WHERE club_id = %1$L AND deleted_at IS NULL),
      -- No direct club_id — secured by joining through club-scoped parent CTEs above:
      payments            AS (SELECT p.id, p.order_id, p.amount, p.status, p.method, p.processed_at       FROM payments p           JOIN orders o  ON p.order_id  = o.id),
      order_items         AS (SELECT oi.id, oi.order_id, oi.registration_id, oi.description, oi.amount    FROM order_items oi        JOIN orders o  ON oi.order_id = o.id),
      waiver_signatures   AS (SELECT ws.id, ws.waiver_id, ws.athlete_id, ws.guardian_id, ws.signed_at     FROM waiver_signatures ws JOIN waivers w  ON ws.waiver_id = w.id),
      message_recipients  AS (SELECT mr.id, mr.message_id, mr.recipient_id, mr.read_at                    FROM message_recipients mr JOIN messages m ON mr.message_id = m.id)
    SELECT * FROM (
      %2$s
    ) AS _q
    LIMIT 5000
    $q$,
    p_club_id,
    p_sql
  );

  EXECUTE format(
    'SELECT COALESCE(json_agg(row_to_json(r)), ''[]''::json) FROM (%s) r',
    v_wrapped
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION execute_club_scoped_query(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION execute_club_scoped_query(uuid, text) TO service_role;
