# AcadFlow Kubernetes Operations & Deployment Runbook (Labs 25-26)

This runbook documents production deployment, cluster operations, autoscaling under load, rolling updates, canary testing, and disaster rollback procedures for AcadFlow in a Kubernetes environment.

---

## 1. Architecture Overview

- **Namespace**: `acadflow`
- **Ingress**: NGINX Ingress routing `/` to Frontend, `/api` to Backend, `/health` and `/metrics` to Backend.
- **Internal Services**:
  - `acadflow-ml-serve-svc` (Port 8001) — Cluster-internal only; never exposed outside the cluster.
  - `acadflow-postgres-svc` (Port 5432) — StatefulSet with PersistentVolumeClaim.
  - `acadflow-redis-svc` (Port 6379) — StatefulSet with PersistentVolumeClaim.
  - `acadflow-mongo-svc` (Port 27017) — StatefulSet with PersistentVolumeClaim.
- **Autoscaling**: HorizontalPodAutoscalers (HPA) targeting 70% CPU utilization for Backend (2-6 replicas) and ML Serve (2-6 replicas).
- **High Availability**: PodDisruptionBudgets (PDB) guaranteeing minimum 1 available pod per service during maintenance.

---

## 2. Cluster Spin-up & Teardown

### Using Make Targets

```bash
# 1. Create kind cluster, build multi-stage Docker images, and apply k8s manifests
make k8s-up

# 2. Check cluster readiness
kubectl get pods,svc,hpa -n acadflow

# 3. Teardown kind cluster
make k8s-down
```

### Manual Provisioning Steps

```bash
# 1. Create local kind cluster with ingress port mapping
kind create cluster --name acadflow-cluster --config deploy/k8s/kind-config.yaml

# 2. Build production images
docker build -t acadflow-backend:latest backend/
docker build -t acadflow-ml-serve:latest ml/
docker build -t acadflow-frontend:latest frontend/

# 3. Load images into kind node
kind load docker-image acadflow-backend:latest --name acadflow-cluster
kind load docker-image acadflow-ml-serve:latest --name acadflow-cluster
kind load docker-image acadflow-frontend:latest --name acadflow-cluster

# 4. Create secret from example
kubectl apply -f deploy/k8s/base/namespace.yaml
kubectl apply -f deploy/k8s/base/secret.example.yaml

# 5. Apply base manifests via Kustomize
kubectl apply -k deploy/k8s/base/
```

---

## 3. Verifying Pods, Services, and HPA

### Command
```bash
kubectl get pods,svc,hpa -n acadflow
```

### Expected Output
```text
NAME                                     READY   STATUS    RESTARTS   AGE
pod/acadflow-backend-56f89cd7f6-7b2xk    1/1     Running   0          2m14s
pod/acadflow-backend-56f89cd7f6-9m4rt    1/1     Running   0          2m14s
pod/acadflow-frontend-7744b8f58b-2kdfa   1/1     Running   0          2m14s
pod/acadflow-frontend-7744b8f58b-5plmn   1/1     Running   0          2m14s
pod/acadflow-ml-serve-69cb9ddf44-8d4fg   1/1     Running   0          2m14s
pod/acadflow-ml-serve-69cb9ddf44-tq1we   1/1     Running   0          2m14s
pod/acadflow-mongo-0                     1/1     Running   0          2m14s
pod/acadflow-postgres-0                  1/1     Running   0          2m14s
pod/acadflow-redis-0                     1/1     Running   0          2m14s

NAME                            TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)     AGE
service/acadflow-backend-svc    ClusterIP   10.96.142.11     <none>        8000/TCP    2m15s
service/acadflow-frontend-svc   ClusterIP   10.96.210.88     <none>        80/TCP      2m15s
service/acadflow-ml-serve-svc   ClusterIP   10.96.185.34     <none>        8001/TCP    2m15s
service/acadflow-mongo-svc      ClusterIP   10.96.44.120     <none>        27017/TCP   2m15s
service/acadflow-postgres-svc   ClusterIP   10.96.98.54      <none>        5432/TCP    2m15s
service/acadflow-redis-svc      ClusterIP   10.96.215.19     <none>        6379/TCP    2m15s

NAME                                              REFERENCE                          TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
horizontalpodautoscaler.autoscaling/acadflow-backend-hpa    Deployment/acadflow-backend    12%/70%   2         6         2          2m15s
horizontalpodautoscaler.autoscaling/acadflow-ml-serve-hpa   Deployment/acadflow-ml-serve   8%/70%    2         6         2          2m15s
```

---

## 4. Autoscaling Under Load (HPA Scaling)

To verify horizontal pod autoscaling under real load:

### Command
```bash
# Launch Locust headless load test against ML serve & backend
make k8s-load-test
```

Alternatively, port-forward and generate synthetic traffic:
```bash
kubectl port-forward svc/acadflow-backend-svc 8000:8000 -n acadflow &
# In another terminal:
locust -f load-tests/locustfile.py --headless -u 100 -r 10 --run-time 3m --host http://localhost:8000
```

### Observe HPA Status
```bash
kubectl get hpa -n acadflow -w
```

### Expected Output
```text
NAME                     REFERENCE                   TARGETS    MINPODS   MAXPODS   REPLICAS   AGE
acadflow-backend-hpa     Deployment/acadflow-backend 12%/70%    2         6         2          3m
acadflow-backend-hpa     Deployment/acadflow-backend 68%/70%    2         6         2          3m30s
acadflow-backend-hpa     Deployment/acadflow-backend 94%/70%    2         6         2          4m
acadflow-backend-hpa     Deployment/acadflow-backend 88%/70%    2         6         4          4m30s
acadflow-backend-hpa     Deployment/acadflow-backend 72%/70%    2         6         5          5m
```

Pods scale up from 2 to 5 automatically once CPU threshold (70%) is sustained for over 15 seconds.

---

## 5. Zero-Downtime Rolling Update

### Triggering Rolling Update
Update the container image to a newer version tag:
```bash
kubectl set image deployment/acadflow-backend backend=acadflow-backend:v1.1.0 -n acadflow
```

### Monitoring Rollout Status
```bash
kubectl rollout status deployment/acadflow-backend -n acadflow
```

### Expected Output
```text
Waiting for deployment "acadflow-backend" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "acadflow-backend" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "acadflow-backend" rollout to finish: 2 out of 2 new replicas have been updated...
Waiting for deployment "acadflow-backend" rollout to finish: 1 old replicas are pending termination...
Waiting for deployment "acadflow-backend" rollout to finish: 0 old replicas are pending termination...
deployment "acadflow-backend" successfully rolled out
```

Kubernetes provisions new pods, verifies readiness probe (`GET /health` returning HTTP 200), and only then terminates older pods.

---

## 6. Canary Deployment (10% Traffic Ratio)

The canary overlay deploys `acadflow-ml-serve-v2` with label `app: acadflow-ml-serve` behind the exact same Service (`acadflow-ml-serve-svc`), scaling v1 to 9 replicas and v2 to 1 replica.

### Applying Canary
```bash
kubectl apply -k deploy/k8s/overlays/canary/
```

### Verifying Canary Split
```bash
kubectl get deployments -n acadflow -l app=acadflow-ml-serve
```

### Expected Output
```text
NAME                    READY   UP-TO-DATE   AVAILABLE   AGE
acadflow-ml-serve       9/9     9            9           12m
acadflow-ml-serve-v2    1/1     1            1           45s
```

The Service endpoint list now contains 10 Pod IPs (9 from v1, 1 from v2), routing approximately 10% of backend inference calls to the canary model.

---

## 7. Rollback Procedures

### Instant Canary Rollback
If canary telemetry indicates model regression, PSI drift spike, or latency degradation:

```bash
# Method A: Instantly scale canary deployment to zero replicas
kubectl scale deployment acadflow-ml-serve-v2 --replicas=0 -n acadflow

# Method B: Re-apply stable base configuration
kubectl apply -k deploy/k8s/base/

# Method C: Delete canary deployment entirely
kubectl delete deployment acadflow-ml-serve-v2 -n acadflow
```

### Deployment Undo (Rollback to Previous Revision)
To rollback a faulty rolling update on any deployment:

```bash
# Check rollout revision history
kubectl rollout history deployment/acadflow-backend -n acadflow

# Undo to previous revision
kubectl rollout undo deployment/acadflow-backend -n acadflow

# Verify rollback completion
kubectl rollout status deployment/acadflow-backend -n acadflow
```

### Expected Output
```text
deployment.apps/acadflow-backend rolled back
```
All traffic instantly transitions back to the previously stable image revision without service interruption.
