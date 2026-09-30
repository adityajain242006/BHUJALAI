"""
Trains the three model heads from the brief:
  1. XGBoost classifier -> success_probability (trained on real wells + background points)
  2. LightGBM regressor -> depth_m               (trained on 576 real wells only)
  3. LightGBM regressor -> yield_lpm              (trained on 576 real wells only)

Train/test split is a random split, not the spatial block CV the original brief calls
for (SIH26197_FINAL_TARGET_PARAMETERS.txt's own "red flag" checklist) — flagged here
because with all wells clustered in one city, a spatial split would need a bigger area
than this 24hr prototype covers. Note this explicitly when presenting results: metrics
here are optimistic vs. a true spatial holdout.
"""
import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, accuracy_score, mean_absolute_error
import xgboost as xgb
import lightgbm as lgb

df = pd.read_csv("training_data.csv")
print(f"Loaded {len(df)} rows ({df['success'].sum()} positive, {(df['success']==0).sum()} background)")

CLASSIFIER_FEATURES = ["elevation_m", "slope_deg", "existing_wells_500m", "existing_wells_2km"]
# rainfall_mm dropped from classifier features: constant city-wide in this prototype, zero
# information for a single-district model (would matter across districts).

REGRESSOR_FEATURES = ["elevation_m", "slope_deg", "existing_wells_500m", "existing_wells_2km", "avg_depth_nearby"]

# ---------------- 1. Success classifier ----------------
X = df[CLASSIFIER_FEATURES]
y = df["success"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

clf = xgb.XGBClassifier(
    n_estimators=200, max_depth=4, learning_rate=0.08,
    subsample=0.8, colsample_bytree=0.8, eval_metric="logloss", random_state=42,
)
clf.fit(X_train, y_train)
pred_proba = clf.predict_proba(X_test)[:, 1]
pred = clf.predict(X_test)
print(f"[classifier] AUC={roc_auc_score(y_test, pred_proba):.3f}  accuracy={accuracy_score(y_test, pred):.3f}")
joblib.dump(clf, "models/success_classifier.joblib")

# ---------------- 2. Depth regressor (real wells only) ----------------
depth_df = df[df["depth_m"].notna() & (df["is_synthetic_background"] == 0)].copy()
Xd = depth_df[REGRESSOR_FEATURES].fillna(depth_df[REGRESSOR_FEATURES].median())
yd = depth_df["depth_m"]
Xd_train, Xd_test, yd_train, yd_test = train_test_split(Xd, yd, test_size=0.2, random_state=42)

depth_model = lgb.LGBMRegressor(n_estimators=200, max_depth=5, learning_rate=0.05, min_child_samples=5, verbose=-1)
depth_model.fit(Xd_train, yd_train)
depth_pred = depth_model.predict(Xd_test)
print(f"[depth regressor] MAE={mean_absolute_error(yd_test, depth_pred):.1f}m  (n_train={len(Xd_train)})")
joblib.dump(depth_model, "models/depth_regressor.joblib")

# ---------------- 3. Yield regressor (real wells only) ----------------
yield_df = df[df["yield_lpm"].notna() & (df["is_synthetic_background"] == 0)].copy()
Xy = yield_df[REGRESSOR_FEATURES].fillna(yield_df[REGRESSOR_FEATURES].median())
yy = yield_df["yield_lpm"]
Xy_train, Xy_test, yy_train, yy_test = train_test_split(Xy, yy, test_size=0.2, random_state=42)

yield_model = lgb.LGBMRegressor(n_estimators=200, max_depth=5, learning_rate=0.05, min_child_samples=5, verbose=-1)
yield_model.fit(Xy_train, yy_train)
yield_pred = yield_model.predict(Xy_test)
print(f"[yield regressor] MAE={mean_absolute_error(yy_test, yield_pred):.1f} lpm  (n_train={len(Xy_train)})")
joblib.dump(yield_model, "models/yield_regressor.joblib")

# median fallback for the median-fill approach at scoring time
import json
medians = {c: float(df[REGRESSOR_FEATURES].median()[c]) for c in REGRESSOR_FEATURES}
json.dump(medians, open("models/feature_medians.json", "w"))

print("\nSaved models to ml/models/")
