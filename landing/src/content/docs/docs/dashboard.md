---
title: Dashboard
description: A local web UI to view, edit, and stress-test your rules.
---

```bash
npx remindy dashboard              # http://localhost:3456
```

A local control room for your taste pack:

- See and inline-edit every stored standard.
- Capture a new rule, or dry-run recall for any task context.
- A backend badge: **green** means live Supermemory (shared and persistent), **red**
  means isolated in-memory.
- The [BYOK](/docs/byok/) provider panel.

Click **Tour** in the dashboard for a guided walkthrough.

## What's a "burn"?

A **burn** is one time you corrected the agent on a rule. Every correction bumps that
rule's count (`xN`). The **Total Burns** stat sums them across all rules, and higher-burn
rules rank first in recall, so your most-repeated mistakes are the ones the agent sees.
