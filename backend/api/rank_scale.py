"""
Data-driven MHT-CET percentile <-> State Merit Rank scale.

Every CAP cutoff row carries both a percentile and a State Merit Rank, so for each
year we can learn the exact mapping between the two. This replaces the old fixed
"pool scale" multipliers and lets category calibration (done in percentile space)
produce accurate rank cutoffs for any year.
"""
from __future__ import annotations

import math
from typing import Dict, List, Optional, Tuple

import numpy as np
from sqlalchemy.orm import Session

from .models import CollegeRecord


class RankScale:
    def __init__(self, rows: List[Tuple[int, float, float]]):
        by_year: Dict[int, Tuple[List[float], List[float]]] = {}
        for year, pct, rank in rows:
            if year is None or pct is None or rank is None:
                continue
            by_year.setdefault(int(year), ([], []))
            by_year[int(year)][0].append(float(pct))
            by_year[int(year)][1].append(float(rank))

        self.tables: Dict[int, Tuple[np.ndarray, np.ndarray]] = {}
        for year, (pcts, ranks) in by_year.items():
            table = self._build(np.asarray(pcts), np.asarray(ranks))
            if table is not None:
                self.tables[year] = table
        self.years = sorted(self.tables)
        self.latest_year = self.years[-1] if self.years else 2025

    @staticmethod
    def _build(pcts: np.ndarray, ranks: np.ndarray):
        mask = (pcts > 0.5) & (pcts < 100) & (ranks >= 1)
        pcts, ranks = pcts[mask], ranks[mask]
        if len(pcts) < 20:
            return None
        log_gap = np.log(100.0 - pcts)
        log_rank = np.log(ranks)

        # Bin in log-gap space (~6% wide bins) and drop rows whose rank is
        # inconsistent with their percentile (data-entry errors).
        bins = np.round(log_gap * 16).astype(int)
        keep = np.ones(len(pcts), dtype=bool)
        for b in np.unique(bins):
            idx = np.where(bins == b)[0]
            med = np.median(log_rank[idx])
            keep[idx[np.abs(log_rank[idx] - med) > math.log(1.4)]] = False
        log_gap, log_rank, bins = log_gap[keep], log_rank[keep], bins[keep]

        xs, ys = [], []
        for b in np.unique(bins):
            idx = bins == b
            xs.append(float(np.median(log_gap[idx])))
            ys.append(float(np.median(log_rank[idx])))
        order = np.argsort(xs)
        xs = np.asarray(xs)[order]
        ys = np.maximum.accumulate(np.asarray(ys)[order])  # rank never decreases as gap grows
        # make strictly increasing for inverse interpolation
        ys = ys + np.arange(len(ys)) * 1e-9
        return xs, ys

    def _table(self, year: Optional[int]):
        if year in self.tables:
            return self.tables[year]
        if not self.years:
            return None
        nearest = min(self.years, key=lambda y: abs(y - (year or self.latest_year)))
        return self.tables[nearest]

    def pct_to_rank(self, year: Optional[int], pct: Optional[float]) -> Optional[float]:
        if pct is None:
            return None
        table = self._table(year)
        if table is None:
            return None
        xs, ys = table
        gap = min(100.0, max(1e-4, 100.0 - float(pct)))
        lg = math.log(gap)
        if lg <= xs[0]:
            rank = math.exp(ys[0]) * gap / math.exp(xs[0])
        elif lg >= xs[-1]:
            rank = math.exp(ys[-1]) * gap / math.exp(xs[-1])
        else:
            rank = math.exp(float(np.interp(lg, xs, ys)))
        return float(max(1, round(rank)))

    def rank_to_pct(self, year: Optional[int], rank: Optional[float]) -> Optional[float]:
        if rank is None:
            return None
        table = self._table(year)
        if table is None:
            return None
        xs, ys = table
        lr = math.log(max(1.0, float(rank)))
        if lr <= ys[0]:
            gap = math.exp(xs[0]) * math.exp(lr) / math.exp(ys[0])
        elif lr >= ys[-1]:
            gap = math.exp(xs[-1]) * math.exp(lr) / math.exp(ys[-1])
        else:
            gap = math.exp(float(np.interp(lr, ys, xs)))
        return round(min(99.9999, max(0.0, 100.0 - gap)), 4)

    def is_consistent(self, year: Optional[int], pct: Optional[float], rank: Optional[float]) -> bool:
        """False when a row's rank and percentile disagree badly (bad source data)."""
        if pct is None or rank is None or pct >= 99.7:
            return True
        expected = self.pct_to_rank(year, pct)
        if not expected:
            return True
        ratio = float(rank) / expected
        return 1 / 1.6 <= ratio <= 1.6


_SCALE: Optional[RankScale] = None


def get_rank_scale(db: Session) -> RankScale:
    global _SCALE
    if _SCALE is None or not _SCALE.years:
        rows = (
            db.query(CollegeRecord.year, CollegeRecord.percentile, CollegeRecord.merit_rank)
            .filter(
                CollegeRecord.percentile.isnot(None),
                CollegeRecord.merit_rank.isnot(None),
                CollegeRecord.stage.in_(["I", "MH"]),
            )
            .all()
        )
        _SCALE = RankScale(rows)
    return _SCALE


def reset_rank_scale() -> None:
    global _SCALE
    _SCALE = None
