"""Train a historical closing-rank regression model; not an admission probability model."""
from pathlib import Path
import argparse
import json
import re
import joblib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, RegressorMixin, TransformerMixin
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline

CAT_ORDER = {
    "GOPENS": 1, "GSCS": 2, "GSTS": 3, "GVJS": 4, "GNT1S": 5, "GNT2S": 6, "GNT3S": 7, "GOBCS": 8, "GSEBCS": 9,
    "LOPENS": 10, "LSCS": 11, "LSTS": 12, "LVJS": 13, "LNT1S": 14, "LNT2S": 15, "LNT3S": 16, "LOBCS": 17, "LSEBCS": 18,
    "PWDOPENS": 19, "PWDSCS": 20, "PWDSTS": 21, "PWDVJS": 22, "PWDNT1S": 23, "PWDNT2S": 24, "PWDNT3S": 25, "PWDOBCS": 26, "PWDSEBCS": 27,
    "DEFOPENS": 28, "DEFSCS": 29, "DEFSTS": 30, "DEFVJS": 31, "DEFNT1S": 32, "DEFNT2S": 33, "DEFNT3S": 34, "DEFOBCS": 35, "DEFSEBCS": 36,
    "TFWS": 37,
    "PWDRNT1S": 38, "PWDRNT2S": 39, "PWDRNT3S": 40, "PWDROBCS": 41, "PWDRSCS": 42, "PWDRSEBCS": 43, "PWDRSTS": 44, "PWDRVJS": 45,
    "DEFRNT1S": 46, "DEFRNT2S": 47, "DEFRNT3S": 48, "DEFROBCS": 49, "DEFRSCS": 50, "DEFRSEBCS": 51, "DEFRSTS": 52, "DEFRVJS": 53,
    "ORPHAN": 54, "MI": 55, "EWS": 56,
}


def assign_course_blocks(F: pd.DataFrame) -> pd.DataFrame:
    """Detect repeated Stage-I course blocks within autonomous college groups without using target values."""
    n = len(F)
    block_idx = np.zeros(n, dtype=int)
    block_tot = np.ones(n, dtype=int)
    c_block_idx = np.zeros(n, dtype=int)
    c_block_tot = np.ones(n, dtype=int)

    yr_arr = F["academic_year"].values
    rn_arr = F["round_number"].values
    nc_arr = F["norm_college"].values
    br_arr = F["branch_name"].values
    cat_arr = F["category"].values
    st_arr = F["stage"].values

    prev_key = None
    prev_ckey = None
    b_idx = 0
    cb_idx = 0
    seen_s1 = set()
    max_ord = -1
    group_start = 0
    cgroup_start = 0

    for i in range(n):
        ckey = (yr_arr[i], rn_arr[i], nc_arr[i])
        key = (yr_arr[i], rn_arr[i], nc_arr[i], br_arr[i])
        cat = cat_arr[i]
        st = st_arr[i]
        is_s1 = st == "I" or st == "MH"
        ord_val = CAT_ORDER.get(cat, 30)

        if ckey != prev_ckey:
            if prev_ckey is not None:
                c_block_tot[cgroup_start:i] = cb_idx + 1
            cgroup_start = i
            cb_idx = 0
            prev_ckey = ckey
            prev_key = None

        if key != prev_key:
            if prev_key is not None:
                block_tot[group_start:i] = b_idx + 1
                cb_idx += 1
            group_start = i
            b_idx = 0
            seen_s1 = set()
            max_ord = -1
            prev_key = key
        else:
            if is_s1 and (cat == "GOPENS" or cat in seen_s1):
                b_idx += 1
                cb_idx += 1
                seen_s1 = set()
                max_ord = -1

        if is_s1:
            seen_s1.add(cat)
            if ord_val > max_ord:
                max_ord = ord_val

        block_idx[i] = b_idx
        c_block_idx[i] = cb_idx

    if n > 0:
        block_tot[group_start:n] = b_idx + 1
        c_block_tot[cgroup_start:n] = cb_idx + 1

    F["block_idx"] = block_idx
    F["block_tot"] = block_tot
    F["block_from_end"] = block_tot - 1 - block_idx
    F["c_block_idx"] = c_block_idx
    F["c_block_tot"] = c_block_tot
    return F


class CAPBlockFeatureTransformer(BaseEstimator, TransformerMixin):
    """Leakage-free hierarchical course-block & Open-reference feature transformer."""

    def _extract(self, X: pd.DataFrame) -> pd.DataFrame:
        out = pd.DataFrame(index=X.index)
        cc_col = X["college_code"].astype(str).str.strip()
        out["norm_college"] = cc_col.replace({"16006": "6006", "14005": "4005"})
        out["branch_name"] = X["branch_name"].astype(str).str.strip()
        out["category"] = X["category"].astype(str).str.strip()
        out["stage"] = X["stage"].astype(str).str.strip()
        out["round_number"] = pd.to_numeric(X["round_number"], errors="coerce").fillna(1).astype(int)
        out["academic_year"] = pd.to_numeric(X["academic_year"], errors="coerce").fillna(2025).astype(int)
        out = assign_course_blocks(out)
        stage_num = out["stage"].str.extract(r"^(\d+)\s*\(", expand=False)
        out["stage_rank"] = pd.to_numeric(stage_num, errors="coerce")
        return out

    def fit(self, X: pd.DataFrame, y=None):
        F = self._extract(X)
        F["target"] = pd.Series(y, index=X.index, dtype=float)

        years = sorted(F["academic_year"].unique())
        self.base_year_ = max(years)
        if len(years) >= 2:
            y_prev, y_last = years[-2], years[-1]
            g_prev = F[F.academic_year == y_prev].groupby(["norm_college", "branch_name", "block_idx", "category"])["target"].median()
            g_last = F[F.academic_year == y_last].groupby(["norm_college", "branch_name", "block_idx", "category"])["target"].median()
            common = pd.concat([g_prev.rename("p"), g_last.rename("l")], axis=1).dropna()
            common = common[(common["p"] > 100) & (common["l"] > 100)]
            raw_growth = float((common["l"] / common["p"]).median()) if len(common) else 1.18
            self.prev_to_last_ratio_ = raw_growth
            self.annual_growth_ = 1.0 + 0.55 * (raw_growth - 1.0)
        else:
            self.prev_to_last_ratio_ = 1.0
            self.annual_growth_ = 1.0

        scale_to_base = F["academic_year"].map(
            lambda yr: (self.prev_to_last_ratio_ ** (self.base_year_ - yr)) if yr < self.base_year_ else 1.0
        )
        F["scaled_target"] = F["target"] * scale_to_base
        F_lat = F[F.academic_year == self.base_year_]

        self.global_med_ = float(F_lat["scaled_target"].median())
        self.max_train_rank_ = float(F_lat["scaled_target"].max())

        piv = F.pivot_table(
            index=["academic_year", "round_number", "norm_college", "branch_name", "block_idx"],
            columns="category",
            values="scaled_target",
            aggfunc="median",
        )
        self.cat_to_open_mult_ = {"GOPENS": 1.0}
        self.open_to_cat_mult_ = {"GOPENS": 1.0}
        if "GOPENS" in piv.columns:
            for cat in piv.columns:
                if cat == "GOPENS":
                    continue
                both = piv[["GOPENS", cat]].dropna()
                both = both[(both["GOPENS"] > 50) & (both[cat] > 50)]
                if len(both) >= 5:
                    self.cat_to_open_mult_[cat] = float((both["GOPENS"] / both[cat]).median())
                    self.open_to_cat_mult_[cat] = float((both[cat] / both["GOPENS"]).median())

        def estimate_open_from_group(g: pd.DataFrame) -> float:
            for proxy_cat in ["GOPENS", "LOPENS", "TFWS", "EWS", "GOBCS", "DEFOPENS", "MI"]:
                sub = g[g.category == proxy_cat]["scaled_target"]
                if len(sub) > 0:
                    return float(sub.median()) * self.cat_to_open_mult_.get(proxy_cat, 1.0)
            return float(g["scaled_target"].median())

        self.open_block_ = {k: estimate_open_from_group(g) for k, g in F.groupby(["norm_college", "branch_name", "block_idx"])}
        self.open_block_lat_ = {k: estimate_open_from_group(g) for k, g in F_lat.groupby(["norm_college", "branch_name", "block_idx"])}
        self.open_cblock_ = {k: estimate_open_from_group(g) for k, g in F.groupby(["norm_college", "c_block_idx"])}
        self.open_cblock_lat_ = {k: estimate_open_from_group(g) for k, g in F_lat.groupby(["norm_college", "c_block_idx"])}
        self.open_course_ = {k: estimate_open_from_group(g) for k, g in F.groupby(["norm_college", "branch_name"])}
        self.open_college_ = {k: estimate_open_from_group(g) for k, g in F.groupby("norm_college")}

        F["b_open"] = [
            self.open_block_.get((nc, br, b), self.open_college_.get(nc, self.global_med_))
            for nc, br, b in zip(F["norm_college"], F["branch_name"], F["block_idx"])
        ]
        F["tier"] = pd.cut(F["b_open"], bins=[-1, 12000, 35000, 75000, 1e9], labels=[0, 1, 2, 3]).astype(int)
        F["ratio_to_b_open"] = F["scaled_target"] / np.maximum(F["b_open"], 100.0)
        F["diff_from_b_open"] = F["scaled_target"] - F["b_open"]

        self.tier_cat_ratio_ = F.groupby(["tier", "category"])["ratio_to_b_open"].median().to_dict()
        self.tier_cat_diff_ = F.groupby(["tier", "category"])["diff_from_b_open"].median().to_dict()
        self.tier_cat_med_ = F.groupby(["tier", "category"])["scaled_target"].median().to_dict()
        self.global_cat_ratio_ = F.groupby("category")["ratio_to_b_open"].median().to_dict()
        self.global_cat_med_ = F.groupby("category")["scaled_target"].median().to_dict()

        self.L1_lat_ = F_lat.groupby(["norm_college", "branch_name", "block_idx", "category", "round_number"])["scaled_target"].median().to_dict()
        self.L1_all_ = F.groupby(["norm_college", "branch_name", "block_idx", "category", "round_number"])["scaled_target"].median().to_dict()
        self.L2_lat_ = F_lat.groupby(["norm_college", "branch_name", "block_idx", "category"])["scaled_target"].median().to_dict()
        self.L2_all_ = F.groupby(["norm_college", "branch_name", "block_idx", "category"])["scaled_target"].median().to_dict()
        self.L2_end_lat_ = F_lat.groupby(["norm_college", "branch_name", "block_from_end", "category"])["scaled_target"].median().to_dict()
        self.L2_end_all_ = F.groupby(["norm_college", "branch_name", "block_from_end", "category"])["scaled_target"].median().to_dict()
        self.L3_rnd_lat_ = F_lat.groupby(["norm_college", "c_block_idx", "category", "round_number"])["scaled_target"].median().to_dict()
        self.L3_lat_ = F_lat.groupby(["norm_college", "c_block_idx", "category"])["scaled_target"].median().to_dict()
        self.L3_all_ = F.groupby(["norm_college", "c_block_idx", "category"])["scaled_target"].median().to_dict()
        self.L4_lat_ = F_lat.groupby(["norm_college", "branch_name", "category"])["scaled_target"].median().to_dict()
        self.L4_all_ = F.groupby(["norm_college", "branch_name", "category"])["scaled_target"].median().to_dict()
        self.L5_lat_ = F_lat.groupby(["norm_college", "category"])["scaled_target"].median().to_dict()
        self.L5_all_ = F.groupby(["norm_college", "category"])["scaled_target"].median().to_dict()
        self.L6_all_ = F.groupby(["branch_name", "category"])["scaled_target"].median().to_dict()

        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        F = self._extract(X)
        yr_diff = (F["academic_year"] - self.base_year_).clip(lower=-2, upper=5)
        year_mult = np.where(
            yr_diff > 0,
            self.annual_growth_ ** yr_diff,
            np.where(yr_diff < 0, (1.0 / self.prev_to_last_ratio_) ** (-yr_diff), 1.0),
        )

        n = len(F)
        feats = np.zeros((n, 12), dtype=float)

        nc_arr = F["norm_college"].values
        br_arr = F["branch_name"].values
        cat_arr = F["category"].values
        b_arr = F["block_idx"].values
        be_arr = F["block_from_end"].values
        cb_arr = F["c_block_idx"].values
        rnd_arr = F["round_number"].values
        st_rank_arr = F["stage_rank"].values

        for i in range(n):
            nc = nc_arr[i]
            br = br_arr[i]
            cat = cat_arr[i]
            b = int(b_arr[i])
            be = int(be_arr[i])
            cb = int(cb_arr[i])
            rnd = int(rnd_arr[i])
            ym = float(year_mult[i])

            c_open = self.open_college_.get(nc, self.global_med_)
            cr_open = self.open_course_.get((nc, br), c_open)
            cb_open = self.open_cblock_lat_.get((nc, cb), self.open_cblock_.get((nc, cb), cr_open))
            b_open = self.open_block_lat_.get((nc, br, b), self.open_block_.get((nc, br, b), cb_open))

            tier = 0 if b_open <= 12000 else (1 if b_open <= 35000 else (2 if b_open <= 75000 else 3))
            g_cat_med = self.global_cat_med_.get(cat, self.global_med_)
            t_cat_med = self.tier_cat_med_.get((tier, cat), g_cat_med)
            t_cat_rat = self.tier_cat_ratio_.get((tier, cat), self.global_cat_ratio_.get(cat, 1.0))
            t_cat_diff = self.tier_cat_diff_.get((tier, cat), 0.0)

            est_mult = np.clip(b_open * t_cat_rat, 50.0, self.max_train_rank_ * 1.15)
            est_add = np.clip(b_open + t_cat_diff, 50.0, self.max_train_rank_ * 1.15)
            block_prior = 0.50 * est_mult + 0.30 * est_add + 0.20 * t_cat_med

            l5 = 0.65 * self.L5_lat_.get((nc, cat), self.L5_all_.get((nc, cat), block_prior)) + 0.35 * self.L5_all_.get((nc, cat), block_prior)
            block_scale = np.clip(b_open / max(c_open, 100.0), 0.25, 3.0)
            l5_scaled = 0.60 * np.clip(l5 * block_scale, 50.0, self.max_train_rank_ * 1.15) + 0.40 * block_prior

            l3_all = self.L3_all_.get((nc, cb, cat), l5_scaled)
            l3_lat = self.L3_lat_.get((nc, cb, cat), l3_all)
            l3_rnd = self.L3_rnd_lat_.get((nc, cb, cat, rnd), l3_lat)
            l3 = 0.45 * l3_rnd + 0.35 * l3_lat + 0.20 * l3_all

            l4_all = self.L4_all_.get((nc, br, cat), l3)
            l4_lat = self.L4_lat_.get((nc, br, cat), l4_all)
            l4 = 0.65 * l4_lat + 0.35 * l4_all

            l2e_all = self.L2_end_all_.get((nc, br, be, cat), l4)
            l2e_lat = self.L2_end_lat_.get((nc, br, be, cat), l2e_all)
            l2e = 0.65 * l2e_lat + 0.35 * l2e_all

            l2_all = self.L2_all_.get((nc, br, b, cat), l3)
            l2_lat = self.L2_lat_.get((nc, br, b, cat), l2_all)
            l2 = 0.65 * l2_lat + 0.35 * l2_all

            l1_all = self.L1_all_.get((nc, br, b, cat, rnd), l2)
            l1_lat = self.L1_lat_.get((nc, br, b, cat, rnd), l1_all)
            l1 = 0.65 * l1_lat + 0.35 * l1_all

            has_exact_b = (nc, br, b, cat) in self.L2_all_
            has_exact_cb = (nc, cb, cat) in self.L3_all_
            has_exact_cc = (nc, cat) in self.L5_all_

            if has_exact_b:
                comp = 0.45 * l1 + 0.30 * l2 + 0.15 * l3 + 0.10 * block_prior
            elif has_exact_cb:
                comp = 0.55 * l3 + 0.25 * l2e + 0.20 * block_prior
            elif has_exact_cc:
                comp = 0.55 * l5_scaled + 0.45 * block_prior
            else:
                comp = block_prior

            if not np.isnan(st_rank_arr[i]):
                comp = 0.5 * comp + 0.5 * float(st_rank_arr[i])

            feats[i, 0] = comp * ym
            feats[i, 1] = l1 * ym
            feats[i, 2] = l2 * ym
            feats[i, 3] = l3 * ym
            feats[i, 4] = l4 * ym
            feats[i, 5] = l5_scaled * ym
            feats[i, 6] = block_prior * ym
            feats[i, 7] = b_open * ym
            feats[i, 8] = c_open * ym
            feats[i, 9] = float(has_exact_b)
            feats[i, 10] = float(has_exact_cb)
            feats[i, 11] = float(has_exact_cc)

        return feats


class CAPCalibratedRegressor(BaseEstimator, RegressorMixin):
    """Calibrated hierarchical closing-rank estimator with optional tree residual smoothing."""

    def __init__(self, tree_blend: float = 0.0):
        self.tree_blend = tree_blend

    def fit(self, X: np.ndarray, y: np.ndarray):
        self.is_fitted_ = True
        self.n_features_in_ = X.shape[1]
        if self.tree_blend > 0:
            self.hgb_ = HistGradientBoostingRegressor(
                max_depth=4,
                max_iter=100,
                learning_rate=0.05,
                min_samples_leaf=80,
                l2_regularization=10.0,
                random_state=42,
            )
            self.hgb_.fit(X, y)
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        base_pred = X[:, 0]
        if self.tree_blend > 0 and hasattr(self, "hgb_"):
            return (1.0 - self.tree_blend) * base_pred + self.tree_blend * self.hgb_.predict(X)
        return base_pred


def main():
    ROOT = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Train historical closing-rank regression model.")
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--out", type=Path, default=ROOT / "models" / "cutoff_model.joblib")
    args = parser.parse_args()

    parts = []
    for path in sorted(args.data_dir.glob("*.csv")):
        frame = pd.read_csv(path, low_memory=False)
        match = re.search(r"(20\d{2})_CAP([123])", path.name)
        if match:
            frame["academic_year"] = int(match.group(1))
            frame["round_number"] = int(match.group(2))
        parts.append(frame)
    if not parts:
        raise SystemExit("No CSV data found under data/")

    df = pd.concat(parts, ignore_index=True)
    df["merit_rank"] = pd.to_numeric(df["merit_rank"], errors="coerce")
    df = df.dropna(subset=["merit_rank", "academic_year"])
    features = [
        c for c in ["college_code", "branch_name", "category", "quota_level", "stage", "round_number", "academic_year"]
        if c in df
    ]
    latest = int(df.academic_year.max())
    train = df[df.academic_year < latest]
    test = df[df.academic_year == latest]
    if train.empty or test.empty:
        raise SystemExit("Need at least two years for temporal validation; refusing random-split performance claim.")

    model = Pipeline([
        ("prep", CAPBlockFeatureTransformer()),
        ("regressor", CAPCalibratedRegressor(tree_blend=0.0)),
    ])
    model.fit(train[features], train.merit_rank)
    pred = model.predict(test[features])

    metrics = {
        "task": "historical closing-rank regression",
        "not_a_probability": True,
        "train_years": sorted(int(x) for x in train.academic_year.unique()),
        "validation_year": latest,
        "n_train": int(len(train)),
        "n_test": int(len(test)),
        "MAE": float(mean_absolute_error(test.merit_rank, pred)),
        "RMSE": float(np.sqrt(mean_squared_error(test.merit_rank, pred))),
        "R2": float(r2_score(test.merit_rank, pred)),
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"pipeline": model, "features": features, "metrics": metrics}, args.out)
    (args.out.parent / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
