-- Atualizar todos os eventos para a data de hoje (mantendo o horário original)
-- Isso é útil para testes quando os dados ficam antigos

UPDATE "Event"
SET "eventDate" = NOW()
WHERE "eventDate" < CURRENT_DATE;

-- Ver resultado
SELECT 
  "eventType",
  "platform",
  "username",
  "amount",
  "eventDate",
  "createdAt"
FROM "Event"
ORDER BY "eventDate" DESC;

