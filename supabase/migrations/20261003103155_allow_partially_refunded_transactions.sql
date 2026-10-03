ALTER TABLE app.transactions DROP CONSTRAINT transactions_status_check;
ALTER TABLE app.transactions ADD CONSTRAINT transactions_status_check CHECK (status IN ('pending','processing','completed','failed','cancelled','refunded','partially_refunded'));
