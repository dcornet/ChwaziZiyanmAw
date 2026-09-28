#!/usr/bin/env python3
"""Build static VaPaDONF model data from the legacy RITA CSV files.

The browser recalculates I1.2 from user calibre thresholds. Other sub-indicators
are precomputed here from the legacy data. I5.1 is approximated from empirical
emergence quantiles in this V1; I5.2/I5.3 use a 3-parameter logistic fit close
to the historical drc::L.3 model.
"""
from __future__ import annotations
import argparse, json, math, re
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import numpy as np
import pandas as pd
from scipy.optimize import curve_fit


def norm_var(v):
    if pd.isna(v):
        return None
    return re.sub(r"\s+", "", str(v)).upper().strip()


def finite_or_none(x):
    try:
        x = float(x)
    except Exception:
        return None
    return x if math.isfinite(x) else None


def load_csv(path: Path, sep: str):
    return pd.read_csv(path, sep=sep, encoding="latin1", decimal=",", low_memory=False)


def logistic(x, b, d, e):
    # Same sign convention as the legacy plotting helper:
    # d / (1 + exp(b * (x - e))), with b < 0 for increasing curves.
    z = np.clip(b * (np.asarray(x, dtype=float) - e), -700, 700)
    return d / (1.0 + np.exp(z))


def build(source: Path, mapping_path: Path, output: Path):
    mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
    genos = mapping["genotypes"]
    code_to_g = {g["identifiant_moteur"]: g for g in genos}
    alias_to_code: Dict[str, str] = {}
    for g in genos:
        aliases = set(g.get("aliases_donnees", [])) | {
            g["identifiant_moteur"], g.get("code_donnees_legacy", "")
        }
        for a in aliases:
            if a:
                alias_to_code[norm_var(a)] = g["identifiant_moteur"]
    alias_to_code["MALALAGHI"] = "MALALAGI"

    def canonicalize(df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        if "Var" in df:
            df["Var_raw"] = df["Var"]
            df["Var"] = df["Var"].map(norm_var).map(alias_to_code)
            df = df[df["Var"].isin(code_to_g)].copy()
            df["Sp"] = df["Var"].map(lambda c: code_to_g[c]["espece"])
        if "Parcelle" in df:
            # Historical FixZone() logic.
            df["Zone"] = np.where(
                df["Parcelle"].isin(["AB", "Godet", "LM", "MO", "SF"]), "GT",
                np.where(df["Parcelle"].eq("GB"), "MG", "BT")
            )
        return df

    specs = {
        "dpla": ("plantation.csv", ";"),
        "deme": ("emergence.csv", ";"),
        "drec": ("recouvrement.csv", ";"),
        "dsan": ("sanitaire.csv", ","),
        "drdt1": ("rec_plant.csv", ";"),
        "drdt2": ("rec_pesee.csv", ","),
        "dsen": ("senescence.csv", ","),
        "dsto": ("stockage.csv", ","),
        "dqua": ("qualite.csv", ","),
    }
    dfs = {k: canonicalize(load_csv(source / fn, sep)) for k, (fn, sep) in specs.items()}

    # Parse dates and reconstruct JAP from mean planting date by year/site.
    pla0 = dfs["dpla"]
    for c in [x for x in pla0.columns if "Date" in x]:
        pla0[c] = pd.to_datetime(pla0[c], dayfirst=True, errors="coerce")
    plant_site = (
        pla0.groupby(["AN", "Parcelle"], dropna=False)
        .agg(Date_Pl=("Date_Plant", "mean"),
             Dist_Billon=("Dist_Billon", "mean"),
             Dist_Ligne=("Dist_Ligne", "mean"))
        .reset_index()
    )
    plant_site["Densite"] = 1.0 / (plant_site["Dist_Billon"] * plant_site["Dist_Ligne"])
    plant_site = plant_site[["AN", "Parcelle", "Date_Pl", "Densite"]]

    for key, df in dfs.items():
        date_cols = [c for c in df.columns if "Date" in c]
        if key != "dpla":
            for c in date_cols:
                df[c] = pd.to_datetime(df[c], dayfirst=True, errors="coerce")
        if "AN" in df and key != "dqua":
            df = df.merge(plant_site[["AN", "Parcelle", "Date_Pl"]], on=["AN", "Parcelle"], how="left")
            for c in date_cols:
                if c != "Date_Pl":
                    df[c + "_JAP"] = (df[c] - df["Date_Pl"]).dt.total_seconds() / 86400.0
            dfs[key] = df

    # Master situation set from all empirical sources except qualitative table.
    comb_parts = []
    for key in ["dpla", "deme", "drec", "dsan", "drdt1", "drdt2", "dsen", "dsto"]:
        df = dfs[key]
        cols = ["AN", "Zone", "Parcelle", "Var", "Sp"]
        if all(c in df for c in cols):
            comb_parts.append(df[cols].dropna(subset=["AN", "Parcelle", "Var"]).drop_duplicates())
    comb = pd.concat(comb_parts, ignore_index=True).drop_duplicates()
    comb["AN"] = pd.to_numeric(comb["AN"], errors="coerce").astype("Int64")

    # ---------- Production base metrics ----------
    pla = dfs["dpla"].copy()
    rdt1 = dfs["drdt1"].copy()
    rdt2 = dfs["drdt2"].copy()
    em = dfs["deme"].copy()

    plas = pla.groupby(["AN", "Parcelle", "Var"], as_index=False)["NB_P_Parc"].sum().rename(columns={"NB_P_Parc": "Nb_Pl_Pl"})

    nb_cols = [f"NB_PL_{i}T" for i in range(1, 7)]
    for c in nb_cols + ["NB_Rec_Parc"]:
        rdt1[c] = pd.to_numeric(rdt1[c], errors="coerce")
    rdt1["Nb_PL_Tot_row"] = rdt1[nb_cols].fillna(0).sum(axis=1)
    rdt1s = rdt1.groupby(["AN", "Parcelle", "Var"], as_index=False).agg(
        Nb_PL_Tot_sum=("Nb_PL_Tot_row", "sum"), NB_Rec_Parc=("NB_Rec_Parc", "sum")
    )
    rdt1s["Nb_PL_Tot"] = np.where(rdt1s["Nb_PL_Tot_sum"].eq(0), rdt1s["NB_Rec_Parc"], rdt1s["Nb_PL_Tot_sum"])
    rdt1s = rdt1s.drop(columns=["Nb_PL_Tot_sum"])

    rdt2["Poids"] = pd.to_numeric(rdt2["Poids"], errors="coerce")
    def cv(series):
        a = pd.to_numeric(series, errors="coerce").dropna().to_numpy(dtype=float)
        if len(a) < 2 or np.mean(a) == 0:
            return np.nan
        return np.std(a, ddof=1) / np.mean(a) * 100.0
    rdt2s = rdt2.groupby(["AN", "Parcelle", "Var"], as_index=False).agg(
        Nb_Tub_Rec=("Poids", "size"), PoidsTot=("Poids", "sum"), I1_3=("Poids", cv)
    )

    # Number emerged: reproduce PP vs PR strategy as closely as possible.
    em["Date_Levee"] = pd.to_datetime(em.get("Date_Levee"), dayfirst=True, errors="coerce")
    em["NB_Lev_Billon"] = pd.to_numeric(em.get("NB_Lev_Billon"), errors="coerce")
    pp = em[em["Plante"].isna()].copy()
    if len(pp):
        pp_date = pp.groupby(["AN", "Parcelle", "Var", "Date_Levee"], as_index=False)["NB_Lev_Billon"].sum(min_count=1)
        ems_pp = pp_date.groupby(["AN", "Parcelle", "Var"], as_index=False)["NB_Lev_Billon"].max().rename(columns={"NB_Lev_Billon": "NB_Pl_EM"})
    else:
        ems_pp = pd.DataFrame(columns=["AN", "Parcelle", "Var", "NB_Pl_EM"])
    pr = em[em["Plante"].notna() & em["Date_Levee"].notna()].copy()
    ems_pr = pr.groupby(["AN", "Parcelle", "Var"], as_index=False).size().rename(columns={"size": "NB_Pl_EM"})
    ems = pd.concat([ems_pr, ems_pp], ignore_index=True)

    rdts = rdt2s.merge(rdt1s, on=["AN", "Parcelle", "Var"], how="left")
    rdts = ems.merge(rdts, on=["AN", "Parcelle", "Var"], how="left")
    mins = np.minimum(rdts["Nb_PL_Tot"], rdts["NB_Rec_Parc"])
    rdts["Nb_Pl_RecF"] = np.where(mins.isna(), rdts["NB_Pl_EM"], mins)
    rdts = rdts.merge(plant_site[["AN", "Parcelle", "Densite"]], on=["AN", "Parcelle"], how="left")
    rdts["I1.1"] = rdts["PoidsTot"] / rdts["Nb_Pl_RecF"] * rdts["Densite"] / 100.0
    rdts["I1.3"] = rdts["I1_3"]

    # Conservation emergence indicator from production intermediate.
    pla_cons = rdts[["AN", "Parcelle", "Var", "NB_Pl_EM", "Nb_Pl_RecF"]].copy()
    pla_cons["I3.1"] = pla_cons["Nb_Pl_RecF"] / np.maximum(pla_cons["NB_Pl_EM"], pla_cons["Nb_Pl_RecF"]) * 100.0

    # ---------- Resistance ----------
    san = dfs["dsan"].copy()
    san["IDM"] = pd.to_numeric(san.get("IDM"), errors="coerce").fillna(0)
    res_rows = []
    for row in comb.itertuples(index=False):
        sub = san[(san.AN == row.AN) & (san.Parcelle == row.Parcelle) & (san.Var == row.Var)]
        if row.Sp == "Da":
            p = sub.loc[sub["Cause_Mal"].astype(str).str.strip().eq("Anthracnose"), "IDM"]
            o = sub.loc[~sub["Cause_Mal"].astype(str).str.strip().eq("Anthracnose"), "IDM"]
        else:
            p = sub.loc[sub["Cause_Mal"].astype(str).str.strip().eq("Cur"), "IDM"]
            o = sub.loc[~sub["Cause_Mal"].astype(str).str.strip().eq("Cur"), "IDM"]
        res_rows.append((row.AN, row.Zone, row.Parcelle, row.Var, row.Sp,
                         float(p.max()) if len(p) else 0.0,
                         float(o.max()) if len(o) else 0.0))
    resistance = pd.DataFrame(res_rows, columns=["AN","Zone","Parcelle","Var","Sp","I2.1","I2.2"])

    # ---------- Qualitative conservation / quality ----------
    qua = dfs["dqua"].copy()
    qrows = {}
    for r in qua.itertuples(index=False):
        ox = str(getattr(r, "Oxydation", "")).strip().lower()
        ox_score = 3 if ox == "faible" else 2 if ox == "moyenne" else 1 if ox == "moyenne forte" else 0
        qrows[r.Var] = {
            "I3.2": 1.0 if str(getattr(r, "Conservation", "")).strip() == ">1 mois" else 0.0,
            "Couleur": str(getattr(r, "Couleur", "")).strip().lower(),
            "I4.2": float(ox_score),
        }

    # ---------- I5.1: V1 empirical emergence duration ----------
    # Uses q90-q10 of emergence timing. For PP observations, cumulative counts
    # are differenced to reconstruct approximate individual emergence events.
    emergence_i51 = {}
    # PR individual plants
    for (an, parc, var), sub in pr.groupby(["AN", "Parcelle", "Var"]):
        days = pd.to_numeric(sub["Date_Levee_JAP"], errors="coerce").dropna().to_numpy(float)
        if len(days) >= 6:
            emergence_i51[(an, parc, var)] = float(np.quantile(days, .9) - np.quantile(days, .1))
    # PP cumulative counts where no PR value is available
    pp2 = pp.copy()
    if len(pp2):
        pp2["day"] = pd.to_numeric(pp2["Date_Levee_JAP"], errors="coerce")
        for key, sub in pp2.dropna(subset=["day"]).groupby(["AN", "Parcelle", "Var"]):
            if key in emergence_i51:
                continue
            d = sub.groupby("day")["NB_Lev_Billon"].sum(min_count=1).sort_index().dropna()
            if len(d) < 4:
                continue
            cum = d.to_numpy(float)
            inc = np.diff(np.r_[0, cum])
            inc = np.maximum(np.rint(inc).astype(int), 0)
            events = np.repeat(d.index.to_numpy(float), inc)
            if len(events) >= 6:
                emergence_i51[key] = float(np.quantile(events, .9) - np.quantile(events, .1))

    # ---------- I5.2 / I5.3: logistic ground cover fit ----------
    rec = dfs["drec"].copy()
    rec["x"] = pd.to_numeric(rec.get("Date_Obs_pRec_JAP"), errors="coerce")
    rec["y"] = pd.to_numeric(rec.get("pRec_ig"), errors="coerce")
    rec_fits = []
    for (an, parc, var, bloc), sub in rec.dropna(subset=["x", "y"]).groupby(["AN","Parcelle","Var","Bloc"]):
        x = sub["x"].to_numpy(float)
        y = sub["y"].to_numpy(float)
        if len(np.unique(y)) <= 3 or np.nanmax(y)-np.nanmin(y) <= 15 or len(x) < 5:
            continue
        y_max = float(np.nanmax(y))
        xfit = np.r_[0.0, x, 280.0]
        yfit = np.r_[0.0, y, y_max]
        try:
            p0 = (-0.04, min(max(y_max, 5.1), 99.9), min(max(float(np.median(x)), 50.1), 279.9))
            popt, _ = curve_fit(logistic, xfit, yfit, p0=p0,
                                bounds=([-5.0, 5.0, 50.0], [-1e-5, 100.0, 280.0]),
                                maxfev=50000)
            b, d, e = [float(v) for v in popt]
            i53 = -4.394449154672439 / b  # ED90 - ED10 for 3p logistic
            if math.isfinite(i53) and 0 <= i53 < 1000:
                rec_fits.append((an, parc, var, d, i53, b, e))
        except Exception:
            pass
    recfit = pd.DataFrame(rec_fits, columns=["AN","Parcelle","Var","I5.2","I5.3","Slope","Tinflex"])
    if len(recfit):
        recagg = recfit.groupby(["AN","Parcelle","Var"], as_index=False).agg({"I5.2":"mean","I5.3":"mean"})
    else:
        recagg = pd.DataFrame(columns=["AN","Parcelle","Var","I5.2","I5.3"])

    # ---------- Build situation rows ----------
    sit = comb.copy()
    sit = sit.merge(rdts[["AN","Parcelle","Var","I1.1","I1.3","Nb_Pl_RecF","Densite"]], on=["AN","Parcelle","Var"], how="left")
    sit = sit.merge(resistance, on=["AN","Zone","Parcelle","Var","Sp"], how="left")
    sit = sit.merge(pla_cons[["AN","Parcelle","Var","I3.1"]], on=["AN","Parcelle","Var"], how="left")
    sit = sit.merge(recagg, on=["AN","Parcelle","Var"], how="left")
    sit["I5.1"] = [emergence_i51.get((r.AN, r.Parcelle, r.Var), np.nan) for r in sit.itertuples(index=False)]
    sit["I3.2"] = sit["Var"].map(lambda v: qrows.get(v, {}).get("I3.2", np.nan))
    sit["Couleur"] = sit["Var"].map(lambda v: qrows.get(v, {}).get("Couleur"))
    sit["I4.2"] = sit["Var"].map(lambda v: qrows.get(v, {}).get("I4.2", np.nan))

    # ---------- Tuber distributions by situation ----------
    def has_defect_row(r):
        vals = [r.get("Defaut1"), r.get("Defaut2"), r.get("Defaut3")]
        for v in vals:
            if pd.notna(v) and str(v).strip() not in ("", "nan", "NA", "NaN"):
                return True
        return False
    rdt2["has_defect"] = rdt2.apply(has_defect_row, axis=1)
    tubers = {}
    for (an, parc, var), sub in rdt2.groupby(["AN","Parcelle","Var"]):
        weights = pd.to_numeric(sub["Poids"], errors="coerce").dropna()
        good = pd.to_numeric(sub.loc[~sub["has_defect"], "Poids"], errors="coerce").dropna().astype(float).tolist()
        defect_weight = pd.to_numeric(sub.loc[sub["has_defect"], "Poids"], errors="coerce").sum(min_count=1)
        key = f"{int(an)}|{parc}|{var}"
        tubers[key] = {
            "good_weights_g": [int(round(x)) for x in good],
            "defect_weight_g": 0 if pd.isna(defect_weight) else int(round(float(defect_weight))),
            "total_weight_g": int(round(float(weights.sum()))) if len(weights) else 0,
            "n_tubers": int(len(weights)),
        }

    # Keep only rows for the 28 canonical genotypes and JSON-serializable fields.
    sit = sit.sort_values(["AN","Zone","Parcelle","Sp","Var"]).reset_index(drop=True)
    fields = ["AN","Zone","Parcelle","Sp","Var","I1.1","I1.3","Nb_Pl_RecF","Densite",
              "I2.1","I2.2","I3.1","I3.2","Couleur","I4.2","I5.1","I5.2","I5.3"]
    records = []
    for r in sit[fields].to_dict("records"):
        recj = {}
        for k, v in r.items():
            if k == "AN":
                recj[k] = int(v) if pd.notna(v) else None
            elif k in {"Zone","Parcelle","Sp","Var","Couleur"}:
                recj[k] = None if pd.isna(v) else str(v)
            else:
                recj[k] = finite_or_none(v)
        records.append(recj)

    model = {
        "schema_version": 1,
        "generated_from": "VaPaDONF Backup/data_rita",
        "model_notes": {
            "I1.2": "Calculated in the browser from user min/max calibre, excluding defects and out-of-range tubers.",
            "I5.1": "V1 port: empirical q90-q10 emergence duration, close in meaning but not bit-identical to legacy drc interval-event model.",
            "I5.2_I5.3": "Precomputed with a bounded 3-parameter logistic fit equivalent in form to the legacy L.3 model.",
            "colour_weight_fix": "Colour preferences only affect I4.1; they are not concatenated into the five global criterion weights."
        },
        "zones": {"BT": "Basse-Terre", "GT": "Grande-Terre", "MG": "Marie-Galante"},
        "traditional_varieties": ["ANBABON","GROSSECAILLE","KABUSAH","KINABAYO","PAKALA","GOANA"],
        "situations": records,
        "tubers": tubers,
        "recouvrement_fit_count": int(len(recfit)),
        "emergence_i51_count": int(len(emergence_i51)),
    }
    output.write_text(json.dumps(model, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print(f"Wrote {output} ({output.stat().st_size/1024:.1f} KiB)")
    print(f"situations={len(records)}, tuber situations={len(tubers)}, I5.1={len(emergence_i51)}, cover fits={len(recfit)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, required=True, help="Legacy data_rita directory")
    ap.add_argument("--mapping", type=Path, required=True, help="genotypes.json")
    ap.add_argument("--output", type=Path, required=True, help="output model-data.json")
    a = ap.parse_args()
    build(a.source, a.mapping, a.output)
