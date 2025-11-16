# Next.js Cache Components - cacheLife Explained

## Overview

With Next.js 16's Cache Components (`cacheComponents: true`), the traditional `export const revalidate` is replaced by the `"use cache"` directive combined with `cacheLife()`.

The `cacheLife()` function controls three distinct caching layers:

## The Three Cache Properties

### 1. `stale` - Client-Side Router Cache

**What it controls:** How long the client browser can use cached data without checking the server.

**Behavior:**
- During this time, navigation is **instant** - no network request
- After this period, the router **must check** with the server on next navigation
- Provides the fastest user experience but data may be outdated
- **Minimum enforced: 30 seconds** (to keep prefetched links usable)

**Example:**
```typescript
cacheLife({ stale: 300 }) // 5 minutes
```

**User experience:**
- User visits `/blog/1` → Page loads from server
- User navigates away, then back to `/blog/1` within 5 minutes → **Instant load** from client cache
- After 5 minutes → Router checks server for updates

---

### 2. `revalidate` - Server-Side Background Refresh

**What it controls:** How often the server regenerates cached content in the background.

**Behavior:**
- Similar to traditional ISR (Incremental Static Regeneration)
- When a request arrives **after** this period:
  1. Server serves the **cached version immediately** (fast response)
  2. Server regenerates content **in the background**
  3. Server updates cache with fresh content
- Next request gets the updated version

**Example:**
```typescript
cacheLife({ revalidate: 900 }) // 15 minutes
```

**Timeline:**
- `T=0`: Page generated and cached
- `T=10min`: Request arrives → Serves cached version (instant)
- `T=16min`: Request arrives → Serves cached version + triggers background regeneration
- `T=17min`: Request arrives → Serves newly regenerated version

---

### 3. `expire` - Maximum Cache Lifetime

**What it controls:** Maximum time before the server **must** regenerate cached content.

**Behavior:**
- After this period **with no traffic**, the cache is considered expired
- Next request **waits** for fresh content to be generated (synchronous)
- Acts as a hard limit on cache staleness
- **Must be longer than `revalidate`** (Next.js validates this)

**Example:**
```typescript
cacheLife({ expire: 3600 }) // 1 hour
```

**Timeline:**
- `T=0`: Page generated and cached
- `T=30min`: Requests served from cache
- `T=1h+1min` (no traffic for 1 hour): Cache expires
- Next request: **Waits** for fresh generation (slower, but guaranteed fresh)

---

## How They Work Together

```typescript
cacheLife({
  stale: 300,      // 5 minutes - client cache
  revalidate: 900, // 15 minutes - background refresh
  expire: 3600,    // 1 hour - hard expiration
})
```

### Request Flow Example:

**Scenario 1: Fresh cache (within 15 minutes)**
1. Request arrives at `T=10min`
2. ✅ Serve from cache (instant)
3. No regeneration needed

**Scenario 2: Stale cache (after 15 minutes, before 1 hour)**
1. Request arrives at `T=20min`
2. ✅ Serve from cache (instant)
3. 🔄 Trigger background regeneration
4. Next request gets fresh content

**Scenario 3: Expired cache (after 1 hour with no traffic)**
1. Request arrives at `T=1h+5min`
2. ⏳ Wait for fresh generation
3. ✅ Serve fresh content
4. Cache updated

---

## Preset Profiles

Next.js provides preset profiles for common use cases:

| Profile | Use Case | `stale` | `revalidate` | `expire` |
|---------|----------|---------|--------------|----------|
| `seconds` | Real-time data (stock prices) | 30s | 1s | 1min |
| `minutes` | Social feeds, news | 5min | 1min | 1h |
| `hours` | Product inventory, weather | 5min | 1h | 1day |
| `days` | Blog posts, articles | 5min | 1day | 1week |
| `weeks` | Podcasts, newsletters | 5min | 1week | 30days |
| `max` | Legal pages, archived content | 5min | 30days | 1year |
| `default` | Standard content | 5min | 15min | 1year |

### Using Presets:

```typescript
"use cache"
import { cacheLife } from "next/cache"

export default async function BlogPost() {
  cacheLife("days") // Blog posts updated daily
  
  const post = await fetchBlogPost()
  return <article>{post.content}</article>
}
```

---

## Comparison: Old ISR vs Cache Components

### Old Way (ISR with `revalidate`):

```typescript
// ❌ NOT compatible with cacheComponents: true
export const revalidate = 60

export default async function Page() {
  const data = await fetch("https://api.example.com/data")
  return <div>{data}</div>
}
```

### New Way (Cache Components):

```typescript
"use cache"
import { cacheLife } from "next/cache"

export default async function Page() {
  cacheLife({
    stale: 300,      // Client cache: 5 minutes
    revalidate: 60,  // Background refresh: 60 seconds (like old ISR)
    expire: 3600,    // Max lifetime: 1 hour
  })
  
  const data = await fetch("https://api.example.com/data")
  return <div>{data}</div>
}
```

---

## Common Patterns

### Pattern 1: ISR-like Behavior (60 second revalidation)

```typescript
"use cache"
import { cacheLife } from "next/cache"

export default async function Page() {
  cacheLife({
    stale: 300,      // 5 min client cache
    revalidate: 60,  // 60s background refresh (ISR-like)
    expire: 3600,    // 1h max
  })
  // ...
}
```

### Pattern 2: Real-time Data

```typescript
"use cache"
import { cacheLife } from "next/cache"

export default async function StockPrice() {
  cacheLife("seconds") // or cacheLife({ revalidate: 1, expire: 60 })
  // ...
}
```

### Pattern 3: Static Content (rarely changes)

```typescript
"use cache"
import { cacheLife } from "next/cache"

export default async function LegalPage() {
  cacheLife("max") // or cacheLife({ revalidate: 2592000, expire: 31536000 })
  // ...
}
```

### Pattern 4: Daily Blog Posts

```typescript
"use cache"
import { cacheLife } from "next/cache"

export default async function BlogPost() {
  cacheLife("days") // Perfect for daily-updated content
  // ...
}
```

---

## Important Rules

1. **`expire` must be > `revalidate`**
   ```typescript
   // ❌ Invalid
   cacheLife({ revalidate: 3600, expire: 1800 })
   
   // ✅ Valid
   cacheLife({ revalidate: 1800, expire: 3600 })
   ```

2. **Minimum `stale` is 30 seconds** (enforced by Next.js for prefetching)

3. **`"use cache"` must be at the top** of the file or function

4. **Not compatible with `export const revalidate`** when `cacheComponents: true`

---

## Nested Caching Behavior

When components with different cache profiles are nested, **the shortest duration wins**:

```typescript
// Parent: cached for hours
"use cache"
export default async function Dashboard() {
  cacheLife("hours")
  
  return (
    <div>
      <RealtimeWidget /> {/* Child: cached for seconds */}
    </div>
  )
}

// Child: cached for seconds
"use cache"
export async function RealtimeWidget() {
  cacheLife("seconds") // ← This wins! Shortest duration
  // ...
}
```

Result: The entire page uses the `seconds` profile because it's the shortest.

---

## Manual Revalidation

You can bypass cache timing with manual revalidation:

```typescript
"use server"
import { revalidatePath, revalidateTag } from "next/cache"

export async function updatePost() {
  // Invalidate specific path
  revalidatePath("/blog/[id]")
  
  // Or invalidate by tag
  revalidateTag("posts")
}
```

When called, these functions:
- Clear the server cache immediately
- Clear the client router cache immediately
- Bypass the `stale` time

---

## Summary

| Property | Layer | Purpose | User Impact |
|----------|-------|---------|-------------|
| `stale` | Client | How long browser can use cache | Instant navigation |
| `revalidate` | Server | Background refresh frequency | Fresh content without waiting |
| `expire` | Server | Hard cache limit | Guaranteed freshness after expiry |

**Think of it as:**
- `stale` = "How long can the client be lazy?"
- `revalidate` = "How often should we refresh in the background?"
- `expire` = "What's the absolute maximum staleness we'll tolerate?"
