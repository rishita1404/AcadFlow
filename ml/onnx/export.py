"""
ONNX Model Export & Numerical Parity Verification — AcadFlow (Phase 3).

Converts scikit-learn best model to ONNX runtime format and verifies
numerical equivalence against original scikit-learn outputs.
"""

from __future__ import annotations

import sys
from pathlib import Path

import joblib
import numpy as np

ML_ROOT = Path(__file__).resolve().parent.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

VENDOR_DIR = ML_ROOT / "vendor_packages"
if VENDOR_DIR.exists() and str(VENDOR_DIR) not in sys.path:
    sys.path.insert(0, str(VENDOR_DIR))

import onnxruntime as ort
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

from src.features import FEATURE_NAMES


def export_onnx(model_path: Path | None = None, output_path: Path | None = None) -> Path:
    models_dir = ML_ROOT / "models"
    model_path = model_path or (models_dir / "best_model.joblib")
    output_path = output_path or (models_dir / "risk_model.onnx")

    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found at {model_path}. Run train.py first.")

    model = joblib.load(model_path)
    print(f"Loaded trained model: {type(model).__name__}")

    # Define input type: [None, 6] float32
    initial_type = [("float_input", FloatTensorType([None, len(FEATURE_NAMES)]))]

    # Convert to ONNX
    onnx_model = convert_sklearn(
        model,
        initial_types=initial_type,
        options={type(model): {"zipmap": False}},
    )

    with open(output_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
    print(f"Exported ONNX model to {output_path} ({output_path.stat().st_size / 1024:.1f} KB)")

    # Numerical parity verification
    print("Verifying numerical parity against scikit-learn...")
    test_inputs = np.array([
        [0.8, -4.5, 3.0, 2.0, 68.0, 55.0],
        [0.1, 1.2, 0.0, 0.0, 92.0, 88.0],
        [0.5, -1.0, 2.0, 1.0, 76.0, 72.0],
        [0.95, -8.0, 5.0, 4.0, 58.0, 45.0],
        [0.0, 0.0, 1.0, 0.0, 85.0, 80.0],
    ], dtype=np.float32)

    # Scikit-learn predictions
    sklearn_probs = model.predict_proba(test_inputs)[:, 1]

    # ONNX runtime predictions
    sess = ort.InferenceSession(str(output_path))
    input_name = sess.get_inputs()[0].name
    onnx_outs = sess.run(None, {input_name: test_inputs})

    # Find probabilities output
    if len(onnx_outs) > 1 and onnx_outs[1].shape[-1] == 2:
        onnx_probs = onnx_outs[1][:, 1]
    elif len(onnx_outs) == 1 and onnx_outs[0].shape[-1] == 2:
        onnx_probs = onnx_outs[0][:, 1]
    else:
        onnx_probs = onnx_outs[1][:, 1] if len(onnx_outs) > 1 else onnx_outs[0]

    max_diff = float(np.max(np.abs(sklearn_probs - onnx_probs)))
    print(f"Max absolute difference: {max_diff:.6e}")
    if max_diff > 1e-4:
        raise AssertionError(f"Numerical parity verification failed! Max diff {max_diff} > 1e-4")

    print("[OK] Numerical parity verified successfully (|diff| < 1e-4).")
    return output_path


if __name__ == "__main__":
    export_onnx()
