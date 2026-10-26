# API reference

Base `/api`. Session authentication required except login/registration. All mutations require an `Origin` header equal to APP_ORIGIN. Responses use `{ "data": ... }` or `{ "error": { "code": "...", "message": "..." } }`. Financial values are integer-paise **strings**, quantities integers, dates ISO-8601. No client-provided user ID authorizes access. No real-money endpoints exist.

| Method | Path | Input / behavior |
|---|---|---|
| POST | `/auth/register` | `{email,password,name?}`; password 12–128 chars, new virtual account; 201 |
| POST | `/auth/login` | `{email,password}`; sets HttpOnly session cookie |
| POST | `/auth/logout` | Revokes current session and cookie |
| GET | `/profile` | Current ID, email, display name |
| PATCH | `/profile` | `{name}` |
| GET | `/instruments` | `search`, `exchange`, `sector`, `sort=symbol\|price\|change`, `dir=asc\|desc`, `page`; 8 per page, returns `{items,total,page,simulationTime}` |
| GET | `/instruments/:symbol` | Quote, metrics, deterministic history and simulation timestamp |
| GET | `/instruments/:symbol/history` | OHLCV rows |
| GET | `/account`, `/holdings`, `/portfolio` | Same consistent portfolio snapshot with cash, holdings, cost basis, equity, unrealized/gross realized, fees, net trading P&L, ledger sum and reconciliation |
| GET | `/watchlists` | Current user's lists with items and instruments |
| POST | `/watchlists` | `{name}` |
| PATCH | `/watchlists/:id` | `{name}`; ownership checked |
| DELETE | `/watchlists/:id` | Delete owned list and its items |
| POST | `/watchlists/:id/items` | `{symbol}`; unique persisted membership |
| DELETE | `/watchlists/:id/items/:symbol` | Remove membership |
| POST | `/orders` | See order payload below |
| POST | `/orders/:id/cancel` | Cancel owned PENDING order; otherwise 404/409 |
| GET | `/orders` | `symbol`, `status`, `from=YYYY-MM-DD`, `to=YYYY-MM-DD`, `format=csv`; returns orders and executions |
| GET | `/trades` | Same filters, FILLED only; `format=csv` exports execution prices, fees, timestamps and order IDs |
| GET | `/ledger` | Cash deltas, balances after, linked execution IDs, initial credit |
| GET | `/notifications` | Most recent 100 owned notifications |
| PATCH | `/notifications/:id` | Mark owned notification read |
| GET | `/alerts` | Saved owned rules; **not automatically evaluated** |
| POST | `/alerts` | `{symbol,target:"285000",direction:"ABOVE"\|"BELOW"}`; paise |
| DELETE | `/alerts/:id` | Delete owned rule |
| GET | `/lab` | Boolean map by zero-based scenario index, derived only from this user's persisted state. Evidence, not proof of full scenario completion. |

Example market order:

```json
{"symbol":"RELIANCE","side":"BUY","type":"MARKET","quantity":5,"idempotencyKey":"89024faa-d1d6-4ca4-b8d6-45ee47ef6377"}
```

`side`: BUY or SELL. `type`: MARKET, LIMIT, STOP_LOSS. Non-market orders additionally require `triggerPrice` as a positive paise string, max 12 digits, and are explicitly pending-only. Quantity must be an integer 1–1,000,000. Market price comes exclusively from PostgreSQL. Unknown fields are rejected. Reusing an idempotency key with identical details returns the same order, including its execution; different details return 409.

Successful execution returns 201 with status FILLED, order ID and execution (`price`, `quantity`, `notional`, `fee`, timestamp). Pending orders return 201/PENDING. Business rejection is 422 with `{data: {id,status:"REJECTED",reason,...}}` to preserve the auditable rejected order. Validation failures return 400 with structured error, not a claimed execution. Unauthenticated 401; origin failure 403; not found/unauthorized resource 404; conflicts 409; too many requests 429; internal/database failure 500. On network or server uncertainty, inspect history rather than placing a new order.

Date filters are inclusive UTC calendar days. CSV prices/fees are integer paise, quoted and escaped. Only safe server-generated IDs, validated symbols, enum values, integers and timestamps are exported. Routes are implemented in Next.js; FastAPI/OpenAPI is not part of this architecture.
