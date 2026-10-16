from locust import HttpUser, task, between

class AcadFlowUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def view_dashboard(self):
        self.client.get("/api/v1/health")

    @task(1)
    def check_risk_score(self):
        self.client.get("/api/v1/risk/summary")
