# Infra Alerts & Budgets — 2026-02-01

## SNS topics
- EU (CloudWatch alarms): `arn:aws:sns:eu-west-1:495219734037:orya-alerts-eu-west-1`
  - Subscription: `arn:aws:sns:eu-west-1:495219734037:orya-alerts-eu-west-1:79be27ce-53dd-4dae-94d0-ec5af0c7860a` (email: admin@orya.pt)
- US (Budgets): `arn:aws:sns:us-east-1:495219734037:orya-alerts-us-east-1`
  - Subscription: `arn:aws:sns:us-east-1:495219734037:orya-alerts-us-east-1:34551319-4cbc-43ff-8da1-f1a26518d0e3` (email: admin@orya.pt)

## Budget (global)
- Name: `ORYA-BUDGET-MONTHLY-75USD`
- Limit: `75 USD` (monthly)
- Notification types: `ACTUAL` + `FORECASTED`
- Thresholds: `25/50/60/65/70%`
- Region: `us-east-1`

## CloudWatch alarms (eu-west-1)
- `ORYA-ALARM-ALB-5XX` — INSUFFICIENT_DATA (expected until traffic)
- `ORYA-ALARM-ALB-LATENCY` — INSUFFICIENT_DATA
- `ORYA-ALARM-ALB-UNHEALTHY` — INSUFFICIENT_DATA
- `ORYA-ALARM-ECS-CPU` — INSUFFICIENT_DATA
- `ORYA-ALARM-ECS-MEM` — INSUFFICIENT_DATA
- `ORYA-ALARM-ECS-RUNNING-BELOW-DESIRED` — OK
- `ORYA-ALARM-SES-BOUNCE` — OK
- `ORYA-ALARM-SES-COMPLAINT` — OK

## Evidence (commands)
- Budgets:
  - `aws budgets describe-budgets --account-id <acct> --region us-east-1 --query "Budgets[?BudgetName=='ORYA-BUDGET-MONTHLY-75USD']"`
- Alarms:
  - `aws cloudwatch describe-alarms --region eu-west-1 --query "MetricAlarms[?starts_with(AlarmName,'ORYA-ALARM-')].[AlarmName,StateValue]" --output table`

## Notes
- `INSUFFICIENT_DATA` is expected until the metrics emit (ALB/ECS).
- SNS display names set to `[ORYA][ALARM]` (EU) and `[ORYA][BUDGET]` (US).
