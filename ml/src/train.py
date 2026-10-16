import numpy as np
from sklearn.ensemble import GradientBoostingClassifier

def train_model():
    print("Training gradient-boosted risk model...")
    X = np.random.rand(100, 5)
    y = np.random.randint(0, 2, size=100)
    clf = GradientBoostingClassifier()
    clf.fit(X, y)
    print("Training completed successfully.")

if __name__ == "__main__":
    train_model()
