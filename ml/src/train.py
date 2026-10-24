"""
ML Model Training Stub — AcadFlow (Evaluation 2 scope)

Basic gradient boosting stub.  Real training pipeline is planned for Evaluation 2.
"""

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier


def train_model():
    print("Training gradient-boosted risk model (stub)...")
    X = np.random.rand(100, 5)
    y = np.random.randint(0, 2, size=100)
    clf = GradientBoostingClassifier()
    clf.fit(X, y)
    print("Training completed successfully.")
    return clf


if __name__ == "__main__":
    train_model()
