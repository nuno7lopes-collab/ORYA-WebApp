-- Social migration: ORYA passa a operar com amizade bidirecional.
-- 1) Remove relações de follow unidirecionais.
DELETE FROM app_v3.follows f
WHERE NOT EXISTS (
  SELECT 1
  FROM app_v3.follows r
  WHERE r.follower_id = f.following_id
    AND r.following_id = f.follower_id
);

-- 2) Perfis privados passam para o modo compatível FOLLOWERS
-- (semântica de produto: "Só amigos").
UPDATE app_v3.profiles
SET visibility = 'FOLLOWERS'
WHERE visibility = 'PRIVATE';
