-- Guard support tickets: allow guard-originated tickets without a client
ALTER TABLE app.support_tickets ALTER COLUMN client_id DROP NOT NULL;

-- Guard RLS policies on support_tickets
DROP POLICY IF EXISTS "guard_tickets_select" ON app.support_tickets;
CREATE POLICY "guard_tickets_select" ON app.support_tickets
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM app.guards g WHERE g.user_id = auth.uid() AND g.id = support_tickets.guard_id));

DROP POLICY IF EXISTS "guard_tickets_insert" ON app.support_tickets;
CREATE POLICY "guard_tickets_insert" ON app.support_tickets
  FOR INSERT
  WITH CHECK (guard_id IN (SELECT g.id FROM app.guards g WHERE g.user_id = auth.uid()));

DROP POLICY IF EXISTS "guard_tickets_update" ON app.support_tickets;
CREATE POLICY "guard_tickets_update" ON app.support_tickets
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM app.guards g WHERE g.user_id = auth.uid() AND g.id = support_tickets.guard_id));

-- Guard RLS policies on ticket_messages
DROP POLICY IF EXISTS "guard_messages_select" ON app.ticket_messages;
CREATE POLICY "guard_messages_select" ON app.ticket_messages
  FOR SELECT
  USING ((EXISTS (SELECT 1 FROM app.support_tickets st WHERE st.id = ticket_messages.ticket_id AND EXISTS (SELECT 1 FROM app.guards g WHERE g.user_id = auth.uid() AND g.id = st.guard_id))) AND (is_internal = false));

DROP POLICY IF EXISTS "guard_messages_insert" ON app.ticket_messages;
CREATE POLICY "guard_messages_insert" ON app.ticket_messages
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM app.support_tickets st WHERE st.id = ticket_messages.ticket_id AND EXISTS (SELECT 1 FROM app.guards g WHERE g.user_id = auth.uid() AND g.id = st.guard_id)));