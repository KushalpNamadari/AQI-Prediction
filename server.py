# pyrefly: ignore [missing-import]
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
# pyrefly: ignore [missing-import]
import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, accuracy_score
import os

app = Flask(__name__)
CORS(app)

# Global variables to hold models and stats
reg_model = None
clf_model = None
models_trained = False
model_stats = {}

def train_models():
    """Load the dataset and train models identically to aqi.py"""
    global reg_model, clf_model, models_trained, model_stats

    if not os.path.exists("aqi5.csv"):
        print("Warning: aqi5.csv not found. Models cannot be trained.")
        return False

    df = pd.read_csv("aqi5.csv")

    # Pre-processing
    num_cols = df.select_dtypes(include=['float64', 'int64']).columns
    for col in num_cols:
        df[col] = df[col].fillna(df[col].mean())

    df = df.drop_duplicates()
    if "City" in df.columns:
        df = df.drop(columns=["City"])

    X = df[["PM2.5", "PM10", "NO2", "SO2", "CO", "O3"]]
    y_reg = df["AQI"]
    y_cls = df["AQI_Category"]

    X_train, X_test, y_train_reg, y_test_reg, y_train_cls, y_test_cls = train_test_split(
        X, y_reg, y_cls, test_size=0.2, random_state=42
    )

    # Train Regression Model
    print("Training Regression Model...")
    reg_model = RandomForestRegressor(random_state=42)
    reg_model.fit(X_train, y_train_reg)

    # Train Classification Model
    print("Training Classification Model...")
    clf_model = RandomForestClassifier(random_state=42)
    clf_model.fit(X_train, y_train_cls)

    # Calculate stats
    y_pred_reg = reg_model.predict(X_test)
    rmse = float(np.sqrt(mean_squared_error(y_test_reg, y_pred_reg)))
    r2 = float(r2_score(y_test_reg, y_pred_reg))

    test_pred_cls = clf_model.predict(X_test)
    cls_accuracy = float(accuracy_score(y_test_cls, test_pred_cls))

    # Feature importances
    importances = reg_model.feature_importances_
    feature_names = list(X.columns)
    feature_imp = {name: round(float(imp), 4) for name, imp in zip(feature_names, importances)}

    # Dataset range info (for the UI hints)
    ranges = {}
    for col in feature_names:
        ranges[col] = {
            "min": round(float(X[col].min()), 2),
            "max": round(float(X[col].max()), 2),
            "mean": round(float(X[col].mean()), 2)
        }

    model_stats = {
        "rmse": round(rmse, 2),
        "r2": round(r2, 4),
        "classification_accuracy": round(cls_accuracy, 4),
        "sample_count": len(df),
        "categories": sorted(df["AQI_Category"].unique().tolist()),
        "feature_importances": feature_imp,
        "ranges": ranges
    }

    models_trained = True
    print("Models trained successfully!")
    print(f"  RMSE: {rmse:.2f}, R²: {r2:.4f}, Classification Accuracy: {cls_accuracy:.4f}")
    return True


@app.route('/')
def index():
    return send_file('index.html')


@app.route('/stats', methods=['GET'])
def stats():
    if not models_trained:
        return jsonify({"error": "Models are not trained."}), 500
    return jsonify(model_stats)


@app.route('/predict', methods=['POST'])
def predict():
    if not models_trained:
        return jsonify({"error": "Models are not trained. Is aqi5.csv present?"}), 500

    data = request.json

    try:
        input_df = pd.DataFrame([{
            "PM2.5": float(data["PM2.5"]),
            "PM10": float(data["PM10"]),
            "NO2": float(data["NO2"]),
            "SO2": float(data["SO2"]),
            "CO": float(data["CO"]),
            "O3": float(data["O3"])
        }])

        predicted_aqi = reg_model.predict(input_df)[0]
        predicted_category = clf_model.predict(input_df)[0]

        return jsonify({
            "predicted_aqi": round(float(predicted_aqi), 2),
            "predicted_category": str(predicted_category)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400


if __name__ == '__main__':
    train_models()
    app.run(debug=True, port=5000)
