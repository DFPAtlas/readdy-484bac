# Conversation lifecycle repairs

## Scope

Client and guard messaging can finish loading an old conversation after a different chat has opened. A component-wide mounted flag does not distinguish those conversations. Simply depending on the entire conversation object would also reload a chat whenever unread counts or realtime previews replace the list entry.

The loaders now depend on scalar conversation identity, invalidate each conversation lifetime on switch/unmount, and accept only the latest request within that lifetime. Old send callbacks cannot start a read for the previous conversation. Job and partner details are reset on selection and late metadata responses are discarded. Delayed scrolling also checks the active request. The client conversation-list initialization effect now declares its stable loader dependency.

## Validation

- Two regression tests execute the actual loader/effect bodies for both portals with deferred database responses. They cover switching chats, old loader callbacks, stable unread-list updates, and unmounting during a read.
- Full regression suite: 293 passed.
- Frontend TypeScript and admin/financial type gate passed.
- Full lint: zero errors, 587 warnings; 64 React dependency warnings remain (previously 67).

## Remaining scope

This batch covers conversation loading. Sending, realtime merge behavior, older-message pagination, and full signed-in browser journeys still need broader review. Job-detail lifecycle and the other dependency warnings remain separate audit items. This is not full-site launch sign-off.
