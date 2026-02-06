# Infra/Config Audit

## Infra files by area

- infra/dev: 2 files
- infra/ecs: 5 files
- infra/ci: 0 files
- infra/apple: 1 files

## Placeholder/Template hits (infra/config/scripts)

- infra: 79
- scripts: 48

## Sample hits (first 200)

```
scripts/infra-mode.sh:8:ADMIN_DOMAIN=${ADMIN_DOMAIN:-admin.${ROOT_DOMAIN}}
scripts/infra-mode.sh:23:    local region="${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}"
scripts/upload-secrets.sh:6:REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}
scripts/upload-secrets.sh:11:ALLOW_PLACEHOLDERS_DEV=${ALLOW_PLACEHOLDERS_DEV:-true}
scripts/upload-secrets.sh:73:    ALLOW_PLACEHOLDERS_DEV="$ALLOW_PLACEHOLDERS_DEV" COPY_PROD_TO_DEV="$COPY_PROD_TO_DEV" ONLY_ENVS="$ONLY_ENVS" \
infra/ecs/taskdef-web.json:16:      "image": "{{ECR_URI}}/orya-web:latest",
infra/ecs/taskdef-web.json:22:        {"name": "DATABASE_URL", "valueFrom": "{{orya/prod/app:DATABASE_URL}}"},
infra/ecs/taskdef-web.json:23:        {"name": "DIRECT_URL", "valueFrom": "{{orya/prod/app:DIRECT_URL}}"},
infra/ecs/taskdef-web.json:24:        {"name": "QR_SECRET_KEY", "valueFrom": "{{orya/prod/app:QR_SECRET_KEY}}"},
infra/ecs/taskdef-web.json:25:        {"name": "APP_BASE_URL", "valueFrom": "{{orya/prod/app:APP_BASE_URL}}"},
infra/ecs/taskdef-web.json:26:        {"name": "NEXT_PUBLIC_BASE_URL", "valueFrom": "{{orya/prod/app:NEXT_PUBLIC_BASE_URL}}"},
infra/ecs/taskdef-web.json:27:        {"name": "ORYA_CRON_SECRET", "valueFrom": "{{orya/prod/app:ORYA_CRON_SECRET}}"},
infra/ecs/taskdef-web.json:28:        {"name": "SUPABASE_URL", "valueFrom": "{{orya/prod/supabase:SUPABASE_URL}}"},
infra/ecs/taskdef-web.json:29:        {"name": "NEXT_PUBLIC_SUPABASE_URL", "valueFrom": "{{orya/prod/supabase:NEXT_PUBLIC_SUPABASE_URL}}"},
infra/ecs/taskdef-web.json:30:        {"name": "SUPABASE_ANON_KEY", "valueFrom": "{{orya/prod/supabase:SUPABASE_ANON_KEY}}"},
infra/ecs/taskdef-web.json:31:        {"name": "NEXT_PUBLIC_SUPABASE_ANON_KEY", "valueFrom": "{{orya/prod/supabase:NEXT_PUBLIC_SUPABASE_ANON_KEY}}"},
infra/ecs/taskdef-web.json:32:        {"name": "SUPABASE_SERVICE_ROLE", "valueFrom": "{{orya/prod/supabase:SUPABASE_SERVICE_ROLE}}"},
infra/ecs/taskdef-web.json:33:        {"name": "STRIPE_SECRET_KEY", "valueFrom": "{{orya/prod/payments:STRIPE_SECRET_KEY}}"},
infra/ecs/taskdef-web.json:34:        {"name": "STRIPE_WEBHOOK_SECRET", "valueFrom": "{{orya/prod/payments:STRIPE_WEBHOOK_SECRET}}"},
infra/ecs/taskdef-web.json:35:        {"name": "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "valueFrom": "{{orya/prod/payments:NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}}"},
infra/ecs/taskdef-web.json:36:        {"name": "SES_REGION", "valueFrom": "{{orya/prod/email:SES_REGION}}"},
infra/ecs/taskdef-web.json:37:        {"name": "SES_IDENTITY_DOMAIN", "valueFrom": "{{orya/prod/email:SES_IDENTITY_DOMAIN}}"},
infra/ecs/taskdef-web.json:38:        {"name": "SES_SMTP_USERNAME", "valueFrom": "{{orya/prod/email:SES_SMTP_USERNAME}}"},
infra/ecs/taskdef-web.json:39:        {"name": "SES_SMTP_PASSWORD", "valueFrom": "{{orya/prod/email:SES_SMTP_PASSWORD}}"},
infra/ecs/taskdef-web.json:40:        {"name": "APPLE_SIGNIN_SERVICE_ID", "valueFrom": "{{orya/prod/apple:APPLE_SIGNIN_SERVICE_ID}}"},
infra/ecs/taskdef-web.json:41:        {"name": "APPLE_SIGNIN_REDIRECT_URI", "valueFrom": "{{orya/prod/apple:APPLE_SIGNIN_REDIRECT_URI}}"},
infra/ecs/taskdef-web.json:42:        {"name": "APPLE_SIGNIN_TEAM_ID", "valueFrom": "{{orya/prod/apple:APPLE_SIGNIN_TEAM_ID}}"},
infra/ecs/taskdef-web.json:43:        {"name": "APPLE_SIGNIN_KEY_ID", "valueFrom": "{{orya/prod/apple:APPLE_SIGNIN_KEY_ID}}"},
infra/ecs/taskdef-web.json:44:        {"name": "APPLE_SIGNIN_PRIVATE_KEY_BASE64", "valueFrom": "{{orya/prod/apple:APPLE_SIGNIN_PRIVATE_KEY_BASE64}}"},
infra/ecs/taskdef-web.json:45:        {"name": "APNS_TEAM_ID", "valueFrom": "{{orya/prod/apple:APNS_TEAM_ID}}"},
infra/ecs/taskdef-web.json:46:        {"name": "APNS_KEY_ID", "valueFrom": "{{orya/prod/apple:APNS_KEY_ID}}"},
infra/ecs/taskdef-web.json:47:        {"name": "APNS_PRIVATE_KEY_BASE64", "valueFrom": "{{orya/prod/apple:APNS_PRIVATE_KEY_BASE64}}"},
infra/ecs/taskdef-web.json:48:        {"name": "APNS_TOPIC", "valueFrom": "{{orya/prod/apple:APNS_TOPIC}}"},
infra/ecs/taskdef-web.json:49:        {"name": "ADMIN_TOTP_ENCRYPTION_KEY", "valueFrom": "{{orya/prod/app:ADMIN_TOTP_ENCRYPTION_KEY}}"},
infra/ecs/taskdef-web.json:50:        {"name": "ADMIN_USER_IDS", "valueFrom": "{{orya/prod/app:ADMIN_USER_IDS}}"},
infra/ecs/taskdef-web.json:51:        {"name": "ADMIN_ACTION_IP_ALLOWLIST", "valueFrom": "{{orya/prod/app:ADMIN_ACTION_IP_ALLOWLIST}}"},
infra/ecs/taskdef-web.json:52:        {"name": "ADMIN_BREAK_GLASS_TOKEN", "valueFrom": "{{orya/prod/app:ADMIN_BREAK_GLASS_TOKEN}}"},
infra/ecs/taskdef-web.json:53:        {"name": "ADMIN_MFA_REQUIRED", "valueFrom": "{{orya/prod/app:ADMIN_MFA_REQUIRED}}"},
infra/ecs/taskdef-web.json:54:        {"name": "INFRA_READ_ONLY", "valueFrom": "{{orya/prod/app:INFRA_READ_ONLY}}"}
infra/dev/template.yaml:49:          DATABASE_URL: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/app:SecretString:DATABASE_URL}}"
infra/dev/template.yaml:50:          DIRECT_URL: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/app:SecretString:DIRECT_URL}}"
infra/dev/template.yaml:51:          APP_BASE_URL: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/app:SecretString:APP_BASE_URL}}"
infra/dev/template.yaml:52:          NEXT_PUBLIC_BASE_URL: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/app:SecretString:NEXT_PUBLIC_BASE_URL}}"
infra/dev/template.yaml:53:          ORYA_CRON_SECRET: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/app:SecretString:ORYA_CRON_SECRET}}"
infra/dev/template.yaml:54:          QR_SECRET_KEY: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/app:SecretString:QR_SECRET_KEY}}"
infra/dev/template.yaml:55:          INTERNAL_SECRET_HEADER: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/app:SecretString:INTERNAL_SECRET_HEADER}}"
infra/dev/template.yaml:56:          LOG_LEVEL: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/app:SecretString:LOG_LEVEL}}"
infra/dev/template.yaml:57:          LOG_FORMAT: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/app:SecretString:LOG_FORMAT}}"
infra/dev/template.yaml:58:          XRAY_ENABLED: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/app:SecretString:XRAY_ENABLED}}"
infra/dev/template.yaml:59:          SUPABASE_URL: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/supabase:SecretString:SUPABASE_URL}}"
infra/dev/template.yaml:60:          SUPABASE_SERVICE_ROLE: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/supabase:SecretString:SUPABASE_SERVICE_ROLE}}"
infra/dev/template.yaml:61:          SUPABASE_ANON_KEY: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/supabase:SecretString:SUPABASE_ANON_KEY}}"
infra/dev/template.yaml:62:          NEXT_PUBLIC_SUPABASE_URL: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/supabase:SecretString:NEXT_PUBLIC_SUPABASE_URL}}"
infra/dev/template.yaml:63:          NEXT_PUBLIC_SUPABASE_ANON_KEY: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/supabase:SecretString:NEXT_PUBLIC_SUPABASE_ANON_KEY}}"
infra/dev/template.yaml:64:          STRIPE_SECRET_KEY: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/payments:SecretString:STRIPE_SECRET_KEY}}"
infra/dev/template.yaml:65:          STRIPE_WEBHOOK_SECRET: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/payments:SecretString:STRIPE_WEBHOOK_SECRET}}"
infra/dev/template.yaml:66:          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/payments:SecretString:NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}}"
infra/dev/template.yaml:67:          APPLE_SIGNIN_SERVICE_ID: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/apple:SecretString:APPLE_SIGNIN_SERVICE_ID}}"
infra/dev/template.yaml:68:          APPLE_SIGNIN_REDIRECT_URI: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/apple:SecretString:APPLE_SIGNIN_REDIRECT_URI}}"
infra/dev/template.yaml:69:          APPLE_SIGNIN_TEAM_ID: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/apple:SecretString:APPLE_SIGNIN_TEAM_ID}}"
infra/dev/template.yaml:70:          APPLE_SIGNIN_KEY_ID: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/apple:SecretString:APPLE_SIGNIN_KEY_ID}}"
infra/dev/template.yaml:71:          APPLE_SIGNIN_PRIVATE_KEY_BASE64: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/apple:SecretString:APPLE_SIGNIN_PRIVATE_KEY_BASE64}}"
infra/dev/template.yaml:72:          APNS_TEAM_ID: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/apple:SecretString:APNS_TEAM_ID}}"
infra/dev/template.yaml:73:          APNS_KEY_ID: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/apple:SecretString:APNS_KEY_ID}}"
infra/dev/template.yaml:74:          APNS_PRIVATE_KEY_BASE64: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/apple:SecretString:APNS_PRIVATE_KEY_BASE64}}"
infra/dev/template.yaml:75:          APNS_TOPIC: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/apple:SecretString:APNS_TOPIC}}"
infra/dev/template.yaml:76:          SES_REGION: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/email:SecretString:SES_REGION}}"
infra/dev/template.yaml:77:          SES_IDENTITY_DOMAIN: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/email:SecretString:SES_IDENTITY_DOMAIN}}"
infra/dev/template.yaml:78:          SES_SMTP_USERNAME: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/email:SecretString:SES_SMTP_USERNAME}}"
infra/dev/template.yaml:79:          SES_SMTP_PASSWORD: !Sub "{{resolve:secretsmanager:${SecretsPrefix}/email:SecretString:SES_SMTP_PASSWORD}}"
scripts/render-taskdef.py:22:        if value == "{{ECR_URI}}":
scripts/healthcheck.sh:4:BASE_URL=${1:-${BASE_URL:-}}
scripts/v9_generate_checklist.mjs:18:  if (/^- \[ \]\s/.test(trimmed)) return "TODO";
scripts/v9_generate_checklist.mjs:21:  if (/\bStatus\b.*:\s*TODO\b/i.test(trimmed)) return "TODO";
scripts/deploy-dev.sh:4:REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}
scripts/deploy-dev.sh:7:TEMPLATE=${TEMPLATE:-infra/dev/template.yaml}
scripts/deploy-dev.sh:18:  --template-file "$TEMPLATE" \
scripts/deploy-cf.sh:4:REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}
scripts/deploy-cf.sh:8:TEMPLATE=${TEMPLATE:-infra/ecs/orya-ecs-stack.yaml}
scripts/deploy-cf.sh:9:ACM_TEMPLATE=${ACM_TEMPLATE:-infra/ecs/route53-acm.yaml}
scripts/deploy-cf.sh:178:    --template-file "$ACM_TEMPLATE" \
scripts/deploy-cf.sh:201:  --template-file "$TEMPLATE" \
infra/ecs/taskdef-worker.json:16:      "image": "{{ECR_URI}}/orya-worker:latest",
infra/ecs/taskdef-worker.json:22:        {"name": "DATABASE_URL", "valueFrom": "{{orya/prod/app:DATABASE_URL}}"},
infra/ecs/taskdef-worker.json:23:        {"name": "DIRECT_URL", "valueFrom": "{{orya/prod/app:DIRECT_URL}}"},
infra/ecs/taskdef-worker.json:24:        {"name": "QR_SECRET_KEY", "valueFrom": "{{orya/prod/app:QR_SECRET_KEY}}"},
infra/ecs/taskdef-worker.json:25:        {"name": "ORYA_CRON_SECRET", "valueFrom": "{{orya/prod/app:ORYA_CRON_SECRET}}"},
infra/ecs/taskdef-worker.json:26:        {"name": "SUPABASE_URL", "valueFrom": "{{orya/prod/supabase:SUPABASE_URL}}"},
infra/ecs/taskdef-worker.json:27:        {"name": "SUPABASE_ANON_KEY", "valueFrom": "{{orya/prod/supabase:SUPABASE_ANON_KEY}}"},
infra/ecs/taskdef-worker.json:28:        {"name": "SUPABASE_SERVICE_ROLE", "valueFrom": "{{orya/prod/supabase:SUPABASE_SERVICE_ROLE}}"},
infra/ecs/taskdef-worker.json:29:        {"name": "STRIPE_SECRET_KEY", "valueFrom": "{{orya/prod/payments:STRIPE_SECRET_KEY}}"},
infra/ecs/taskdef-worker.json:30:        {"name": "STRIPE_WEBHOOK_SECRET", "valueFrom": "{{orya/prod/payments:STRIPE_WEBHOOK_SECRET}}"},
infra/ecs/taskdef-worker.json:31:        {"name": "SES_REGION", "valueFrom": "{{orya/prod/email:SES_REGION}}"},
infra/ecs/taskdef-worker.json:32:        {"name": "SES_IDENTITY_DOMAIN", "valueFrom": "{{orya/prod/email:SES_IDENTITY_DOMAIN}}"},
infra/ecs/taskdef-worker.json:33:        {"name": "SES_SMTP_USERNAME", "valueFrom": "{{orya/prod/email:SES_SMTP_USERNAME}}"},
infra/ecs/taskdef-worker.json:34:        {"name": "SES_SMTP_PASSWORD", "valueFrom": "{{orya/prod/email:SES_SMTP_PASSWORD}}"}
scripts/build-and-push.sh:4:REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}
scripts/build-and-push.sh:54:    --lifecycle-policy-text '{"rules":[{"rulePriority":1,"description":"Keep last 5 images","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":5},"action":{"type":"expire"}}]}' >/dev/null
scripts/v9_todo_gate.mjs:17:const TODO_RE = /\b(TODO|FIXME)\b/i;
scripts/v9_todo_gate.mjs:43:    if (!TODO_RE.test(content)) continue;
scripts/v9_todo_gate.mjs:46:      if (TODO_RE.test(line)) {
scripts/v9_todo_gate.mjs:54:  console.error("V9 TODO/FIXME gate failed:");
scripts/v9_todo_gate.mjs:59:console.log("V9 TODO/FIXME gate: OK");
scripts/seed_mobile_v1.ts:163:const EVENT_TEMPLATES = [
scripts/seed_mobile_v1.ts:443:      const template = pick(EVENT_TEMPLATES, i + j);
scripts/dev-all.js:50:        if (value.startsWith("REPLACE_ME")) continue;
scripts/create-secrets-json.sh:6:FLAT_TEMPLATE=${FLAT_TEMPLATE:-/tmp/orya-prod-secrets.flat.json}
scripts/create-secrets-json.sh:7:REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}
scripts/create-secrets-json.sh:10:ALLOW_PLACEHOLDERS_DEV=${ALLOW_PLACEHOLDERS_DEV:-true}
scripts/create-secrets-json.sh:14:FORCE_PLACEHOLDERS_PROD=${FORCE_PLACEHOLDERS_PROD:-false}
scripts/create-secrets-json.sh:23:      FLAT_TEMPLATE="$2"; shift 2;;
scripts/create-secrets-json.sh:31:      ALLOW_PLACEHOLDERS_DEV="true"; shift;;
scripts/create-secrets-json.sh:33:      FORCE_PLACEHOLDERS_PROD="true"; shift;;
scripts/create-secrets-json.sh:54:FLAT_TEMPLATE="$FLAT_TEMPLATE" \
scripts/create-secrets-json.sh:56:ALLOW_PLACEHOLDERS_DEV="$ALLOW_PLACEHOLDERS_DEV" \
scripts/create-secrets-json.sh:57:FORCE_PLACEHOLDERS_PROD="$FORCE_PLACEHOLDERS_PROD" \
scripts/create-secrets-json.sh:66:flat_template = Path(os.environ.get("FLAT_TEMPLATE", "/tmp/orya-prod-secrets.flat.json"))
scripts/create-secrets-json.sh:68:allow_placeholders_dev = os.environ.get("ALLOW_PLACEHOLDERS_DEV", "true").lower() == "true"
scripts/create-secrets-json.sh:69:force_placeholders_prod = os.environ.get("FORCE_PLACEHOLDERS_PROD", "false").lower() == "true"
scripts/create-secrets-json.sh:106:        if value.strip().startswith("REPLACE_ME"):
scripts/create-secrets-json.sh:177:flat = {key: f"REPLACE_ME_{key}" for key in all_keys}
scripts/create-secrets-json.sh:180:prod_groups = {"app": {}, "supabase": {}, "payments": {}, "apple": {}, "email": {}, "admin": {}}
scripts/create-secrets-json.sh:187:        prod_groups[group_for(key)].setdefault(key, f"REPLACE_ME_{key}")
scripts/create-secrets-json.sh:193:    dev_groups = {"app": {}, "supabase": {}, "payments": {}, "apple": {}, "email": {}, "admin": {}}
scripts/create-secrets-json.sh:196:            dev_groups[group_for(key)][key] = f"REPLACE_ME_{key}"
scripts/load-env.js:83:    if (value.trim().startsWith("REPLACE_ME")) continue;
scripts/run-e2e-p1.sh:204:API_BASE_URL="${API_BASE_URL:-${APP_BASE_URL:-${NEXT_PUBLIC_BASE_URL:-}}}"
```
