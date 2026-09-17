#!/usr/bin/env python3
"""build_collection_stats.py

Собирает статистику NFT-коллекции "The way of DHD" из TON API v2 и пишет
09-Site-Draft/data/collection-stats.json.

Особенности:
  * TON API (anonymous tier) отдаёт максимум limit=100 -> постранично.
  * Каждая страница кэшируется в scripts/.cache/tonapi/, поэтому повторный
    запуск не тратит сеть и укладывается в таймаут.
  * Floor price считается по items с полем sale (минимальная цена лота).
    Отдельно считается floor и количество лотов по каждому типу.
  * Если данных нет, поле остаётся null (ничего не выдумываем).

Usage:
    python scripts/build_collection_stats.py           # бюджет ~20 c на сеть
    python scripts/build_collection_stats.py --all     # докачать без бюджета
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

COLLECTION = "EQDzvSAKspPnYIhuqZe0_dMfrEEUlwKVzb4dJo0sRoxZwRZe"
API = "https://tonapi.io/v2/nfts/collections/{addr}/items?limit={limit}&offset={offset}"
TOTAL = 1022
LIMIT = 100

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).resolve().parent / ".cache" / "tonapi"


def site_dir(root: Path) -> Path:
    """Support both layouts: project draft (09-Site-Draft/) and site repo root."""
    draft = root / "09-Site-Draft"
    return draft if draft.is_dir() else root


OUT = site_dir(ROOT) / "data" / "collection-stats.json"


def fetch_page(offset: int) -> dict:
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / f"items-{offset}.json"
    if cached.exists():
        return json.loads(cached.read_text(encoding="utf-8"))
    url = API.format(addr=COLLECTION, limit=LIMIT, offset=offset)
    req = urllib.request.Request(
        url, headers={"Accept": "application/json", "User-Agent": "dhd-site-stats/1.0"}
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    cached.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def price_to_ton(sale):
    if not sale:
        return None
    price = sale.get("price") or {}
    value = price.get("value")
    if value is None:
        return None
    decimals = int(price.get("decimals") or 9)
    try:
        return float(value) / (10 ** decimals)
    except (TypeError, ValueError):
        return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="не останавливаться по времени")
    ap.add_argument("--budget", type=float, default=20.0, help="бюджет сети, сек")
    args = ap.parse_args()

    offsets = list(range(0, TOTAL, LIMIT))
    started = time.time()
    fetched, failed = 0, 0

    for off in offsets:
        if not args.all and time.time() - started > args.budget:
            print(f"budget reached, stopping at offset {off}", file=sys.stderr)
            break
        if (CACHE / f"items-{off}.json").exists():
            continue
        try:
            fetch_page(off)
            fetched += 1
            print(f"fetched offset {off}", file=sys.stderr)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
            failed += 1
            print(f"offset {off} failed: {exc}", file=sys.stderr)

    items = []
    for off in offsets:
        p = CACHE / f"items-{off}.json"
        if p.exists():
            items.extend(json.loads(p.read_text(encoding="utf-8")).get("nft_items") or [])

    if not items:
        print("no cached items, nothing to write", file=sys.stderr)
        return 1

    types, listings, markets, owners = {}, [], {}, set()

    for item in items:
        meta = item.get("metadata") or {}
        ttype = "Unknown"
        for attr in meta.get("attributes") or []:
            if str(attr.get("trait_type", "")).lower() == "type":
                ttype = attr.get("value") or "Unknown"
        bucket = types.setdefault(ttype, {"count": 0, "floor": None, "listed": 0})
        bucket["count"] += 1

        owner = item.get("owner") or {}
        if owner.get("address"):
            owners.add(owner["address"])

        price = price_to_ton(item.get("sale"))
        if price is not None:
            if price <= 0:
                # нулевые/битые лоты (market=unknown, price=0) не считаем floor-ом
                markets["invalid-zero"] = markets.get("invalid-zero", 0) + 1
                continue
            bucket["listed"] += 1
            if bucket["floor"] is None or price < bucket["floor"]:
                bucket["floor"] = price
            market = ((item.get("sale") or {}).get("market") or {}).get("name") or "unknown"
            markets[market] = markets.get(market, 0) + 1
            listings.append({
                "index": item.get("index"),
                "name": meta.get("name"),
                "type": ttype,
                "price": round(price, 2),
                "market": market,
            })

    scanned = len(items)
    listings.sort(key=lambda x: x["price"])
    floor = listings[0]["price"] if listings else None

    stats = {
        "collection": COLLECTION,
        "collectionName": "The way of DHD",
        "scannedItems": scanned,
        "complete": scanned >= TOTAL,
        "totalSupply": TOTAL,
        "ownersOnChain": len(owners),
        "listedCount": len(listings),
        "floorPrice": round(floor, 2) if floor is not None else None,
        "floorCurrency": "TON",
        "floorMarket": listings[0]["market"] if listings else None,
        "types": {
            k: {
                "count": v["count"],
                "share": round(v["count"] * 100.0 / TOTAL, 2),
                "listed": v["listed"],
                "floor": round(v["floor"], 2) if v["floor"] is not None else None,
            }
            for k, v in sorted(types.items(), key=lambda kv: -kv[1]["count"])
        },
        "markets": markets,
        "cheapestListings": listings[:10],
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "tonapi.io/v2 items with sale field (floor = min listed price)",
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} (items={scanned}, listings={len(listings)}, fetched={fetched}, failed={failed})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

