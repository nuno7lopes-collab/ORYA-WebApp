# CloudFront Update — 20260130_202540

## Inputs
- DIST_ID: E3B1FR4NMF6N3P
- CERT_ARN_US_EAST: arn:aws:acm:us-east-1:495219734037:certificate/ca75794b-551c-4c4c-9597-6255df3239d8
- ZONE_ID: Z01063466077T62XP3HQ
- ALIASES: app.orya.pt, admin.orya.pt

## Backup
- ETAG: E23ZP02F085DFQ
- Backup: /tmp/dist-get.json.bak

## Update
- Update requestId: 8c96b328-bb71-4859-a84c-0cacf9afe760
- Update output: /tmp/dist-update-out.json

## Distribution Final
- DomainName: d1rmccunresrvd.cloudfront.net
- Status: Deployed
- ViewerCertificateArn: arn:aws:acm:us-east-1:495219734037:certificate/ca75794b-551c-4c4c-9597-6255df3239d8

## Route53
- ChangeId: /change/C04165922FRJA12500OU8

## Curl Checks
### app.orya.pt


```
CURL_EMPTY
```
### admin.orya.pt


```
CURL_EMPTY
```

## RequestIds
- cloudfront:get-distribution-config: 74c314d6-7a7b-4022-b7cf-7471e0f44e01
- cloudfront:update-distribution: 8c96b328-bb71-4859-a84c-0cacf9afe760
- route53:change-resource-record-sets: 563ea530-61c7-493a-9162-e6c4703ca0f9

## Notes
- Curl headers empty likely indicate DNS delegation not set at registrador yet.
