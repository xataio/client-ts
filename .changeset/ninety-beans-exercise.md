---
'@xata.io/cli': patch
---

Bugfixes to adding / editing columns

- Unique + Not Null errors
- Unique + Default Value errors
- Emails are now validated
- Default values for text type allowed
- Setting {unique, notNull, defaultValue} for a type that doesn't support it errors
- notNull and unique are set to 'false' initially.
- No longer able to attempt to edit fields which cannot be edited on an existing column
