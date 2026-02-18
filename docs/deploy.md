AWS_PROFILE=codex AWS_REGION=eu-west-1 BRANCH=developer bash -lc '
set -euo pipefail
git add -A
git commit -m "deploy: $(date "+%Y-%m-%d %H:%M")" || true
git push origin "$BRANCH"
S=$(aws secretsmanager get-secret-value --profile "$AWS_PROFILE" --region "$AWS_REGION" --secret-id orya/prod/supabase --query SecretString --output text)
export NEXT_PUBLIC_SUPABASE_URL=$(echo "$S" | jq -r .NEXT_PUBLIC_SUPABASE_URL)
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(echo "$S" | jq -r .NEXT_PUBLIC_SUPABASE_ANON_KEY)
scripts/build-and-push.sh --profile "$AWS_PROFILE" --region "$AWS_REGION" --target web
aws ecs update-service --profile "$AWS_PROFILE" --region "$AWS_REGION" --cluster orya-prod --service orya-prod-web --force-new-deployment >/dev/null
aws ecs wait services-stable --profile "$AWS_PROFILE" --region "$AWS_REGION" --cluster orya-prod --services orya-prod-web
echo "Push + deploy concluido."
'






colima restart --profile x86_64
AWS_PROFILE=codex AWS_REGION=eu-west-1 bash -lc '
set -euo pipefail
S=$(aws secretsmanager get-secret-value --profile "$AWS_PROFILE" --region "$AWS_REGION" --secret-id orya/prod/supabase --query SecretString --output text)
export NEXT_PUBLIC_SUPABASE_URL=$(echo "$S" | jq -r .NEXT_PUBLIC_SUPABASE_URL)
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(echo "$S" | jq -r .NEXT_PUBLIC_SUPABASE_ANON_KEY)
scripts/build-and-push.sh --profile "$AWS_PROFILE" --region "$AWS_REGION" --target web
aws ecs update-service --profile "$AWS_PROFILE" --region "$AWS_REGION" --cluster orya-prod --service orya-prod-web --force-new-deployment >/dev/null
aws ecs wait services-stable --profile "$AWS_PROFILE" --region "$AWS_REGION" --cluster orya-prod --services orya-prod-web
echo "Deploy web concluido."
'
